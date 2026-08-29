import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for jwt-decoder: drive the built dist/ output in a real
 * headless browser. Like jsonDiff.e2e.test.mjs/textDiff.e2e.test.mjs, this
 * tool has no dropzone/paste-convert flow -- src/browser/jwtDecode.client.js
 * builds its own live single-textarea panel directly (customPanelMode).
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
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

test('jwt-decoder: the page renders the default example token, already decoded, immediately on load', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /decoded/i);

  const previews = await page.locator('.result .json-preview').allTextContents();
  assert.ok(previews.some((t) => t.includes('"alg"') && t.includes('HS256')));
  assert.ok(previews.some((t) => t.includes('"sub"')));

  assert.deepEqual(errors, []);
  await page.close();
});

test('jwt-decoder: pasting a real, freshly-built token decodes its own real header and payload live', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  const token = await page.evaluate(() => {
    const enc = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${enc({ alg: 'none' })}.${enc({ sub: 'live-test-user' })}.${enc({}).slice(0, 4)}`;
  });

  await page.locator('.result textarea').fill(token);
  await page.waitForFunction(() => [...document.querySelectorAll('.result .json-preview')].some((el) => el.textContent.includes('live-test-user')));

  const previews = await page.locator('.result .json-preview').allTextContents();
  assert.ok(previews.some((t) => t.includes('"alg"') && t.includes('none')));
  assert.ok(previews.some((t) => t.includes('live-test-user')));
  await page.close();
});

test('jwt-decoder: an expired exp claim is flagged as expired in the rendered time-claims list', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  const token = await page.evaluate(() => {
    const enc = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${enc({ alg: 'none' })}.${enc({ exp: 1704067200 })}.sig`;
  });

  await page.locator('.result textarea').fill(token);
  await page.waitForFunction(() => [...document.querySelectorAll('.result .page-badge')].some((el) => el.textContent.toLowerCase().includes('expired')));

  const claimsText = (await page.locator('.result .page-badge').allTextContents()).join(' ');
  assert.match(claimsText, /expired/i);
  assert.match(claimsText, /2024-01-01/);
  await page.close();
});

test('jwt-decoder: pasting something with the wrong number of parts shows a specific error naming the real count', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  await page.locator('.result textarea').fill('not.a.real.jwt.at.all');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('has 6'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /has 6/);
  await page.close();
});

test('jwt-decoder: clearing the box shows a friendly prompt, not a blank or broken panel', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  await page.locator('.result textarea').fill('');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').toLowerCase().includes('paste a jwt'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /paste a jwt/i);
  assert.deepEqual(errors, []);
  await page.close();
});

test('jwt-decoder: the signature segment is shown as raw text with an explicit not-verified note, never treated as JSON', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/jwt-decoder/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-preview');

  const bodyText = await page.locator('.result').textContent();
  assert.match(bodyText, /not verified/i);
  await page.close();
});
