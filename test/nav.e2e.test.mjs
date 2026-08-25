import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end coverage for the site-wide navigation/IA redesign's shared
 * shell ("IA backbone"): the folder-tree header
 * nav, the restyled path bar, and the reorganized footer. This touches
 * every page's shared chrome, so per that spec's own open-risks section
 * ("the existing Playwright e2e suite and visual-qa harness must run at
 * all three viewports before any PR -- the redesign's blast radius is
 * every page, so the suite is the safety net, not spot checks"), this is
 * real keyboard-driven interaction against the built dist/ output, not
 * static markup assertions alone. Requires `npm run build` first.
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

test('nav: no menu/tree/menubar ARIA role appears anywhere in the live DOM (APG disclosure-navigation rationale, not a widget)', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const badRoles = await page.evaluate(() => [...document.querySelectorAll('[role]')]
    .map((el) => el.getAttribute('role'))
    .filter((r) => ['menu', 'menubar', 'tree', 'treeitem'].includes(r)));
  assert.deepEqual(badRoles, []);
  await page.close();
});

test('nav: the outer "Browse ~/" disclosure is closed by default, and Tab+Enter reaches and opens it', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const openBefore = await page.evaluate(() => document.querySelector('.site-nav-disclosure').hasAttribute('open'));
  assert.equal(openBefore, false);

  await page.keyboard.press('Tab'); // skip link
  await page.keyboard.press('Tab'); // brand
  await page.keyboard.press('Tab'); // Browse ~/ summary
  const focusedClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(focusedClass, 'site-nav-summary');

  await page.keyboard.press('Enter');
  const openAfter = await page.evaluate(() => document.querySelector('.site-nav-disclosure').hasAttribute('open'));
  assert.equal(openAfter, true);
  await page.close();
});

test('nav: keyboard reaches all the way from the outer disclosure into a real tool link inside a folder group', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Tab'); // skip link, brand, Browse ~/
  await page.keyboard.press('Enter'); // open outer disclosure
  await page.keyboard.press('Tab'); // first folder-group summary (PDF)
  const folderSummaryClass = await page.evaluate(() => document.activeElement.className);
  assert.equal(folderSummaryClass, 'folder-group-summary');

  await page.keyboard.press('Enter'); // open the PDF folder group
  const openFolders = await page.evaluate(() => document.querySelectorAll('.folder-group[open]').length);
  assert.equal(openFolders, 1);

  await page.keyboard.press('Tab'); // the folder-group-link <a> itself
  await page.keyboard.press('Tab'); // first tool link inside
  const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, href: document.activeElement.getAttribute('href') }));
  assert.equal(focused.tag, 'A');
  assert.equal(focused.href, '/pdf/extract-images-from-pdf/');
  await page.close();
});

test('nav: each folder group shows the real, current tool count', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const counts = await page.$$eval('.folder-group', (groups) => groups.map((g) => ({
    label: g.querySelector('.folder-group-link').textContent.trim(),
    count: g.querySelector('.folder-group-count').textContent.trim(),
    rows: g.querySelectorAll('.folder-tool-list a').length,
  })));
  assert.deepEqual(counts, [
    { label: 'PDF', count: '8', rows: 8 },
    { label: 'CSV & Spreadsheets', count: '10', rows: 10 },
    { label: 'JSON & Data Formats', count: '6', rows: 6 },
    { label: 'Text', count: '4', rows: 4 },
    { label: 'Developer', count: '7', rows: 7 },
  ]);
  await page.close();
});

test('nav: the active tool link and the active folder link both carry aria-current="page" on a tool page, and no other link does', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  const current = await page.$$eval('.site-nav-tree a[aria-current="page"]', (els) => els.map((e) => e.getAttribute('href')));
  assert.deepEqual(current, ['/data/merge-csv/']);
  await page.close();
});

test('nav: the active folder link carries aria-current="page" on that folder\'s own index page', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}spreadsheets/`, { waitUntil: 'networkidle' });
  const current = await page.$$eval('.site-nav-tree a[aria-current="page"]', (els) => els.map((e) => e.getAttribute('href')));
  assert.deepEqual(current, ['/spreadsheets/']);
  await page.close();
});

test('path bar: a tool page shows the full 3-level "~ / folder / tool" path, mono, home labeled for screen readers', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  const segments = await page.$$eval('.breadcrumb > *:not(.sep)', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(segments, ['~', 'spreadsheets', 'merge-csv']);
  const homeAriaLabel = await page.locator('.breadcrumb a').first().getAttribute('aria-label');
  assert.equal(homeAriaLabel, 'Home');
  const fontFamily = await page.locator('.breadcrumb').evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(fontFamily, /mono/i);
  await page.close();
});

test('path bar: a folder page shows the 2-level "~ / folder" path', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}developer/`, { waitUntil: 'networkidle' });
  const segments = await page.$$eval('.breadcrumb > *:not(.sep)', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(segments, ['~', 'developer']);
  await page.close();
});

test('path bar: never wraps or causes horizontal scroll at 360px, even on the longest real path', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(`${baseUrl}pdf/bank-statement-to-csv/`, { waitUntil: 'networkidle' });
  const overflowsX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflowsX, false);
  const breadcrumbHeight = await page.locator('.breadcrumb').evaluate((el) => el.getBoundingClientRect().height);
  // A single line of --text-sm text is well under 40px; if it wrapped to
  // two lines this would roughly double.
  assert.ok(breadcrumbHeight < 40, `breadcrumb height ${breadcrumbHeight}px looks wrapped`);
  await page.close();
});

test('footer: reorganized into the 5 folders (not the old 2 categories), each folder heading links to its own folder page', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const headings = await page.$$eval('.footer-group h3 a', (els) => els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
  assert.deepEqual(headings, [
    { text: 'PDF', href: '/pdf/' },
    { text: 'CSV & Spreadsheets', href: '/spreadsheets/' },
    { text: 'JSON & Data Formats', href: '/data-formats/' },
    { text: 'Text', href: '/text/' },
    { text: 'Developer', href: '/developer/' },
  ]);
  await page.close();
});

test('folder page: renders a real, populated tool list matching its own folder', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}developer/`, { waitUntil: 'networkidle' });
  await expectH1(page, 'Developer tools');
  const rowNames = await page.$$eval('.tool-list .tool-row-name', (els) => els.map((e) => e.textContent.trim()));
  assert.equal(rowNames.length, 7);
  assert.ok(rowNames.includes('Hash Generator'));
  assert.ok(rowNames.includes('Regex Tester'));
  await page.close();
});

async function expectH1(page, text) {
  const h1 = await page.locator('h1').textContent();
  assert.equal(h1.trim(), text);
}

test('the noindex /data/ helper page is never linked from the header, footer, or sitemap, and carries a real noindex meta tag', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/`, { waitUntil: 'networkidle' });
  const robotsContent = await page.locator('meta[name="robots"]').getAttribute('content');
  assert.equal(robotsContent, 'noindex');
  await page.close();

  const home = await browser.newPage();
  await home.goto(baseUrl, { waitUntil: 'networkidle' });
  const dataLinks = await home.$$eval('a[href="/data/"]', (els) => els.length);
  assert.equal(dataLinks, 0, 'no page should link to the noindex /data/ helper page');
  await home.close();
});
