import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end coverage for the homepage explorer window (site-wide
 * navigation/IA redesign, see the folder taxonomy/nav spec section 1.5).
 * Real rendering against the built dist/ output. Requires `npm run build`.
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

test('homepage: the explorer window renders a sidebar row and a section for all five folders', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const sidebarLabels = await page.$$eval('.window-sidebar-row .window-sidebar-label', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(sidebarLabels, ['PDF', 'CSV & Spreadsheets', 'JSON & Data Formats', 'Text', 'Developer']);
  const sectionHeadings = await page.$$eval('.window-section-heading a', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(sectionHeadings, ['PDF', 'CSV & Spreadsheets', 'JSON & Data Formats', 'Text', 'Developer']);
  await page.close();
});

test('homepage: the chrome strip and status bar show the real, current tool count', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const toolCount = await page.$$eval('.tool-row', (els) => els.length);
  const countText = await page.locator('.window-count').textContent();
  const statusText = await page.locator('[data-window-status]').textContent();
  assert.equal(countText.trim(), `${toolCount} items`);
  assert.ok(statusText.includes(`${toolCount} files`));
  await page.close();
});

test('homepage: a >=768px viewport shows a Kind chip on each tool row naming its family', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const chip = await page.locator('.tool-row-kind').first();
  await assertVisible(chip);
  const chipText = await chip.textContent();
  assert.ok(['PDF', 'CSV', 'JSON', 'Sheet', 'Text', 'Dev'].includes(chipText.trim()));
  await page.close();
});

test('homepage: the hero CTA moves focus into the window on activation', async () => {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.hero-cta').click();
  const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
  assert.equal(activeId, 'explorer-window');
  await page.close();
});

test('homepage: window visible without scrolling at 1440x900 (chrome strip + first rows)', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const chromeBox = await page.locator('.window-chrome').boundingBox();
  assert.ok(chromeBox, 'window chrome strip should be present');
  assert.ok(chromeBox.y < 900, `window chrome strip at y=${chromeBox.y} should be visible without scrolling at 900px height`);
  const firstRowBox = await page.locator('.tool-row').first().boundingBox();
  assert.ok(firstRowBox.y < 900, `first tool row at y=${firstRowBox.y} should be visible without scrolling`);
  await page.close();
});

test('homepage: hero + window top reachable at 360x800 with no horizontal scroll', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const overflowsX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflowsX, false);
  const chromeBox = await page.locator('.window-chrome').boundingBox();
  assert.ok(chromeBox.y < 800, `window chrome strip at y=${chromeBox.y} should be reachable within the fold at 360x800`);
  await page.close();
});

async function assertVisible(locator) {
  assert.equal(await locator.isVisible(), true);
}
