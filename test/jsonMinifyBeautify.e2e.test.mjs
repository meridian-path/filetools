import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the JSON minify/beautify tool: drive the built
 * dist/ output in a real headless browser, through both input paths (file
 * upload and pasted text), and verify the actual rendered/downloaded/
 * copied content -- not just that the page renders. Mirrors
 * test/urlEncode.e2e.test.mjs's approach. Requires `npm run build` to have
 * already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
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
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

// Every '.json-preview' locator below is scoped to '.table-block' (the live
// result wrapper renderResult() appends -- see
// ../src/browser/jsonMinifyBeautify.client.js) rather than bare
// '.json-preview', because this tool's page also renders a second, static
// '.json-preview' inside its build-time output-example panel (see
// ../src/examples/json-minify-beautify.mjs) -- same scoping fix
// test/urlEncode.e2e.test.mjs already applies.

test('json-minify-beautify: pasting JSON shows both the minified and beautified panels, updated live', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a": 1, "b": [2, 3]}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.count(), 2);
  assert.equal(await panels.nth(0).textContent(), '{"a":1,"b":[2,3]}');
  assert.equal(await panels.nth(1).textContent(), '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-minify-beautify: an already-minified paste beautifies correctly', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"name":"Ada","active":true}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.nth(1).textContent(), '{\n  "name": "Ada",\n  "active": true\n}');
  await page.close();
});

test('json-minify-beautify: invalid JSON shows one friendly error, no result panels', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a": 1,}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .alert-warn');

  const errText = await page.locator('.result .alert-warn').textContent();
  assert.match(errText, /valid JSON/i);
  assert.equal(await page.locator('.dual-result-row').count(), 0);
  await page.close();
});

test('json-minify-beautify: changing the indent select re-renders the beautified panel live without re-clicking convert', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a":1}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const beautifiedPanel = page.locator('.dual-result-row .table-block .json-preview').nth(1);
  assert.equal(await beautifiedPanel.textContent(), '{\n  "a": 1\n}');

  await page.locator('.result .table-block-head select').selectOption('4');
  await page.waitForFunction(() => {
    const el = document.querySelectorAll('.dual-result-row .table-block .json-preview')[1];
    return el && el.textContent === '{\n    "a": 1\n}';
  });
  assert.equal(await beautifiedPanel.textContent(), '{\n    "a": 1\n}');
  await page.close();
});

test('json-minify-beautify: the copy button copies the minified text to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"x": 1}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  await page.locator('button:has-text("Copy minified")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, '{"x":1}');
  await context.close();
});

test('json-minify-beautify: the download button downloads a .json file with the exact beautified content', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"x":1}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download beautified.json")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'beautified.json');
  const outPath = path.join(TMP, 'beautified-out.json');
  await download.saveAs(outPath);
  assert.equal(fs.readFileSync(outPath, 'utf8'), '{\n  "x": 1\n}');
  await page.close();
});

test('json-minify-beautify: uploading a .json file minifies/beautifies its contents', async () => {
  const page = await browser.newPage();
  const filePath = path.join(TMP, 'sample.json');
  fs.writeFileSync(filePath, '{"k": "v"}');

  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(filePath);
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.nth(0).textContent(), '{"k":"v"}');
  await page.close();
});

test('json-minify-beautify: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-minify-beautify/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => document.querySelector('.dz-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});
