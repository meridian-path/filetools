import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import ExcelJSModule from 'exceljs';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

const ExcelJS = ExcelJSModule.default || ExcelJSModule;

/**
 * End-to-end tests for the CSV-to-XLSX tool: drive the built dist/ output
 * in a real headless browser, through both input paths, and verify the
 * actual downloaded .xlsx workbook's real cell values and types by
 * reading it back with the real ExcelJS npm package (not the vendored
 * browser bundle) - not just that a download happened. Mirrors
 * test/pdfTables.e2e.test.mjs's "read the real binary output back"
 * approach.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8',
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
  fs.writeFileSync(path.join(TMP, 'records.csv'), 'id,name,price\r\n0042,Widget,9.5\r\n0099,Gadget,14\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

async function downloadWorkbook(page, buttonText = 'Download') {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator(`button:has-text("${buttonText}")`).click(),
  ]);
  const outPath = path.join(TMP, `xlsx-out-${Date.now()}.xlsx`);
  await download.saveAs(outPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outPath);
  return { workbook, suggested: download.suggestedFilename() };
}

test('csv-to-xlsx: uploading a .csv file downloads a real .xlsx workbook - the leading-zero id column stays text, the price column becomes a real number', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/csv-to-xlsx/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'records.csv'));
  await page.waitForSelector('.table-block');

  const { workbook, suggested } = await downloadWorkbook(page);
  assert.equal(suggested, 'converted.xlsx');

  const sheet = workbook.getWorksheet('Sheet1');
  assert.equal(sheet.rowCount, 3);

  const headerRow = sheet.getRow(1).values.slice(1);
  assert.deepEqual(headerRow, ['id', 'name', 'price']);

  const dataRow1 = sheet.getRow(2).values.slice(1);
  // "0042" must survive as the literal text "0042", never the number 42 -
  // a real, independently-verified round trip through a real .xlsx file,
  // not a string comparison against this tool's own rendered preview.
  assert.equal(dataRow1[0], '0042');
  assert.equal(typeof dataRow1[0], 'string');
  assert.equal(dataRow1[1], 'Widget');
  assert.equal(dataRow1[2], 9.5);
  assert.equal(typeof dataRow1[2], 'number');

  const dataRow2 = sheet.getRow(3).values.slice(1);
  assert.equal(dataRow2[0], '0099');
  assert.equal(dataRow2[2], 14);
  assert.equal(typeof dataRow2[2], 'number');

  assert.deepEqual(errors, []);
  await page.close();
});

test('csv-to-xlsx: pasting CSV text and clicking convert produces the same real workbook', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/csv-to-xlsx/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'name,price\nCoffee,4.5\nTea,3.25');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const { workbook } = await downloadWorkbook(page, 'Download converted.xlsx');
  const sheet = workbook.getWorksheet('Sheet1');
  assert.equal(sheet.getRow(2).values.slice(1)[1], 4.5);
  assert.equal(typeof sheet.getRow(2).values.slice(1)[1], 'number');
  await page.close();
});

test('csv-to-xlsx: a column with one non-numeric value keeps the whole column as text', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/csv-to-xlsx/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'qty\n1\n2\nN/A');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const { workbook } = await downloadWorkbook(page, 'Download converted.xlsx');
  const sheet = workbook.getWorksheet('Sheet1');
  assert.equal(sheet.getRow(2).values[1], '1');
  assert.equal(typeof sheet.getRow(2).values[1], 'string');
  assert.equal(sheet.getRow(4).values[1], 'N/A');
  await page.close();
});

test('csv-to-xlsx: pasting whitespace-only text shows a friendly error, not a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/csv-to-xlsx/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   \n  ');
  await page.locator('#paste-convert').click();
  // Craft-audit fix (item 5): a paste-triggered status lives in this
  // paste box's OWN `.paste-status` line now, never the shared
  // `.dz-status` the unrelated file drop-zone owns.
  await page.waitForFunction(() => (document.querySelector('.paste-status')?.textContent || '').length > 0);
  const msg = await page.locator('.paste-status').textContent();
  assert.match(msg, /paste some csv first/i);
  await page.close();
});
