import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * The explicit injection regression test named in the architect spec
 * (site-wide navigation/IA redesign, section 4 SECURITY): the filter/
 * quick-open query string is untrusted visitor input, and must only ever
 * reach the DOM via textContent, never innerHTML. Typing an
 * `<img src=x onerror=...>`-shaped string into either surface must
 * produce zero script execution and zero network requests triggered by
 * that payload. Requires `npm run build`.
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

const PAYLOAD = '<img src=x onerror=window.__xss=true>';

test('security: the inline filter never executes an injected <img onerror> payload', async () => {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.fill('.window-filter-input', PAYLOAD);
  await page.waitForSelector('.window-empty-row:visible');

  const fired = await page.evaluate(() => window.__xss === true);
  assert.equal(fired, false, 'onerror handler must never execute');
  const rawInHtml = await page.evaluate(() => document.querySelector('.window-empty-row').innerHTML.includes('<img'));
  assert.equal(rawInHtml, false, 'the payload must be text-escaped, never a real <img> element');
  const suspiciousRequests = requests.filter((u) => u.includes('/x') || u.endsWith('x'));
  assert.deepEqual(suspiciousRequests, []);
  await page.close();
});

test('security: quick-open never executes an injected <img onerror> payload', async () => {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });

  await page.keyboard.press('/');
  await page.locator('.quickopen-input').fill(PAYLOAD);
  await page.waitForSelector('.quickopen-empty:visible');

  const fired = await page.evaluate(() => window.__xss === true);
  assert.equal(fired, false, 'onerror handler must never execute');
  const rawInHtml = await page.evaluate(() => document.querySelector('.quickopen-empty').innerHTML.includes('<img'));
  assert.equal(rawInHtml, false, 'the payload must be text-escaped, never a real <img> element');
  const suspiciousRequests = requests.filter((u) => u.includes('/x') || u.endsWith('x'));
  assert.deepEqual(suspiciousRequests, []);
  await page.close();
});
