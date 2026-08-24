import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the regex tester: drive the built dist/ output in a
 * real headless browser. Like uuidGenerator.e2e.test.mjs, this tool has no
 * dropzone/paste-convert flow -- src/browser/regexTester.client.js builds
 * its own live pattern/flags/test-string panel directly (customPanelMode).
 * The last test here is the one that actually matters most: it feeds the
 * live tool a genuinely catastrophic-backtracking pattern and asserts the
 * PAGE stays responsive and recovers with a friendly error, proving the
 * Worker + timeout mitigation (src/browser/regexTester.worker.js) really
 * works, not just that the code compiles. Requires `npm run build` to have
 * already produced dist/.
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

test('regex-tester: the page renders live matches for the default pattern/text immediately on load, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  const marks = await page.locator('.result mark.regex-match').allTextContents();
  assert.deepEqual(marks, ['hello@example.com', 'support@example.org']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('regex-tester: editing the pattern re-matches live with no button click', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  // "hello@example.com": /e\w+/g's first match starts at the "e" in
  // "hello" and greedily consumes word characters until the non-word "@" -
  // "ello", not just "ell".
  await page.fill('.result input[type="text"]', 'e\\w+');
  await page.waitForFunction(() => {
    const marks = [...document.querySelectorAll('.result mark.regex-match')];
    return marks.length > 0 && marks[0].textContent === 'ello';
  });

  const marks = await page.locator('.result mark.regex-match').allTextContents();
  assert.ok(marks.length > 0);
  assert.equal(marks[0], 'ello');
  await page.close();
});

test('regex-tester: editing the test string re-matches live with no button click', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  await page.fill('.result textarea', 'only one@match.com here');
  await page.waitForFunction(() => document.querySelectorAll('.result mark.regex-match').length === 1);

  const marks = await page.locator('.result mark.regex-match').allTextContents();
  assert.deepEqual(marks, ['one@match.com']);
  await page.close();
});

test('regex-tester: capture groups render in a table with correct index and value', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .extracted-table');

  const rows = await page.locator('.result .extracted-table tbody tr').allTextContents();
  assert.equal(rows.length, 4); // 2 matches x 2 groups each
  assert.ok(rows[0].includes('hello'));
  assert.ok(rows[1].includes('example.com'));
  await page.close();
});

test('regex-tester: turning off the g flag falls back to a single first match', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  await page.locator('.result input[type="checkbox"]').first().uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.result mark.regex-match').length === 1);

  const marks = await page.locator('.result mark.regex-match').allTextContents();
  assert.deepEqual(marks, ['hello@example.com']);
  await page.close();
});

test('regex-tester: an invalid pattern shows a friendly inline error, not a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  await page.fill('.result input[type="text"]', '(unterminated');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').length > 0
    && document.querySelectorAll('.result mark.regex-match').length === 0);

  const status = await page.locator('.result .dz-status').textContent();
  assert.ok(status.length > 0);
  await page.close();
});

test('regex-tester: no matches shows "No matches." rather than an empty, silent panel', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  await page.fill('.result input[type="text"]', 'zzz-not-present');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('No matches'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /no matches/i);
  await page.close();
});

test('regex-tester: catastrophic backtracking is caught and recovered from -- the page stays responsive and shows a friendly error, instead of hanging', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/regex-tester/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result mark.regex-match');

  // (a+)+$ against a long run of "a"s with no trailing character that
  // could ever complete the match is the textbook catastrophic-
  // backtracking pattern: exponential backtracking with no early exit.
  await page.fill('.result input[type="text"]', '(a+)+$');
  await page.fill('.result textarea', 'a'.repeat(35) + '!');

  // Prove the page itself never froze while the worker was stuck: run an
  // ordinary page interaction (not related to the regex match) well before
  // the tool's own ~2.5s timeout could have fired.
  await page.waitForTimeout(300);
  const stillResponsive = await page.evaluate(() => 1 + 1);
  assert.equal(stillResponsive, 2, 'the main thread should stay responsive even while the worker is stuck in catastrophic backtracking');

  // Now wait for the tool's own timeout+recovery to actually fire and
  // report a friendly error.
  await page.waitForFunction(
    () => (document.querySelector('.result .dz-status')?.textContent || '').toLowerCase().includes('too long'),
    { timeout: 10000 }
  );
  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /taking too long/i);

  // And prove recovery is real, not just a one-time error message: a
  // normal pattern typed right after still works.
  await page.fill('.result input[type="text"]', 'a+');
  await page.waitForFunction(() => document.querySelectorAll('.result mark.regex-match').length > 0, { timeout: 10000 });
  const marksAfterRecovery = await page.locator('.result mark.regex-match').allTextContents();
  assert.ok(marksAfterRecovery.length > 0);

  assert.deepEqual(errors, []);
  await page.close();
});
