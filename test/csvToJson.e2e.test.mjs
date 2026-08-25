import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the CSV-to-JSON tool: drive the built dist/ output
 * in a real headless browser, through both input paths (file upload and
 * pasted CSV), and verify the actual downloaded content -- not just that
 * the page renders. Mirrors test/jsonToCsv.e2e.test.mjs's approach for the
 * sibling reverse-direction tool.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8',
};

const BASE_PREFIX = '/filetools/';

function startServer(root, prefix) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (p.startsWith(prefix)) p = p.slice(prefix.length - 1);
      if (p.endsWith('/') || p === '') p += 'index.html';
      const resolved = path.join(root, p);
      fs.readFile(resolved, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, 'localhost', () => resolve(server));
  });
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'records.csv'), 'name,price\r\nCoffee,4.5\r\nTea,3.25\r\n');
  fs.writeFileSync(path.join(TMP, 'blank.csv'), '   \n  ');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

// '.json-preview' locators below are scoped to '.table-block' (the live
// result wrapper renderResult() appends -- see
// ../src/browser/csvToJson.client.js), not the bare selector, since this
// tool's page also renders a second, static '.json-preview' inside its
// build-time output-example panel (see ../src/examples/csv-to-json.mjs) --
// same scoping fix test/jsonToCsv.e2e.test.mjs already applies.
test('csv-to-json: uploading a .csv file converts it and downloads a matching JSON array', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'records.csv'));
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), [
    { name: 'Coffee', price: '4.5' },
    { name: 'Tea', price: '3.25' },
  ]);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.json');
  const outPath = path.join(TMP, 'converted-out.json');
  await download.saveAs(outPath);
  const downloaded = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(downloaded, [
    { name: 'Coffee', price: '4.5' },
    { name: 'Tea', price: '3.25' },
  ]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('csv-to-json: pasting CSV text and clicking convert produces the same result', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'name,price\nCoffee,4.5\nTea,3.25');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), [
    { name: 'Coffee', price: '4.5' },
    { name: 'Tea', price: '3.25' },
  ]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('csv-to-json: a leading-zero value stays a string in the real output, never silently becomes a number', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id,name\n0042,Widget');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  // A real JSON.parse round-trip, not a substring match: if this tool ever
  // silently coerced "0042" to the number 42, JSON.parse would already
  // have thrown it away as a leading zero is invalid JSON number syntax,
  // or (if coerced before serializing) it would parse back as 42, not
  // "0042" -- either way this assertion is the real behavioral check.
  assert.deepEqual(JSON.parse(previewText), [{ id: '0042', name: 'Widget' }]);
  await page.close();
});

test('csv-to-json: pasting whitespace-only text shows a friendly error, not a raw exception', async () => {
  // dropzone.client.js itself intercepts a whitespace-only paste before
  // this tool's own run() ever sees it (see its own generic
  // "Paste some markup first" guard) -- that lands in .dz-status, not the
  // .alert-warn this tool's own parseCsvInput()-driven errors use below.
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   \n  ');
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});

test('csv-to-json: uploading a whitespace-only file shows this tool\'s own "empty" error, not a raw exception', async () => {
  // Unlike the pasted-text path above, an uploaded file's content is never
  // pre-checked by dropzone.client.js's own guard (that guard only covers
  // the pasteTextarea/pasteButton path) - this exercises this tool's own
  // parseCsvInput() "that's empty" branch for real.
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'blank.csv'));
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /empty/i);
  await page.close();
});

test('csv-to-json: a header-only CSV with no data rows is rejected with a specific message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'name,price');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /header row plus at least one data row/i);
  await page.close();
});
