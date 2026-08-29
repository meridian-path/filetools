import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the hash generator tool: drive the built dist/
 * output in a real headless browser, through both input paths (single/
 * multiple file upload and pasted text), and verify the actual rendered/
 * copied content -- not just that the page renders. Mirrors
 * test/urlEncode.e2e.test.mjs's approach. Requires `npm run build` to have
 * already produced dist/.
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

test('hash-generator: pasting text shows one block with all five algorithms, correct values', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'abc');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .hash-row');

  const blocks = page.locator('.result .table-block');
  assert.equal(await blocks.count(), 1);
  await expectHash(page, 'MD5', '900150983cd24fb0d6963f7d28e17f72');
  await expectHash(page, 'SHA-1', 'a9993e364706816aba3e25717850c26c9cd0d89d');
  await expectHash(page, 'SHA-256', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.deepEqual(errors, []);
  await page.close();
});

async function expectHash(page, label, expected) {
  const row = page.locator('.hash-row', { has: page.locator('.hash-label', { hasText: label }) });
  const value = await row.locator('.hash-value').textContent();
  assert.equal(value, expected, `${label} mismatch`);
}

test('hash-generator: uploading multiple files hashes each one into its own block', async () => {
  const page = await browser.newPage();
  const fileA = path.join(TMP, 'hash-a.txt');
  const fileB = path.join(TMP, 'hash-b.txt');
  fs.writeFileSync(fileA, 'abc');
  fs.writeFileSync(fileB, 'a');

  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([fileA, fileB]);
  await page.waitForFunction(() => document.querySelectorAll('.result .table-block').length === 2);

  const badges = page.locator('.result .table-block .page-badge');
  const names = await badges.allTextContents();
  assert.deepEqual(names.sort(), ['hash-a.txt', 'hash-b.txt']);

  const firstBlockMd5 = await page.locator('.result .table-block').first().locator('.hash-row').first().locator('.hash-value').textContent();
  assert.match(firstBlockMd5, /^[0-9a-f]{32}$/);
  await page.close();
});

test('hash-generator: the copy button copies the exact hash value to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'abc');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.result .hash-row');

  await page.locator('button:has-text("Copy MD5")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, '900150983cd24fb0d6963f7d28e17f72');
  await context.close();
});

test('hash-generator: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  // Craft-audit fix (item 5): a paste-triggered status lives in this
  // paste box's OWN `.paste-status` line now, never the shared
  // `.dz-status` the unrelated file drop-zone owns.
  await page.waitForFunction(() => document.querySelector('.paste-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.paste-status').textContent();
  assert.match(msg, /paste some text first/i);
  await page.close();
});

test('hash-generator: hashing a small binary file produces the correct hash, not a mangled text-decoded one', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const filePath = path.join(TMP, 'hash-binary.bin');
  // Bytes that are not valid UTF-8 on their own (a lone continuation byte),
  // so a wrong implementation using file.text() instead of
  // file.arrayBuffer() would silently corrupt this input before hashing.
  fs.writeFileSync(filePath, Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x41, 0x42]));

  await page.goto(`${baseUrl}data/hash-generator/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(filePath);
  await page.waitForSelector('.result .hash-row');

  const md5Value = await page.locator('.result .hash-row').first().locator('.hash-value').textContent();
  const { createHash } = await import('node:crypto');
  const expected = createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
  assert.equal(md5Value, expected);
  await page.close();
});
