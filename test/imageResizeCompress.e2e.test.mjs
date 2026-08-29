import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the Image Resize/Compress tool: drive the built
 * dist/ output in a real headless browser, drop a real image fixture, and
 * verify the actual downloaded file's real decoded dimensions/magic bytes
 * -- not just that a download happened. Mirrors
 * test/imagesToPdf.e2e.test.mjs's "generate the fixture via a real
 * canvas.toDataURL() call in an actual browser page" approach for both the
 * PNG and JPEG fixtures, rather than hand-encoding either format's bytes.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
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

/**
 * @param {Buffer} bytes a real PNG file's bytes.
 * @returns {{width:number, height:number}} read directly from the IHDR
 *   chunk (signature 8 bytes, length 4 bytes, type 4 bytes, then width and
 *   height as 4-byte big-endian integers each) -- the real decoded
 *   dimensions, not an assumption.
 */
function readPngDimensions(bytes) {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

const JPEG_SOI = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

let server;
let browser;
let baseUrl;
const SRC_WIDTH = 8;
const SRC_HEIGHT = 4;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();

  // A real, non-square (2:1) PNG with real alpha transparency, generated
  // via canvas.toDataURL in an actual browser page rather than hand-
  // encoded bytes -- same reasoning as imagesToPdf.e2e.test.mjs's own JPEG
  // fixture comment.
  const fixturePage = await browser.newPage();
  await fixturePage.goto('about:blank');
  const pngDataUrl = await fixturePage.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(200, 40, 40, 0.5)';
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL('image/png');
  }, { w: SRC_WIDTH, h: SRC_HEIGHT });
  fs.writeFileSync(path.join(TMP, 'photo.png'), Buffer.from(pngDataUrl.split(',')[1], 'base64'));
  await fixturePage.close();

  fs.writeFileSync(path.join(TMP, 'not-a-real-image.jpg'), 'this is not a real jpeg');
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('image-resize-compress: dropping an image fills the width/height fields with its real natural dimensions', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo.png'));
  await page.waitForSelector('.image-resize-stats span');

  assert.equal(await page.locator('#resize-width').inputValue(), String(SRC_WIDTH));
  assert.equal(await page.locator('#resize-height').inputValue(), String(SRC_HEIGHT));
  assert.deepEqual(errors, []);
  await page.close();
});

test('image-resize-compress: with aspect ratio locked, editing width recomputes height, and the real downloaded PNG matches those exact dimensions', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo.png'));
  await page.waitForSelector('.image-resize-stats span');

  await page.locator('#resize-width').fill('4');
  // The debounced re-render fires ~200ms after the last input event --
  // wait for the locked height field to actually update rather than
  // asserting immediately.
  await page.waitForFunction(() => document.getElementById('resize-height').value === '2');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const outPath = path.join(TMP, 'locked-out.png');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 4)], PNG_SIGNATURE);
  assert.deepEqual(readPngDimensions(bytes), { width: 4, height: 2 });
  await page.close();
});

test('image-resize-compress: turning off aspect lock allows an independent width and height, verified in the real downloaded file', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo.png'));
  await page.waitForSelector('.image-resize-stats span');

  await page.locator('#lock-aspect-ratio').uncheck();
  await page.locator('#resize-width').fill('6');
  await page.locator('#resize-height').fill('6');
  await page.waitForTimeout(400); // clear of the 200ms debounce

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const outPath = path.join(TMP, 'unlocked-out.png');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  // A square output from a 2:1 source is only reachable with the lock off
  // -- this is the real, distinguishing proof the checkbox does something,
  // not just that it's checked/unchecked in the DOM.
  assert.deepEqual(readPngDimensions(bytes), { width: 6, height: 6 });
  await page.close();
});

test('image-resize-compress: switching the output format to JPG shows the quality slider and downloads a real JPEG', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo.png'));
  await page.waitForSelector('.image-resize-stats span');

  assert.equal(await page.locator('.quality-control').isVisible(), false, 'PNG is lossless -- quality control should start hidden');

  await page.locator('#output-format').selectOption('jpeg');
  await page.waitForFunction(() => !document.querySelector('.quality-control').hidden);
  assert.equal(await page.locator('.quality-control').isVisible(), true);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const outPath = path.join(TMP, 'format-out.jpg');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], JPEG_SOI);
  assert.ok(download.suggestedFilename().endsWith('.jpg'), `expected a .jpg download name, got "${download.suggestedFilename()}"`);
  await page.close();
});

test('image-resize-compress: "Reset to original size" restores the natural dimensions after they were changed', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo.png'));
  await page.waitForSelector('.image-resize-stats span');

  await page.locator('#resize-width').fill('2');
  await page.waitForFunction(() => document.getElementById('resize-height').value === '1');

  await page.locator('button:has-text("Reset to original size")').click();
  assert.equal(await page.locator('#resize-width').inputValue(), String(SRC_WIDTH));
  assert.equal(await page.locator('#resize-height').inputValue(), String(SRC_HEIGHT));
  await page.close();
});

test('image-resize-compress: a corrupt/invalid image file shows a friendly error, never a crash', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/image-resize-compress/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-a-real-image.jpg'));

  const status = page.locator('.dz-status');
  await page.waitForFunction(
    (el) => el && el.textContent && el.textContent.length > 0,
    await status.elementHandle(),
  );
  const statusText = await status.textContent();
  assert.match(statusText, /doesn.t look like a valid image/);
  assert.deepEqual(errors, []);
  await page.close();
});
