import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the extract-images-from-PDF tool: drive the built
 * dist/ output in a real headless browser against a real PDF built with a
 * real embedded JPEG image (via pdf-lib's own embedJpg/drawImage - not a
 * synthetic operator list), and verify the actual downloaded zip's real
 * PNG entries (magic bytes) - not just that a download happened. Mirrors
 * test/pdfToImages.e2e.test.mjs's approach for the sibling PDF-image tool
 * in this same batch.
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

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  // A real JPEG, generated via canvas.toDataURL in an actual browser page
  // rather than hand-encoded bytes -- same reasoning
  // test/imagesToPdf.e2e.test.mjs's own header comment gives for why.
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();

  const jpegPage = await browser.newPage();
  await jpegPage.goto('about:blank');
  const dataUrl = await jpegPage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 20, 30);
    ctx.fillStyle = 'blue';
    ctx.fillRect(20, 0, 20, 30);
    return canvas.toDataURL('image/jpeg', 0.9);
  });
  await jpegPage.close();
  const jpegBytes = new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64'));

  // One PDF with a real embedded JPEG (via pdf-lib's own embedJpg +
  // drawImage, a genuine paintImageXObject in the resulting PDF, not a
  // synthetic test fixture).
  const withImageDoc = await PDFDocument.create();
  const embedded = await withImageDoc.embedJpg(jpegBytes);
  const withImagePage = withImageDoc.addPage([200, 150]);
  withImagePage.drawImage(embedded, { x: 20, y: 20, width: embedded.width, height: embedded.height });
  fs.writeFileSync(path.join(TMP, 'with-image.pdf'), await withImageDoc.save());

  // One PDF with two pages, each carrying its own embedded image, to
  // verify per-page numbering in the extracted filenames.
  const twoPageDoc = await PDFDocument.create();
  const embedded2 = await twoPageDoc.embedJpg(jpegBytes);
  for (let i = 0; i < 2; i += 1) {
    const p = twoPageDoc.addPage([200, 150]);
    p.drawImage(embedded2, { x: 20, y: 20, width: embedded2.width, height: embedded2.height });
  }
  fs.writeFileSync(path.join(TMP, 'two-pages-with-images.pdf'), await twoPageDoc.save());

  // A larger PDF (one image per page, many pages) specifically to give the
  // per-page scanning loop enough real work to observe an intermediate
  // "working" frame in -- the 1-2 page fixtures above finish too fast for
  // that.
  const manyPagesDoc = await PDFDocument.create();
  const embeddedMany = await manyPagesDoc.embedJpg(jpegBytes);
  for (let i = 0; i < 25; i += 1) {
    const p = manyPagesDoc.addPage([200, 150]);
    p.drawImage(embeddedMany, { x: 20, y: 20, width: embeddedMany.width, height: embeddedMany.height });
  }
  fs.writeFileSync(path.join(TMP, 'many-pages-with-images.pdf'), await manyPagesDoc.save());

  // One text-only PDF with no embedded images at all.
  const noImageDoc = await PDFDocument.create();
  const font = await noImageDoc.embedFont(StandardFonts.Helvetica);
  const noImagePage = noImageDoc.addPage([200, 150]);
  noImagePage.drawText('Just text, no images here.', { x: 20, y: 100, size: 12, font });
  fs.writeFileSync(path.join(TMP, 'no-images.pdf'), await noImageDoc.save());

  fs.writeFileSync(path.join(TMP, 'not-a-pdf-extract.pdf'), 'this is not a real pdf');
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('extract-images-from-pdf: a PDF with one embedded image downloads a zip with one real PNG', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}pdf/extract-images-from-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'with-image.pdf'));
  await page.waitForSelector('.file-list .file-row', { timeout: 20000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'with-image-images.zip');
  const zipPath = await download.path();
  const entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  const names = Object.keys(entries);
  assert.equal(names.length, 1);
  assert.match(names[0], /^with-image-page-1-image-01\.png$/);

  // Real PNG signature, not just a non-empty file.
  assert.deepEqual([...entries[names[0]].subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('extract-images-from-pdf: a two-page PDF with one image per page numbers each extracted file by its own page', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/extract-images-from-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'two-pages-with-images.pdf'));
  await page.waitForSelector('.file-list .file-row', { timeout: 20000 });
  assert.equal(await page.locator('.file-list .file-row').count(), 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const zipPath = await download.path();
  const entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  assert.deepEqual(Object.keys(entries).sort(), [
    'two-pages-with-images-page-1-image-01.png',
    'two-pages-with-images-page-2-image-01.png',
  ]);
  await page.close();
});

test('extract-images-from-pdf: scanning many pages shows real per-page progress (determinate bar), the same shared pattern its sibling tools use', async () => {
  // Real assertion, not a proxy: this loop already produced real "Scanning
  // page N of M..." text before this pass -- what's new is the determinate
  // progress bar, reformatted through src/browser/batchProgress.js (the
  // same shared helper pdfToImages.client.js/imagesToPdf.client.js now use)
  // so all three read consistently. Would time out for real if
  // reportBatchProgress() were reverted to a bare setStatus() call.
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}pdf/extract-images-from-pdf/`, { waitUntil: 'networkidle' });

  await page.locator('#file-input').setInputFiles(path.join(TMP, 'many-pages-with-images.pdf'));
  await page.waitForFunction(() => {
    const status = document.querySelector('.dz-status')?.textContent || '';
    const dz = document.querySelector('.dropzone');
    return /Scanning page \d+ of 25…/.test(status) && dz?.dataset.state === 'working' && dz?.dataset.determinate === 'true';
  }, { timeout: 15000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const zipPath = await download.path();
  const entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  assert.equal(Object.keys(entries).length, 25);

  assert.deepEqual(errors, []);
  await page.close();
});

test('extract-images-from-pdf: a PDF with no embedded images shows a plain "none found" message, not an error or empty zip', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}pdf/extract-images-from-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'no-images.pdf'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('No embedded images'), { timeout: 20000 });
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /no embedded images/i);
  assert.deepEqual(errors, []);
  await page.close();
});

test('extract-images-from-pdf: a corrupt/invalid PDF gets a clear error, never a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}pdf/extract-images-from-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-a-pdf-extract.pdf'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('not-a-pdf-extract.pdf'));
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /doesn.t look like a valid PDF/);
  await page.close();
});
