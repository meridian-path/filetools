import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the SQL formatter tool: drive the built dist/
 * output in a real headless browser, through both input paths (file
 * upload and pasted text), and verify the actual rendered/downloaded/
 * copied content -- not just that the page renders. Mirrors
 * test/jsonMinifyBeautify.e2e.test.mjs's approach. Requires `npm run
 * build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
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
// ../src/browser/sqlFormatter.client.js) rather than bare '.json-preview',
// because this tool's page also renders a second, static '.json-preview'
// inside its build-time output-example panel -- same scoping fix
// test/urlEncode.e2e.test.mjs already applies.

test('sql-formatter: pasting SQL shows both the beautified and minified panels, updated live', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'select id, name from users where active = true');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.count(), 2);
  assert.equal(await panels.nth(0).textContent(), 'SELECT id,\n  name\nFROM users\nWHERE active = TRUE');
  assert.equal(await panels.nth(1).textContent(), 'SELECT id, name FROM users WHERE active = TRUE');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sql-formatter: changing the dialect select re-renders both panels live without re-clicking convert', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'SELECT `id` FROM `users`');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const beautifiedPanel = page.locator('.dual-result-row .table-block .json-preview').first();
  // Default dialect (ansi) does not recognize backticks as identifier
  // quotes, so they tokenize as stray operator characters -- still
  // reflowed, just not preserved as one identifier token.
  const ansiText = await beautifiedPanel.textContent();
  assert.ok(ansiText.includes('id'), `expected id somewhere in ansi output, got: ${ansiText}`);

  await page.locator('.result select').selectOption('mysql');
  await page.waitForFunction(() => {
    const el = document.querySelector('.dual-result-row .table-block .json-preview');
    return el && el.textContent.includes('`id`');
  });
  assert.ok((await beautifiedPanel.textContent()).includes('`id`'));
  await page.close();
});

test('sql-formatter: the copy button copies the exact beautified text to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'select 1');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  await page.locator('button:has-text("Copy beautified")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, 'SELECT 1');
  await context.close();
});

test('sql-formatter: the download button downloads a .sql file with the exact minified content', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'select   1');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download minified.sql")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'minified.sql');
  const outPath = path.join(TMP, 'minified-out.sql');
  await download.saveAs(outPath);
  assert.equal(fs.readFileSync(outPath, 'utf8'), 'SELECT 1');
  await page.close();
});

test('sql-formatter: uploading a .sql file formats its contents', async () => {
  const page = await browser.newPage();
  const filePath = path.join(TMP, 'sample.sql');
  fs.writeFileSync(filePath, 'select a, b from t');

  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(filePath);
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.nth(1).textContent(), 'SELECT a, b FROM t');
  await page.close();
});

test('sql-formatter: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/sql-formatter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  // Craft-audit fix (item 5): a paste-triggered status lives in this
  // paste box's OWN `.paste-status` line now, never the shared
  // `.dz-status` the unrelated file drop-zone owns.
  await page.waitForFunction(() => document.querySelector('.paste-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.paste-status').textContent();
  assert.match(msg, /paste some sql first/i);
  await page.close();
});
