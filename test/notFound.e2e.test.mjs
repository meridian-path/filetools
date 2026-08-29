import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end coverage for the 404 page, restyled as the explorer's
 * not-found state (site-wide navigation/IA redesign, see the folder
 * taxonomy/nav spec section 1.9). Requires `npm run build`.
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

test('404: real noindex meta, "~ / not found" path bar, and h1 "File not found"', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}404.html`, { waitUntil: 'networkidle' });
  const robotsContent = await page.locator('meta[name="robots"]').getAttribute('content');
  assert.equal(robotsContent, 'noindex');
  const segments = await page.$$eval('.breadcrumb > *:not(.sep)', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(segments, ['~', 'not found']);
  const h1 = await page.locator('h1').textContent();
  assert.equal(h1.trim(), 'File not found');
  await page.close();
});

test('404: the window lists all six folders as rows, and the status bar names the real total tool count', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}404.html`, { waitUntil: 'networkidle' });
  const labels = await page.$$eval('.window-sidebar-row .window-sidebar-label', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(labels, ['PDF', 'CSV & Spreadsheets', 'JSON & Data Formats', 'Text', 'Developer', 'Image']);
  const statusText = await page.locator('[data-window-status]').textContent();
  assert.match(statusText, /^0 of \d+ files at this path$/);
  await page.close();
});

test('404: has no inline filter (quick-open is the search surface here instead)', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}404.html`, { waitUntil: 'networkidle' });
  const filterCount = await page.locator('.window-filter-input').count();
  assert.equal(filterCount, 0);
  await page.keyboard.press('/');
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'quickopen-input');
  await page.close();
});
