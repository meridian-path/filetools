import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import yaml from 'js-yaml';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the JSON-to-YAML tool: drive the built dist/ output
 * in a real headless browser, through both input paths, and verify the
 * actual downloaded YAML by parsing it back with the real js-yaml npm
 * package - not just that a download happened. Mirrors
 * test/jsonToCsv.e2e.test.mjs's approach for the sibling reverse-direction
 * tool.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
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
  fs.writeFileSync(path.join(TMP, 'record.json'), JSON.stringify({ name: 'Widget', price: 9.5, tags: ['a', 'b'] }));

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('json-to-yaml: uploading a .json file converts it and downloads YAML that parses back to the same real value', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-to-yaml/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'record.json'));
  await page.waitForSelector('.table-block .json-preview');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.yaml');
  const outPath = path.join(TMP, 'converted-out.yaml');
  await download.saveAs(outPath);

  // Real round-trip, not a substring match: parse the actual downloaded
  // YAML back with the real js-yaml package and compare to the original
  // value.
  const parsedBack = yaml.load(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(parsedBack, { name: 'Widget', price: 9.5, tags: ['a', 'b'] });
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-to-yaml: pasting JSON and clicking convert produces the same result', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-to-yaml/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a":1,"b":[1,2,3]}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(yaml.load(previewText), { a: 1, b: [1, 2, 3] });
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-to-yaml: pasting invalid JSON shows a friendly error instead of a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-to-yaml/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{not valid json');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /valid json/i);
  await page.close();
});

test('json-to-yaml: a bare JSON array (not an object) converts correctly, unlike json-to-csv which requires an array of objects', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-to-yaml/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '[1,2,3]');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(yaml.load(previewText), [1, 2, 3]);
  await page.close();
});
