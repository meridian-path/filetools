import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the QR code generator: drive the built dist/
 * output in a real headless browser. Like uuidGenerator.e2e.test.mjs, this
 * tool has no dropzone/paste-convert flow -- src/browser/
 * qrCodeGenerator.client.js builds its own live panel directly
 * (customPanelMode). The real-correctness check throughout is a genuine
 * QR decode: pull the rendered canvas's real pixel data out of the page
 * and run it through jsQR (a real, independent QR decoder, devDependency-
 * only -- never shipped to the browser) to confirm the code actually
 * decodes back to what was typed, not just that a canvas exists. Requires
 * `npm run build` to have already produced dist/.
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

/**
 * Pulls the real rendered canvas's pixel data out of the page and decodes
 * it with jsQR -- an independent decoder from the vendored encoder, so
 * this proves an actual scannable QR code was produced, not just that
 * SOME canvas content exists.
 */
async function decodeRenderedQr(page) {
  const { width, height, data } = await page.evaluate(() => {
    const canvas = document.querySelector('.qr-preview-canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: [...imageData.data] };
  });
  const result = jsQR(new Uint8ClampedArray(data), width, height);
  assert.ok(result, 'jsQR failed to decode the rendered canvas at all');
  return result.data;
}

test('qr-code-generator: the default text loads and decodes to the real default URL, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'https://example.com');

  assert.deepEqual(errors, []);
  await page.close();
});

test('qr-code-generator: editing the text re-encodes live with no button click, and the new code decodes correctly', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.fill('.result textarea', 'hello world, this is a real test string');
  await page.waitForFunction(() => (document.querySelector('.result .caption')?.textContent || '').includes('hello world'));

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'hello world, this is a real test string');
  await page.close();
});

test('qr-code-generator: non-ASCII text (accented characters) round-trips correctly through the real UTF-8 encoder', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.fill('.result textarea', 'café münchen');
  await page.waitForFunction(() => (document.querySelector('.result .caption')?.textContent || '').includes('café'));

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'café münchen');
  await page.close();
});

test('qr-code-generator: switching to Wi-Fi mode builds the correct escaped WIFI: payload and it decodes back correctly', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.selectOption('.result select >> nth=0', 'wifi');
  const ssidInput = page.locator('.result input[type="text"]').first();
  await ssidInput.fill('My;Network');
  const passwordInput = page.locator('.result input[type="text"]').nth(1);
  await passwordInput.fill('sup3r;secret');

  await page.waitForFunction(() => (document.querySelector('.result .caption')?.textContent || '').includes('My\\;Network'));

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'WIFI:T:WPA;S:My\\;Network;P:sup3r\\;secret;H:false;;');
  await page.close();
});

test('qr-code-generator: an open (no-password) Wi-Fi network omits the password field from the payload', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.selectOption('.result select >> nth=0', 'wifi');
  await page.locator('.result input[type="text"]').first().fill('FreeWifi');
  await page.selectOption('.result select >> nth=2', 'nopass');

  await page.waitForFunction(() => (document.querySelector('.result .caption')?.textContent || '').includes('T:nopass;S:FreeWifi'));

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'WIFI:T:nopass;S:FreeWifi;H:false;;');
  assert.ok(!decoded.includes('P:'));
  await page.close();
});

test('qr-code-generator: an empty text box shows a friendly message, no canvas', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.fill('.result textarea', '');
  await page.waitForFunction(() => document.querySelectorAll('.result .qr-preview-canvas').length === 0);

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /enter some text/i);
  await page.close();
});

test('qr-code-generator: text over the size cap shows a friendly refusal instead of a raw library error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  const tooLong = await page.evaluate(() => 'x'.repeat(1600));
  await page.fill('.result textarea', tooLong);
  await page.waitForFunction(() => document.querySelectorAll('.result .qr-preview-canvas').length === 0);

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /1500/);
  await page.close();
});

test('qr-code-generator: the Download PNG button downloads a real PNG file', async () => {
  const page = await browser.newContext({ acceptDownloads: true }).then((ctx) => ctx.newPage());
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Download PNG")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'qrcode.png');
  const bytes = fs.readFileSync(await download.path());
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await page.close();
});

test('qr-code-generator: the Download SVG button downloads real, valid SVG markup', async () => {
  const page = await browser.newContext({ acceptDownloads: true }).then((ctx) => ctx.newPage());
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Download SVG")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'qrcode.svg');
  const text = fs.readFileSync(await download.path(), 'utf8');
  assert.match(text, /^<svg /);
  assert.match(text, /<path /);
  await page.close();
});

test('qr-code-generator: changing the error-correction level re-encodes and still decodes correctly', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/qr-code-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .qr-preview-canvas');

  await page.selectOption('.result select >> nth=1', 'H');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('ready'));

  const decoded = await decodeRenderedQr(page);
  assert.equal(decoded, 'https://example.com');
  await page.close();
});
