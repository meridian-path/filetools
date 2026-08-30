import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the HEIC-to-JPG/PNG tool: drive the built dist/
 * output in a real headless browser against a real HEIC fixture (see
 * test/fixtures/README.md for provenance), and verify the actual
 * downloaded file's real magic bytes -- not just that a download
 * happened. Mirrors test/pdfToImages.e2e.test.mjs's zip-of-real-images
 * verification approach for the single-file (direct download, no zip)
 * and multi-file (zip) cases both.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');
const FIXTURE = path.join(__dirname, 'fixtures', 'testsrc.heic');

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

const JPEG_SOI = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  assert.ok(fs.existsSync(FIXTURE), 'test/fixtures/testsrc.heic is missing.');
  fs.mkdirSync(TMP, { recursive: true });

  const heicBytes = fs.readFileSync(FIXTURE);
  fs.writeFileSync(path.join(TMP, 'my-photo.heic'), heicBytes);
  fs.writeFileSync(path.join(TMP, 'a-second-photo.heic'), heicBytes);
  fs.writeFileSync(path.join(TMP, 'not-a-real-photo.heic'), 'this is not a real heic file');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('heic-to-jpg-png: uploading one HEIC photo downloads a real JPG directly, not a zip, by default', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'my-photo.heic'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Convert")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'my-photo.jpg');
  const bytes = fs.readFileSync(await download.path());
  assert.deepEqual([...bytes.subarray(0, 3)], JPEG_SOI);

  assert.deepEqual(errors, []);
  await page.close();
});

test('heic-to-jpg-png: clicking "Try sample photo" loads the real bundled fixture and converts it to a real JPG', async () => {
  // Covers the sample-input affordance (src/pages/toolPage.js's
  // sampleInput field / dropzone.client.js's .dz-sample handler) through
  // the real built site - the bundled fixture is a copy of this same
  // test file's own testsrc.heic (see scripts/generate-sample-assets.js's
  // writeHeicSample() and test/fixtures/README.md for its provenance), so
  // this only passes if the click actually fetched it and ran it through
  // the same real heic2any decode path a drop takes.
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('.dz-sample').click();
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Convert")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'sample-photo.jpg');
  const bytes = fs.readFileSync(await download.path());
  assert.deepEqual([...bytes.subarray(0, 3)], JPEG_SOI);
  assert.deepEqual(errors, []);
  await page.close();
});

test('heic-to-jpg-png: selecting PNG downloads a real PNG instead', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'my-photo.heic'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));

  await page.locator('input[name="image-format"][value="image/png"]').check();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Convert")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'my-photo.png');
  const bytes = fs.readFileSync(await download.path());
  assert.deepEqual([...bytes.subarray(0, 4)], PNG_SIGNATURE);
  await page.close();
});

test('heic-to-jpg-png: dropping two HEIC photos downloads a zip of two real JPGs, one named per source file', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'my-photo.heic'),
    path.join(TMP, 'a-second-photo.heic'),
  ]);
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button:has-text("Convert")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted-images.zip');
  const entries = unzipSync(new Uint8Array(fs.readFileSync(await download.path())));
  assert.deepEqual(Object.keys(entries).sort(), ['a-second-photo.jpg', 'my-photo.jpg']);
  for (const bytes of Object.values(entries)) {
    assert.deepEqual([...bytes.subarray(0, 3)], JPEG_SOI);
  }
  await page.close();
});

test('heic-to-jpg-png: rendering many photos shows real per-photo progress (determinate bar + "N of M" status)', async () => {
  const heicBytes = fs.readFileSync(FIXTURE);
  const manyDir = path.join(TMP, 'many-heic');
  fs.mkdirSync(manyDir, { recursive: true });
  const manyFiles = [];
  for (let i = 1; i <= 6; i += 1) {
    const p = path.join(manyDir, `photo-${i}.heic`);
    fs.writeFileSync(p, heicBytes);
    manyFiles.push(p);
  }

  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(manyFiles);
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));

  await page.locator('button:has-text("Convert")').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('.dz-status')?.textContent || '';
    const dz = document.querySelector('.dropzone');
    return /Converting photo \d+ of 6…/.test(status) && dz?.dataset.state === 'working' && dz?.dataset.determinate === 'true';
  }, { timeout: 20000 });

  const download = await page.waitForEvent('download', { timeout: 20000 });
  const entries = unzipSync(new Uint8Array(fs.readFileSync(await download.path())));
  assert.equal(Object.keys(entries).length, 6);

  assert.deepEqual(errors, []);
  await page.close();
});

test('heic-to-jpg-png: a corrupt/invalid HEIC file gets a clear error naming the file, never a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/heic-to-jpg-png/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-a-real-photo.heic'));
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('ready'));
  await page.locator('button:has-text("Convert")').click();
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').includes('not-a-real-photo.heic'), { timeout: 20000 });
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /doesn.t look like a valid HEIC\/HEIF photo/);
  await page.close();
});
