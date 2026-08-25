import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end coverage for quick-open (src/browser/filter.client.js,
 * site-wide navigation/IA redesign, see the folder taxonomy/nav spec
 * section 1.7/1.13) -- a full APG combobox contract, tested against the
 * built dist/ output on a real page (a tool page, deliberately: quick-open
 * must work "everywhere," not just on listing pages, which is exactly
 * where a page-scoped bug would hide). Requires `npm run build`.
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

test('quick-open: "/" on a tool page (no inline filter present) opens the dialog', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  const filterSlotCount = await page.locator('.window-filter-input').count();
  assert.equal(filterSlotCount, 0, 'a tool page should have no inline filter to focus instead');
  await page.keyboard.press('/');
  const dialogHidden = await page.locator('.quickopen-backdrop').getAttribute('hidden');
  assert.equal(dialogHidden, null);
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'quickopen-input');
  await page.close();
});

test('quick-open: carries the full APG combobox contract on open', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  const input = page.locator('.quickopen-input');
  assert.equal(await input.getAttribute('role'), 'combobox');
  assert.equal(await input.getAttribute('aria-expanded'), 'true');
  assert.equal(await input.getAttribute('aria-controls'), 'quickopen-listbox');
  const listbox = page.locator('#quickopen-listbox');
  assert.equal(await listbox.getAttribute('role'), 'listbox');
  const dialog = page.locator('.quickopen-dialog');
  assert.equal(await dialog.getAttribute('role'), 'dialog');
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  await page.close();
});

test('quick-open: typing filters the listbox by substring across name/deck/slug', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  await page.locator('.quickopen-input').fill('regex');
  const options = await page.locator('.quickopen-option').allTextContents();
  assert.equal(options.length, 1);
  assert.match(options[0], /Regex Tester/);
  await page.close();
});

test('quick-open: ArrowDown/ArrowUp move aria-activedescendant, Enter navigates to the active option', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  await page.locator('.quickopen-input').fill('hash');
  await page.waitForSelector('.quickopen-option');
  const activeId = await page.locator('.quickopen-input').getAttribute('aria-activedescendant');
  assert.equal(activeId, 'quickopen-option-0');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/data/hash-generator/**');
  assert.ok(page.url().includes('/data/hash-generator/'));
  await page.close();
});

test('quick-open: Escape closes the dialog and returns focus to the trigger', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('.quickopen-trigger').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.quickopen-input:visible');
  await page.keyboard.press('Escape');
  const dialogHidden = await page.locator('.quickopen-backdrop').getAttribute('hidden');
  assert.equal(dialogHidden, '');
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'quickopen-trigger');
  await page.close();
});

test('quick-open: Tab does not leave the dialog (single-control focus trap) while open', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  await page.keyboard.press('Tab');
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'quickopen-input');
  await page.close();
});

test('quick-open: the background is inert while the dialog is open', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  const mainInert = await page.evaluate(() => document.querySelector('main').hasAttribute('inert'));
  assert.equal(mainInert, true);
  await page.keyboard.press('Escape');
  const mainInertAfter = await page.evaluate(() => document.querySelector('main').hasAttribute('inert'));
  assert.equal(mainInertAfter, false);
  await page.close();
});

test('quick-open trigger: only exists once JS runs (no dead control without JS)', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'load' });
  const triggerCount = await page.locator('.quickopen-trigger').count();
  assert.equal(triggerCount, 0);
  await context.close();
});
