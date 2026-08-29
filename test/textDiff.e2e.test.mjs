import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for text-diff: drive the built dist/ output in a real
 * headless browser. Like regexTester.e2e.test.mjs, this tool has no
 * dropzone/paste-convert flow -- src/browser/textDiff.client.js builds its
 * own live two-textarea, two-pane panel directly (customPanelMode).
 * Requires `npm run build` to have already produced dist/.
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

test('text-diff: the page renders the default example diff immediately on load, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const delMarks = await page.locator('.result mark.text-diff-del').allTextContents();
  const insMarks = await page.locator('.result mark.text-diff-ins').allTextContents();
  assert.deepEqual(delMarks, ['jumps']);
  assert.deepEqual(insMarks, ['leaps']);

  const statuses = await page.locator('.result .text-diff-cell--a[data-diff-status]').evaluateAll(
    (els) => els.map((el) => el.dataset.diffStatus)
  );
  assert.deepEqual(statuses, ['changed', 'unchanged', 'removed', 'empty', 'unchanged']);

  assert.deepEqual(errors, []);
  await page.close();
});

test('text-diff: editing either textarea re-diffs live with no button click', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('one line only');
  await textareas.nth(1).fill('one line only');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('match exactly'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /match exactly/i);
  await page.close();
});

test('text-diff: an unmodified paste reports zero differences with an honest success message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('same\ntext\nhere');
  await textareas.nth(1).fill('same\ntext\nhere');
  await page.waitForFunction(() => document.querySelectorAll('.result .alert-success').length > 0);

  const alert = await page.locator('.result .alert-success').textContent();
  assert.match(alert, /no differences/i);
  await page.close();
});

test('text-diff: the Swap button exchanges the two texts and re-diffs', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('AAA');
  await textareas.nth(1).fill('BBB');
  await page.waitForFunction(() => document.querySelectorAll('.result mark.text-diff-ins, .result mark.text-diff-del').length > 0);

  await page.locator('button:has-text("Swap A")').click();
  await page.waitForFunction(() => (document.querySelectorAll('.result textarea')[0] || {}).value === 'BBB');

  assert.equal(await textareas.nth(0).inputValue(), 'BBB');
  assert.equal(await textareas.nth(1).inputValue(), 'AAA');
  await page.close();
});

test('text-diff: "Ignore whitespace" makes lines differing only by spacing report as unchanged', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('  hello  ');
  await textareas.nth(1).fill('hello');

  await page.locator('.result label:has-text("Ignore whitespace") input[type="checkbox"]').check();
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('match exactly'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /match exactly/i);
  await page.close();
});

test('text-diff: "Ignore case" makes lines differing only by case report as unchanged', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('Hello World');
  await textareas.nth(1).fill('hello world');

  await page.locator('.result label:has-text("Ignore case") input[type="checkbox"]').check();
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('match exactly'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /match exactly/i);
  await page.close();
});

test('text-diff: both boxes empty shows a friendly "nothing to compare" message, not a blank panel', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('');
  await textareas.nth(1).fill('');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').toLowerCase().includes('paste text'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /paste text/i);
  await page.close();
});

test('text-diff: the copy button copies a unified-diff-style text of the current comparison to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('same\nold line');
  await textareas.nth(1).fill('same\nnew line');
  await page.waitForFunction(() => (document.querySelector('.result mark.text-diff-del')?.textContent || '') === 'old');

  await page.locator('button:has-text("Copy as diff text")').click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Copied'));

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText.replace(/\r\n/g, '\n'), '  same\n- old line\n+ new line');
  await context.close();
});

test('text-diff: an oversized pair of texts shows a friendly size-limit message instead of hanging the tab', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/text-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .text-diff-grid');

  const bigText = await page.evaluate(() => Array.from({ length: 3100 }, (_, i) => 'line' + i).join('\n'));
  const otherBigText = await page.evaluate(() => Array.from({ length: 3100 }, (_, i) => 'other' + i).join('\n'));

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill(bigText);
  await textareas.nth(1).fill(otherBigText);
  await page.waitForFunction(() => document.querySelectorAll('.result .alert-danger').length > 0, { timeout: 10000 });

  const alert = await page.locator('.result .alert-danger').textContent();
  assert.match(alert, /too large to compare/i);
  await page.close();
});
