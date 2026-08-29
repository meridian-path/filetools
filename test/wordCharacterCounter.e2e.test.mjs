import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the Word & Character Counter tool: drive the built
 * dist/ output in a real headless browser. Like uuidGenerator.e2e.test.mjs/
 * regexTester.e2e.test.mjs, this tool has no file/paste-driven input --
 * its own client file (src/browser/wordCharacterCounter.client.js) is
 * loaded directly by the page rather than through
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

test('word-character-counter: the page renders stats for the default sample text immediately on load, no interaction needed', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/word-character-counter/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block-head .page-badge');

  const badges = await page.locator('.result .table-block-head .page-badge').allTextContents();
  assert.equal(badges.length, 5);
  assert.match(badges[0], /^\d+ words?$/);
  assert.match(badges[1], /^\d+ characters?$/);
  assert.match(badges[2], /^\d+ without spaces$/);
  assert.match(badges[3], /^\d+ sentences?$/);
  assert.match(badges[4], /min read|< 1 min read/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('word-character-counter: typing character-by-character updates every stat live, no button click needed', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-character-counter/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block-head .page-badge');

  const textarea = page.locator('.result textarea');
  await textarea.fill('');
  await textarea.pressSequentially('One. Two. Three.', { delay: 10 });

  await page.waitForFunction(() => {
    const badges = [...document.querySelectorAll('.result .table-block-head .page-badge')];
    return badges[0]?.textContent === '3 words' && badges[3]?.textContent === '3 sentences';
  });

  assert.equal(await textarea.inputValue(), 'One. Two. Three.');
  await page.close();
});

test('word-character-counter: character counts split correctly with and without spaces', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-character-counter/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block-head .page-badge');

  const textarea = page.locator('.result textarea');
  await textarea.fill('ab cd');

  await page.waitForFunction(() => {
    const badges = [...document.querySelectorAll('.result .table-block-head .page-badge')];
    return badges[1]?.textContent === '5 characters' && badges[2]?.textContent === '4 without spaces';
  });
  await page.close();
});

test('word-character-counter: clearing the text resets every stat to zero, no stale numbers left over', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-character-counter/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.result .table-block-head .page-badge');

  const textarea = page.locator('.result textarea');
  await textarea.fill('');

  await page.waitForFunction(() => {
    const badges = [...document.querySelectorAll('.result .table-block-head .page-badge')];
    return badges[0]?.textContent === '0 words' && badges[4]?.textContent === '0 min read';
  });
  await page.close();
});
