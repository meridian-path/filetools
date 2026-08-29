import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end test for the footer's newsletter signup (src/shell.js's
 * renderNewsletterSignup): a craft-audit fix (2026-08-29 reference-library
 * audit) removed the third-party Substack iframe this used to lazy-load on
 * scroll (it rendered that provider's own dark avatar tile, publication
 * name, and orange "Subscribe" button on every one of this site's pages,
 * clashing with the site's own one-accent-per-view design rule). The signup is now
 * a plain, always-rendered outbound link with no JS dependency at all --
 * these tests prove no third-party request ever fires from this link
 * merely being on the page.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
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
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('newsletter signup: renders a real, visible link immediately, no iframe, no JS dependency', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseUrl);

  const link = page.locator('.newsletter-signup a[href="https://builtittheycome.substack.com"]');
  await assert.doesNotReject(link.waitFor({ state: 'visible' }));
  assert.equal(await link.textContent(), 'Subscribe on Substack');
  assert.equal(await page.locator('.newsletter-signup iframe').count(), 0);

  await page.close();
  await context.close();
});

test('newsletter signup: no request to substack.com ever fires merely from loading and scrolling the page -- the link is outbound-only', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 400 } });
  const substackRequests = [];
  page.on('request', (req) => {
    if (/substack\.com/.test(req.url())) substackRequests.push(req.url());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.newsletter-signup').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  assert.equal(await page.locator('.newsletter-signup iframe').count(), 0);
  assert.deepEqual(substackRequests, []);

  await page.close();
});
