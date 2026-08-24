import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the UUID generator tool: drive the built dist/
 * output in a real headless browser. Unlike every other tool's e2e suite,
 * this one never selects a file or pastes text -- it's a generator with no
 * input, so its own client file (src/browser/uuidGenerator.client.js) is
 * loaded directly by the page rather than through
 * ./dropzone.client.js's file-driven routing (see toolPage.js's
 * isGenerator branch). Mirrors test/csvToSqlInsert.e2e.test.mjs's
 * approach otherwise. Requires `npm run build` to have already produced
 * dist/.
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

function uuidLines(text) {
  return text.split('\n').filter(Boolean);
}

test('uuid-generator: the page renders a batch of 5 v4 UUIDs immediately on load, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  const text = await page.locator('.result .table-block .json-preview').textContent();
  const lines = uuidLines(text);
  assert.equal(lines.length, 5);
  for (const id of lines) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('uuid-generator: changing the count field re-renders with exactly that many UUIDs', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('.result input[type="number"]').fill('12');
  await page.locator('.result input[type="number"]').blur();
  await page.waitForFunction(() => document.querySelector('.result .page-badge')?.textContent.includes('12 UUID'));

  const text = await page.locator('.result .table-block .json-preview').textContent();
  assert.equal(uuidLines(text).length, 12);
  await page.close();
});

test('uuid-generator: switching to v7 re-renders with correctly versioned, distinct UUIDs', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('.result select').first().selectOption('v7');
  await page.waitForFunction(() => {
    const text = document.querySelector('.result .table-block .json-preview')?.textContent || '';
    const first = text.split('\n')[0] || '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-7/.test(first);
  });

  const text = await page.locator('.result .table-block .json-preview').textContent();
  const lines = uuidLines(text);
  for (const id of lines) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(lines).size, lines.length, 'expected every generated UUID to be distinct');
  await page.close();
});

test('uuid-generator: switching to v5 with the DNS namespace preset and a name produces the known deterministic UUID', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('.result select').first().selectOption('v5');
  await page.waitForSelector('.result input[type="text"]');
  const nameInput = page.locator('.result input[type="text"]').last();
  await nameInput.fill('example.com');
  await page.waitForFunction(() => (document.querySelector('.result .table-block .json-preview')?.textContent || '').includes('cfbff0d1-9375-5685-968c-48ce8b15ae17'));

  const text = await page.locator('.result .table-block .json-preview').textContent();
  // Count stays whatever it was before switching to v5 (5, the page's
  // default) -- v5 is deterministic, so every one of those 5 lines is the
  // same known UUID.
  assert.deepEqual(uuidLines(text), Array(5).fill('cfbff0d1-9375-5685-968c-48ce8b15ae17'));
  await page.close();
});

test('uuid-generator: v5 with a blank name shows a friendly inline error instead of a broken UUID', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  await page.locator('.result select').first().selectOption('v5');
  await page.waitForSelector('.result .alert-warn');
  const msg = await page.locator('.result .alert-warn').textContent();
  assert.match(msg, /name/i);
  await page.close();
});

test('uuid-generator: the "Generate new" button produces a different batch of the same version/count', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  const before1 = await page.locator('.result .table-block .json-preview').textContent();
  await page.locator('button:has-text("Generate new")').click();
  await page.waitForFunction(
    (prev) => {
      const text = document.querySelector('.result .table-block .json-preview')?.textContent;
      return text && text !== prev;
    },
    before1
  );
  const after1 = await page.locator('.result .table-block .json-preview').textContent();
  assert.notEqual(before1, after1);
  assert.equal(uuidLines(after1).length, uuidLines(before1).length);
  await page.close();
});

test('uuid-generator: the copy button copies every generated UUID, one per line, to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');

  const shown = await page.locator('.result .table-block .json-preview').textContent();
  await page.locator('button:has-text("Copy all")').click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Copied'));
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  // Normalize line endings before comparing -- the OS clipboard (Windows in
  // particular) can normalize to CRLF on the way through
  // navigator.clipboard.readText(), which is an OS/browser clipboard
  // behavior, not something the tool's own copy code controls.
  assert.equal(clipboardText.replace(/\r\n/g, '\n'), shown);
  await context.close();
});

test('uuid-generator: the download button downloads uuids.txt with the exact generated content', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/uuid-generator/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block .json-preview');
  const shown = await page.locator('.result .table-block .json-preview').textContent();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download uuids.txt")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'uuids.txt');
  const outPath = path.join(TMP, 'uuids-out.txt');
  await download.saveAs(outPath);
  const content = fs.readFileSync(outPath, 'utf8');
  assert.equal(content, shown);
  await page.close();
});
