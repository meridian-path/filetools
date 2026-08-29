import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the Unix Timestamp Converter tool: drive the built
 * dist/ output in a real headless browser. Like uuidGenerator.e2e.test.mjs/
 * wordCharacterCounter.e2e.test.mjs, this tool has no file/paste-driven
 * input -- its own client file (src/browser/unixTimestampConverter.client.js)
 * is loaded directly by the page rather than through
 * ./dropzone.client.js's file-driven routing (customPanelMode). Requires
 * `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

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
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('unix-timestamp-converter: the page renders all three sections with real values immediately on load', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  const blocks = page.locator('.result .table-block');
  await blocks.first().waitFor();
  assert.equal(await blocks.count(), 3);

  // "Timestamp to date" defaults to 1735689600 (2025-01-01 UTC) -- assert
  // the real computed UTC label appears in the LIVE tool specifically
  // (.result), not just "somewhere on the page" -- the static "Example
  // output" panel elsewhere on the page shows this same string from its
  // own build-time fixture, so a document.body-wide check would pass
  // even if the live tool itself were broken.
  await page.waitForFunction(() => document.querySelector('.result').textContent.includes('2025-01-01 00:00:00 UTC'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('unix-timestamp-converter: typing a millisecond timestamp auto-detects the unit and shows "Detected as milliseconds."', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  await page.locator('.result .table-block').first().waitFor();

  const tsInput = page.locator('.result input[type="text"]');
  await tsInput.fill('1735689600000');
  await page.waitForFunction(() => document.querySelector('.result').textContent.includes('Detected as milliseconds.'));
  await page.waitForFunction(() => document.querySelector('.result').textContent.includes('2025-01-01 00:00:00 UTC'));
  await page.close();
});

test('unix-timestamp-converter: explicitly picking "Seconds" for a millisecond number produces a very different (wrong-on-purpose) date, proving the selector actually overrides auto-detect', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  await page.locator('.result .table-block').first().waitFor();

  const tsInput = page.locator('.result input[type="text"]');
  await tsInput.fill('1735689600000');
  const unitSelect = page.locator('.result select').first();
  await unitSelect.selectOption('seconds');

  // 1735689600000 SECONDS is either out of Date's representable range or a
  // wildly different year, nowhere near 2025 -- confirms the override
  // actually took effect rather than the auto-detected guess silently
  // winning. Scoped to .result specifically -- the static "Example
  // output" panel elsewhere on the page permanently shows this same
  // "2025-01-01 00:00:00 UTC" string from its own build-time fixture, so
  // checking document.body as a whole could never turn false.
  await page.waitForFunction(() => !document.querySelector('.result').textContent.includes('2025-01-01 00:00:00 UTC'));
  await page.close();
});

test('unix-timestamp-converter: an invalid timestamp shows a friendly inline error instead of a broken date', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  await page.locator('.result .table-block').first().waitFor();

  const tsInput = page.locator('.result input[type="text"]');
  await tsInput.fill('not a number');
  await page.waitForFunction(() => document.body.textContent.includes('That is not a valid number.'));
  await page.close();
});

test('unix-timestamp-converter: the date-to-timestamp section converts the same instant to matching seconds/milliseconds when interpreted as UTC', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  await page.locator('.result .table-block').first().waitFor();

  const dateInput = page.locator('.result input[type="datetime-local"]');
  await dateInput.fill('2025-01-01T00:00');
  const interpretSelect = page.locator('.result select').last();
  await interpretSelect.selectOption('utc');

  await page.waitForFunction(() => document.body.textContent.includes('1735689600s') && document.body.textContent.includes('1735689600000ms'));
  await page.close();
});

test('unix-timestamp-converter: the "Right now" section shows a live epoch second count that advances over time', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/unix-timestamp-converter/`, { waitUntil: 'networkidle' });
  await page.locator('.result .table-block').first().waitFor();

  const readFirstBadge = () => page.evaluate(() => document.querySelectorAll('.result .table-block')[0].querySelectorAll('.page-badge')[0]?.textContent);
  const first = await readFirstBadge();
  assert.match(first, /^\d+s$/);

  await page.waitForFunction(
    (prev) => {
      const badge = document.querySelectorAll('.result .table-block')[0].querySelectorAll('.page-badge')[0];
      return badge && badge.textContent !== prev;
    },
    first,
    { timeout: 3000 }
  );
  await page.close();
});
