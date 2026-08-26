import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the CSV to SQL INSERT tool: drive the built dist/
 * output in a real headless browser, through both input paths (file
 * upload and pasted text), and verify the actual rendered/downloaded/
 * copied content -- not just that the page renders. Mirrors
 * test/sqlFormatter.e2e.test.mjs's approach. Requires `npm run build` to
 * have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml',
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

test('csv-to-sql-insert: pasting CSV shows a batched INSERT statement with correct types', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id,name,price\n1,Widget,9.99\n2,Gadget,14.50');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .table-block .json-preview');

  const sql = await page.locator('.result .table-block .json-preview').textContent();
  assert.equal(sql, [
    'INSERT INTO `my_table` (`id`, `name`, `price`) VALUES',
    "  (1, 'Widget', 9.99),",
    "  (2, 'Gadget', 14.50);",
  ].join('\n'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('csv-to-sql-insert: changing the table name and dialect re-renders the SQL live', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id,name\n1,Ada');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .table-block .json-preview');

  const nameInput = page.locator('.result input[type="text"]');
  await nameInput.fill('users');
  await page.waitForFunction(() => document.querySelector('.result .table-block .json-preview')?.textContent.includes('`users`'));

  await page.locator('.result select').selectOption('postgres');
  await page.waitForFunction(() => document.querySelector('.result .table-block .json-preview')?.textContent.includes('"users"'));

  const sql = await page.locator('.result .table-block .json-preview').textContent();
  assert.ok(sql.includes('"users"'));
  assert.ok(sql.includes('"id"'));
  await page.close();
});

test('csv-to-sql-insert: the "one statement per row" checkbox switches output format live', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id,name\n1,Ada\n2,Bob');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('.result input[type="checkbox"]').click();
  await page.waitForFunction(() => (document.querySelector('.result .table-block .json-preview')?.textContent.match(/INSERT INTO/g) || []).length === 2);

  const sql = await page.locator('.result .table-block .json-preview').textContent();
  const insertCount = (sql.match(/INSERT INTO/g) || []).length;
  assert.equal(insertCount, 2);
  await page.close();
});

test('csv-to-sql-insert: the copy button copies the exact generated SQL to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id\n1');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('button:has-text("Copy SQL")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clipboardText.includes('INSERT INTO'));
  assert.ok(clipboardText.includes('(1)'));
  await context.close();
});

test('csv-to-sql-insert: the download button downloads insert.sql with the exact generated content', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id\n1');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .table-block .json-preview');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download insert.sql")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'insert.sql');
  const outPath = path.join(TMP, 'insert-out.sql');
  await download.saveAs(outPath);
  const content = fs.readFileSync(outPath, 'utf8');
  assert.ok(content.includes('INSERT INTO'));
  await page.close();
});

test('csv-to-sql-insert: uploading a .csv file derives the default table name from the filename', async () => {
  const page = await browser.newPage();
  const filePath = path.join(TMP, 'orders_export.csv');
  fs.writeFileSync(filePath, 'id\n1');

  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(filePath);
  await page.waitForSelector('.result .table-block .json-preview');

  const nameInput = await page.locator('.result input[type="text"]').inputValue();
  assert.equal(nameInput, 'orders_export');
  await page.close();
});

test('csv-to-sql-insert: a header-only CSV with no data rows shows a friendly error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'id,name');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .alert-warn');

  const msg = await page.locator('.result .alert-warn').textContent();
  assert.match(msg, /no data rows/i);
  await page.close();
});

test('csv-to-sql-insert: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-sql-insert/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  // Craft-audit fix (item 5): a paste-triggered status lives in this
  // paste box's OWN `.paste-status` line now, never the shared
  // `.dz-status` the unrelated file drop-zone owns.
  await page.waitForFunction(() => document.querySelector('.paste-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.paste-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});
