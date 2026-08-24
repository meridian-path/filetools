import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Regression coverage for a real, previously-shipped bug: src/browser/
 * dropzone.client.js's own "wrong file type" and "too many files" error
 * messages hardcoded the word "PDF" for every tool on the site, so a
 * visitor to e.g. csv-to-sql-insert who dropped the wrong file type saw
 * '"foo.txt" isn't a PDF - this tool reads PDF files.', which is simply
 * false for a CSV tool. Found (but not fixed) during the hash-generator
 * build; fixed here by threading src/pages/toolPage.js's own fileTypeLabel
 * field through to the client via a data-file-type-label attribute, with
 * dropzone.client.js building both messages from it. This file drives the
 * BUILT dist/ output in a real headless browser, across several tools with
 * meaningfully different label shapes (a bare word, a bare acronym, a
 * "word file" phrase that needs de-duplicating before pluralizing, and a
 * dotted extension), rather than unit-testing dropzone.client.js's small
 * inline helper functions in isolation -- the actual DOM error text a
 * visitor sees is the thing that regressed, so that's what's asserted
 * against. Requires `npm run build` to have already produced dist/.
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
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

async function expectWrongTypeMessage(page, toolPath, wrongFilePath, expectedMessage) {
  await page.goto(`${baseUrl}${toolPath}`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(wrongFilePath);
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.equal(msg, expectedMessage);
}

/**
 * A single-file (multiple:false) tool's own #file-input can't be handed 2
 * files -- that's the browser's own native picker restriction, correctly
 * enforced by Playwright's setInputFiles too. The "too many files" error
 * this test targets only exists to catch the OTHER input path: a real
 * drag-and-drop is never constrained by an input's `multiple` attribute
 * (see dropzone.client.js's own 'drop' listener), so this simulates that
 * path directly with a synthetic DragEvent carrying a real DataTransfer.
 */
async function dropFiles(page, names) {
  await page.evaluate((fileNames) => {
    const dt = new DataTransfer();
    for (const name of fileNames) dt.items.add(new File(['x'], name, { type: 'text/plain' }));
    const target = document.getElementById('tool');
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, names);
}

async function expectTooManyFilesMessage(page, toolPath, fileNames, expectedMessage) {
  await page.goto(`${baseUrl}${toolPath}`, { waitUntil: 'networkidle' });
  await dropFiles(page, fileNames);
  await page.waitForFunction(() => (document.querySelector('.dz-status')?.textContent || '').length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.equal(msg, expectedMessage);
}

test('dropzone: a PDF-only tool (fileTypeLabel omitted, defaults to "PDF") reports the wrong-type error using "PDF", not a generic message', async () => {
  const page = await browser.newPage();
  const badFile = path.join(TMP, 'dz-notapdf.txt');
  fs.writeFileSync(badFile, 'not a pdf');
  await expectWrongTypeMessage(page, 'pdf/merge-pdf/', badFile, '"dz-notapdf.txt" isn\'t a PDF - this tool reads PDF files.');
  await page.close();
});

test('dropzone: split-pdf (multiple:false) reports "Choose a single PDF." when 2 files are dropped at once', async () => {
  const page = await browser.newPage();
  await expectTooManyFilesMessage(page, 'pdf/split-pdf/', ['dz-a.pdf', 'dz-b.pdf'], 'This tool works on one file at a time. Choose a single PDF.');
  await page.close();
});

test('dropzone: merge-csv (fileTypeLabel: "CSV", a bare acronym with no trailing "file" to strip) reports "isn\'t a CSV - this tool reads CSV files."', async () => {
  const page = await browser.newPage();
  const badFile = path.join(TMP, 'dz-notacsv.pdf');
  fs.writeFileSync(badFile, 'not a csv');
  await expectWrongTypeMessage(page, 'data/merge-csv/', badFile, '"dz-notacsv.pdf" isn\'t a CSV - this tool reads CSV files.');
  await page.close();
});

test('dropzone: split-csv (fileTypeLabel: "CSV file", needs de-duplication before pluralizing) reports "isn\'t a CSV file - this tool reads CSV files.", not "CSV file files"', async () => {
  const page = await browser.newPage();
  const badFile = path.join(TMP, 'dz-notacsv2.pdf');
  fs.writeFileSync(badFile, 'not a csv');
  await expectWrongTypeMessage(page, 'data/split-csv/', badFile, '"dz-notacsv2.pdf" isn\'t a CSV file - this tool reads CSV files.');
  await page.close();
});

test('dropzone: split-csv reports "Choose a single CSV file." (not "Choose a single PDF") when 2 files are dropped at once', async () => {
  const page = await browser.newPage();
  await expectTooManyFilesMessage(page, 'data/split-csv/', ['dz-c.csv', 'dz-d.csv'], 'This tool works on one file at a time. Choose a single CSV file.');
  await page.close();
});

test('dropzone: xlsx-to-csv (fileTypeLabel: ".xlsx file", a dotted extension) reports "isn\'t a .xlsx file - this tool reads .xlsx files."', async () => {
  const page = await browser.newPage();
  const badFile = path.join(TMP, 'dz-notxlsx.txt');
  fs.writeFileSync(badFile, 'not an xlsx');
  await expectWrongTypeMessage(page, 'data/xlsx-to-csv/', badFile, '"dz-notxlsx.txt" isn\'t a .xlsx file - this tool reads .xlsx files.');
  await page.close();
});

test('dropzone: hash-generator (fileTypeLabel: "", accepts every file type) never shows a wrong-type error at all -- every file matches', async () => {
  const page = await browser.newPage();
  const anyFile = path.join(TMP, 'dz-anything.xyz');
  fs.writeFileSync(anyFile, 'hash me');
  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(anyFile);
  await page.waitForSelector('.result .hash-row');
  const msg = await page.locator('.dz-status').textContent();
  assert.doesNotMatch(msg, /isn't a/);
  await page.close();
});
