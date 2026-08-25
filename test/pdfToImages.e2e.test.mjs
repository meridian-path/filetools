import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the PDF-to-JPG/PNG tool: drive the built dist/
 * output in a real headless browser against a real multi-page PDF built
 * with pdf-lib, and verify the actual downloaded zip's real image entries
 * (magic bytes, not just filenames) -- not just that the page renders.
 * Mirrors test/splitCsv.e2e.test.mjs's zip-download-verification approach
 * and test/pdfTables.e2e.test.mjs's real-pdf-lib-fixture approach.
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

async function buildThreePagePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const colors = [rgb(0.9, 0.2, 0.2), rgb(0.2, 0.6, 0.2), rgb(0.2, 0.3, 0.9)];
  for (let i = 0; i < 3; i += 1) {
    const page = doc.addPage([200, 150]);
    page.drawRectangle({ x: 0, y: 0, width: 200, height: 150, color: colors[i] });
    page.drawText(`Page ${i + 1}`, { x: 20, y: 70, size: 18, font, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

async function buildManyPagePdf(count) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i += 1) {
    const page = doc.addPage([200, 150]);
    page.drawText(`Page ${i + 1}`, { x: 20, y: 70, size: 18, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

async function downloadZip(page, buttonText) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator(`button:has-text("${buttonText}")`).click(),
  ]);
  const zipPath = await download.path();
  return { entries: unzipSync(new Uint8Array(fs.readFileSync(zipPath))), suggested: download.suggestedFilename() };
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'colors.pdf'), await buildThreePagePdf());
  fs.writeFileSync(path.join(TMP, 'not-a-pdf.pdf'), 'this is not a real pdf');
  fs.writeFileSync(path.join(TMP, 'many-pages.pdf'), await buildManyPagePdf(30));

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('pdf-to-jpg-png: uploading a 3-page PDF previews 3 pages and downloads a zip of 3 real JPGs by default', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}pdf/pdf-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'colors.pdf'));
  await page.waitForFunction(() => document.querySelectorAll('.page-grid .page-card').length === 3);

  const { entries, suggested } = await downloadZip(page, 'Convert to images');
  assert.equal(suggested, 'colors-images.zip');
  assert.deepEqual(Object.keys(entries).sort(), ['colors-page-1.jpg', 'colors-page-2.jpg', 'colors-page-3.jpg']);

  for (const bytes of Object.values(entries)) {
    // Real JPEG SOI marker (0xFFD8FF) -- not just a non-empty file.
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('pdf-to-jpg-png: selecting PNG downloads a zip of real PNGs instead', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/pdf-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'colors.pdf'));
  await page.waitForFunction(() => document.querySelectorAll('.page-grid .page-card').length === 3);

  await page.locator('input[name="image-format"][value="image/png"]').check();
  const { entries } = await downloadZip(page, 'Convert to images');
  assert.deepEqual(Object.keys(entries).sort(), ['colors-page-1.png', 'colors-page-2.png', 'colors-page-3.png']);

  const pngSignature = [0x89, 0x50, 0x4e, 0x47];
  for (const bytes of Object.values(entries)) {
    assert.deepEqual([...bytes.subarray(0, 4)], pngSignature);
  }
  await page.close();
});

test('pdf-to-jpg-png: rendering many pages shows real per-page progress (determinate bar + "N of M" status) in both the preview and export loops', async () => {
  // Real assertion, not a proxy: waits for the ACTUAL rendered .dz-status
  // text to match src/browser/batchProgress.js's real "Rendering page N of
  // M..." shape while the dropzone is genuinely "working" -- would time out
  // and fail for real if reportBatchProgress()/setProgress() were removed
  // from either of pdfToImages.client.js's two loops.
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}pdf/pdf-to-jpg-png/`, { waitUntil: 'networkidle' });

  await page.locator('#file-input').setInputFiles(path.join(TMP, 'many-pages.pdf'));
  // Preview-render loop: runs automatically on file selection, before the
  // page even offers a format choice.
  await page.waitForFunction(() => {
    const status = document.querySelector('.dz-status')?.textContent || '';
    const dz = document.querySelector('.dropzone');
    return /Rendering page \d+ of 30…/.test(status) && dz?.dataset.determinate === 'true';
  }, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.page-grid .page-card').length === 30, { timeout: 15000 });

  // Export loop: the second, separately-triggered pass behind "Convert to
  // images" -- confirms progress reporting isn't only wired into the first
  // (preview) loop.
  await page.locator('button:has-text("Convert to images")').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('.dz-status')?.textContent || '';
    const dz = document.querySelector('.dropzone');
    return /Rendering page \d+ of 30…/.test(status) && dz?.dataset.state === 'working' && dz?.dataset.determinate === 'true';
  }, { timeout: 15000 });

  const download = await page.waitForEvent('download', { timeout: 15000 });
  const zipPath = await download.path();
  const entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  assert.equal(Object.keys(entries).length, 30);

  assert.deepEqual(errors, []);
  await page.close();
});

test('pdf-to-jpg-png: a corrupt/invalid PDF gets a clear error, never a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}pdf/pdf-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-a-pdf.pdf'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('not-a-pdf.pdf'));
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /doesn.t look like a valid PDF/);
  await page.close();
});
