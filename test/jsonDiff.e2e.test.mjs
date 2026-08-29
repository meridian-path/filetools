import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for json-diff: drive the built dist/ output in a real
 * headless browser. Like textDiff.e2e.test.mjs, this tool has no dropzone/
 * paste-convert flow -- src/browser/jsonDiff.client.js builds its own live
 * two-textarea panel directly (customPanelMode).
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

test('json-diff: the page renders the default example diff immediately on load, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const badge = await page.locator('.result .page-badge').textContent();
  assert.match(badge, /1 changed/);
  assert.match(badge, /1 added/);
  assert.match(badge, /0 removed/);
  assert.match(badge, /4 unchanged/);

  const removedLines = await page.locator('.result .json-diff-line[data-status="removed"]').allTextContents();
  const addedLines = await page.locator('.result .json-diff-line[data-status="added"]').allTextContents();
  assert.ok(removedLines.some((l) => l.includes('"page": 1')));
  assert.ok(addedLines.some((l) => l.includes('"page": 2')));
  assert.ok(addedLines.some((l) => l.includes('"reviewer"')));

  assert.deepEqual(errors, []);
  await page.close();
});

test('json-diff: editing either textarea re-diffs live with no button click', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('{"a": 1}');
  await textareas.nth(1).fill('{"a": 1}');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('structurally identical'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /structurally identical/i);
  await page.close();
});

test('json-diff: key order never affects the result -- two objects with the same keys reordered report zero differences', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('{"a": 1, "b": 2, "c": 3}');
  await textareas.nth(1).fill('{"c": 3, "a": 1, "b": 2}');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').includes('structurally identical'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /structurally identical/i);
  await page.close();
});

test('json-diff: an element inserted in the middle of an array is shown as one real addition, not a cascade of changes, verified live', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('[1, 2, 3]');
  await textareas.nth(1).fill('[1, 99, 2, 3]');
  // '3 unchanged' can only come from this new input -- the default
  // example's own badge already reads "1 added" before either textarea is
  // touched, so waiting on that alone would resolve immediately against
  // stale content instead of the real debounced re-render.
  await page.waitForFunction(() => (document.querySelector('.result .page-badge')?.textContent || '').includes('3 unchanged'));

  const badge = await page.locator('.result .page-badge').textContent();
  assert.match(badge, /0 changed/);
  assert.match(badge, /1 added/);
  assert.match(badge, /0 removed/);
  assert.match(badge, /3 unchanged/);
  await page.close();
});

test('json-diff: the Swap button exchanges the two values and re-diffs', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('{"a": 1}');
  await textareas.nth(1).fill('{"a": 2}');
  await page.waitForFunction(() => (document.querySelector('.result .page-badge')?.textContent || '').includes('1 changed'));

  await page.locator('button:has-text("Swap A")').click();
  await page.waitForFunction(() => (document.querySelectorAll('.result textarea')[0] || {}).value === '{"a": 2}');

  assert.equal(await textareas.nth(0).inputValue(), '{"a": 2}');
  assert.equal(await textareas.nth(1).inputValue(), '{"a": 1}');
  await page.close();
});

test('json-diff: invalid JSON on one side shows a specific error naming that side, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('{not valid json');
  await textareas.nth(1).fill('{"a": 1}');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').toLowerCase().includes('not valid json'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /not valid json/i);
  assert.match(status, /left/i);
  await page.close();
});

test('json-diff: both boxes empty shows a friendly "nothing to compare" message, not a blank panel', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('');
  await textareas.nth(1).fill('');
  await page.waitForFunction(() => (document.querySelector('.result .dz-status')?.textContent || '').toLowerCase().includes('paste json'));

  const status = await page.locator('.result .dz-status').textContent();
  assert.match(status, /paste json/i);
  await page.close();
});

test('json-diff: a pathologically deeply nested JSON document never crashes the page, real proof against the exact shape that broke an earlier version of the pure diff engine', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  // 5,000 levels -- well past the real RangeError: Maximum call stack size
  // exceeded this exact input shape produced from an earlier, uncapped
  // version of ../pure/jsonDiff.mjs's own diffJsonValues().
  const deepJson = await page.evaluate(() => {
    let s = '1';
    for (let i = 0; i < 5000; i += 1) s = `{"nested":${s}}`;
    return s;
  });

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill(deepJson);
  await textareas.nth(1).fill(deepJson);
  // The real, disclosed behavior here (see this tool's own FAQ on size/
  // depth limits): past the depth cap, even two IDENTICAL deep documents
  // conservatively report as "changed" rather than attempt an equality
  // check that could itself recurse arbitrarily deep -- the one honest
  // tradeoff for guaranteeing this never crashes instead. The real,
  // load-bearing assertion this test exists for is that the page renders
  // SOMETHING and produces zero console errors, not which exact verdict
  // it reaches.
  await page.waitForFunction(() => (document.querySelector('.result .page-badge')?.textContent || '').length > 0);

  const badge = await page.locator('.result .page-badge').textContent();
  assert.match(badge, /changed/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-diff: the copy button copies a real unified-diff-style text of the current comparison to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/json-diff/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .json-diff-tree');

  const textareas = page.locator('.result textarea');
  await textareas.nth(0).fill('{"a": 1}');
  await textareas.nth(1).fill('{"a": 2}');
  // '0 unchanged' can only come from this new input -- the default
  // example's own badge already reads "1 changed" before either textarea
  // is touched (see the sibling test's own comment on this same race).
  await page.waitForFunction(() => (document.querySelector('.result .page-badge')?.textContent || '').includes('0 unchanged'));

  await page.locator('button:has-text("Copy as diff text")').click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Copied'));

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText.replace(/\r\n/g, '\n'), '  {\n-   "a": 1\n+   "a": 2\n  }');
  await context.close();
});
