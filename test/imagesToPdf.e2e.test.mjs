import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the JPG/PNG-to-PDF tool: drive the built dist/
 * output in a real headless browser, against real image fixtures, and
 * verify the actual downloaded PDF's real page count/sizes via pdf-lib --
 * not just that the page renders. Mirrors test/csvMerge.e2e.test.mjs's
 * approach for the equivalent reorder-then-combine UI shape.
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

// A known-good, widely-used minimal 1x1 red PNG -- verified directly
// against the real pdf-lib package before use in this file.
const PNG_1PX_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'photo1.png'), Buffer.from(PNG_1PX_B64, 'base64'));
  fs.writeFileSync(path.join(TMP, 'a-second-photo.png'), Buffer.from(PNG_1PX_B64, 'base64'));
  fs.writeFileSync(path.join(TMP, 'not-an-image.jpg'), 'this is not a real jpeg');
  // A test filename carrying an HTML-special character -- the file list
  // renders each name via innerHTML (escaped), so this exercises that
  // escaping directly rather than trusting it by inspection alone. '&'
  // rather than '<'/'>', which Windows filenames disallow.
  fs.writeFileSync(path.join(TMP, 'Q&A photo.png'), Buffer.from(PNG_1PX_B64, 'base64'));

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();

  // A real JPEG, generated via canvas.toDataURL in an actual browser page
  // rather than hand-encoded bytes -- JPEG's DCT/Huffman-coded structure
  // isn't something to hand-roll reliably, and the browser IS the real
  // producer this tool's own dropzone accepts input from anyway.
  const jpegPage = await browser.newPage();
  await jpegPage.goto('about:blank');
  const dataUrl = await jpegPage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 6;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 6, 4);
    return canvas.toDataURL('image/jpeg', 0.9);
  });
  await jpegPage.close();
  fs.writeFileSync(path.join(TMP, 'photo2.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('jpg-png-to-pdf: converts a single PNG into a one-page PDF', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'photo1.png'));
  await page.waitForSelector('.file-list .file-row');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Convert to PDF")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.pdf');
  const outPath = path.join(TMP, 'single-out.pdf');
  await download.saveAs(outPath);

  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 1);
  // Page points are the image's own pixel dimensions at 144 DPI (72 points
  // per inch / 144 pixels per inch = 0.5 points per pixel) -- see
  // ../src/browser/imagesToPdf.client.js's own IMAGE_DPI comment for why.
  const size = doc.getPage(0).getSize();
  assert.equal(size.width, 0.5);
  assert.equal(size.height, 0.5);
  assert.deepEqual(errors, []);
  await page.close();
});

test('jpg-png-to-pdf: combines a PNG and a JPG into a two-page PDF, one page per image, sized to each image', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'photo1.png'),
    path.join(TMP, 'photo2.jpg'),
  ]);
  await page.waitForSelector('.file-list .file-row');
  assert.equal(await page.locator('.file-list .file-row').count(), 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Convert to PDF")').click(),
  ]);
  const outPath = path.join(TMP, 'combined-out.pdf');
  await download.saveAs(outPath);

  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 2);
  // photo1.png (1x1) stays page 1, photo2.jpg (6x4) is page 2 -- the same
  // order the files were selected in, confirming no silent reorder. Page
  // points are pixel dimensions at 144 DPI (0.5 points per pixel).
  assert.deepEqual(doc.getPage(0).getSize(), { width: 0.5, height: 0.5 });
  assert.deepEqual(doc.getPage(1).getSize(), { width: 3, height: 2 });
  await page.close();
});

test('jpg-png-to-pdf: the up/down reorder controls actually change page order in the downloaded PDF', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'photo1.png'),
    path.join(TMP, 'photo2.jpg'),
  ]);
  await page.waitForSelector('.file-list .file-row');

  // Move the second row (photo2.jpg) up, ahead of photo1.png.
  await page.locator('.file-list .file-row').nth(1).locator('[data-action="up"]').click();
  const namesAfterReorder = await page.locator('.file-list .file-name').allTextContents();
  assert.deepEqual(namesAfterReorder, ['photo2.jpg', 'photo1.png']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Convert to PDF")').click(),
  ]);
  const outPath = path.join(TMP, 'reordered-out.pdf');
  await download.saveAs(outPath);

  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 2);
  // photo2.jpg (6x4) is now page 1, photo1.png (1x1) is now page 2. Page
  // points are pixel dimensions at 144 DPI (0.5 points per pixel).
  assert.deepEqual(doc.getPage(0).getSize(), { width: 3, height: 2 });
  assert.deepEqual(doc.getPage(1).getSize(), { width: 0.5, height: 0.5 });
  await page.close();
});

test('jpg-png-to-pdf: the remove button drops an image before converting', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'photo1.png'),
    path.join(TMP, 'a-second-photo.png'),
  ]);
  await page.waitForSelector('.file-list .file-row');

  await page.locator('.file-list .file-row').nth(1).locator('[data-action="remove"]').click();
  assert.equal(await page.locator('.file-list .file-row').count(), 1);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Convert to PDF")').click(),
  ]);
  const outPath = path.join(TMP, 'after-remove-out.pdf');
  await download.saveAs(outPath);
  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 1);
  await page.close();
});

test('jpg-png-to-pdf: a corrupt/mislabeled image file gets a clear, file-named error, never a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-an-image.jpg'));
  await page.waitForSelector('.file-list .file-row');

  await page.locator('button:has-text("Convert to PDF")').click();
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('not-an-image.jpg'));
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /"not-an-image\.jpg" doesn.t look like a valid JPG/);
  await page.close();
});

test('jpg-png-to-pdf: converting several images shows real per-image progress (determinate bar + "N of M" status), not just a generic spinner', async () => {
  // Real assertion, not a proxy: waits for the ACTUAL rendered .dz-status
  // text to match the real "Converting image N of M..." shape produced by
  // src/browser/batchProgress.js while the dropzone is genuinely still in
  // its "working" state, and confirms the progress bar's real inline width
  // moved off its initial empty value -- if reportBatchProgress()/
  // setProgress() were removed, this would time out and fail for real
  // (the status would stay the old static "Converting on this device...").
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });

  const files = [];
  for (let i = 0; i < 3; i += 1) files.push(path.join(TMP, 'photo1.png'), path.join(TMP, 'a-second-photo.png'));
  await page.locator('#file-input').setInputFiles(files);
  await page.waitForSelector('.file-list .file-row');
  assert.equal(await page.locator('.file-list .file-row').count(), 6);

  await page.locator('button:has-text("Convert to PDF")').click();

  await page.waitForFunction(() => {
    const status = document.querySelector('.dz-status')?.textContent || '';
    const dz = document.querySelector('.dropzone');
    return /Converting image \d+ of 6…/.test(status) && dz?.dataset.state === 'working' && dz?.dataset.determinate === 'true';
  }, { timeout: 15000 });

  const widthDuringWork = await page.locator('.progress-fill').evaluate((el) => el.style.width);
  assert.notEqual(widthDuringWork, '', 'progress-fill should have a real inline width once determinate progress is reported');
  assert.notEqual(widthDuringWork, '0%');

  const download = await page.waitForEvent('download', { timeout: 15000 });
  const outPath = path.join(TMP, 'progress-out.pdf');
  await download.saveAs(outPath);
  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 6);

  assert.deepEqual(errors, []);
  await page.close();
});

test('jpg-png-to-pdf: a filename with an HTML-special character renders as literal text in the file list, not injected markup', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}pdf/jpg-png-to-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'Q&A photo.png'));
  await page.waitForSelector('.file-list .file-row');

  const nameText = await page.locator('.file-list .file-name').textContent();
  assert.equal(nameText, 'Q&A photo.png');
  assert.deepEqual(errors, []);
  await page.close();
});
