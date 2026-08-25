import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end coverage for the inline listing-page filter
 * (src/browser/filter.client.js, site-wide navigation/IA redesign, see
 * the folder taxonomy/nav spec section 1.7/1.13). Real keyboard-driven
 * interaction against the built dist/ output. Requires `npm run build`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
  server = await startServer(DIST);
  baseUrl = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('filter: typing narrows visible tool rows by substring, and hides folder sections with zero matches', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const totalRows = await page.locator('.tool-row').count();
  assert.ok(totalRows > 10);

  await page.fill('.window-filter-input', 'merge pdf');
  const visibleRows = await page.locator('.tool-row:visible').count();
  assert.equal(visibleRows, 1);
  const visibleName = await page.locator('.tool-row:visible .tool-row-name').textContent();
  assert.equal(visibleName.trim(), 'Merge PDF');

  const visibleSections = await page.locator('.window-section:visible').count();
  assert.equal(visibleSections, 1);
  await page.close();
});

test('filter: the status bar (aria-live) reports "N of M files match" while filtering, and reverts when cleared', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const totalRows = await page.locator('.tool-row').count();
  const defaultStatus = await page.locator('[data-window-status]').textContent();

  await page.fill('.window-filter-input', 'csv');
  const filteredStatus = await page.locator('[data-window-status]').textContent();
  assert.match(filteredStatus, /^\d+ of \d+ files match$/);

  await page.fill('.window-filter-input', '');
  const revertedStatus = await page.locator('[data-window-status]').textContent();
  assert.equal(revertedStatus.trim(), defaultStatus.trim());
  await page.close();
});

test('filter: zero matches shows a visible empty-state row with a working Clear button', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.fill('.window-filter-input', 'zzz-not-a-real-tool');
  const emptyRow = page.locator('.window-empty-row');
  await assertVisible(emptyRow);
  const emptyText = await emptyRow.locator('span').first().textContent();
  assert.match(emptyText, /no files match/i);

  await emptyRow.locator('.window-empty-clear').click();
  const inputValue = await page.locator('.window-filter-input').inputValue();
  assert.equal(inputValue, '');
  const visibleRows = await page.locator('.tool-row:visible').count();
  assert.ok(visibleRows > 10, 'clearing should restore every row');
  await page.close();
});

test('filter: "/" focuses the filter input (ignored while another input already has focus)', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'window-filter-input');
  await page.close();
});

test('filter: Escape clears the query and blurs the field in one press', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.fill('.window-filter-input', 'pdf');
  await page.locator('.window-filter-input').focus();
  await page.keyboard.press('Escape');
  const value = await page.locator('.window-filter-input').inputValue();
  assert.equal(value, '');
  const isFocused = await page.evaluate(() => document.activeElement === document.querySelector('.window-filter-input'));
  assert.equal(isFocused, false);
  await page.close();
});

test('filter: also works on a folder page (single flat section, no sidebar)', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}spreadsheets/`, { waitUntil: 'networkidle' });
  await page.fill('.window-filter-input', 'merge csv');
  const visibleRows = await page.locator('.tool-row:visible').count();
  assert.equal(visibleRows, 1);
  await page.close();
});

async function assertVisible(locator) {
  assert.equal(await locator.isVisible(), true);
}
