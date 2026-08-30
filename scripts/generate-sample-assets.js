'use strict';

/**
 * Local, one-off generator for the per-tool "try a sample" fixture files
 * (the Squoosh sample-input pattern -- see src/pages/toolPage.js's
 * `sampleInput` field). Same shape as scripts/build-og-image.js: NOT part
 * of `npm run build` (the main static build must not depend on pdf-lib
 * doc-building or a browser being available at build time), run by hand
 * whenever a sample fixture needs to change, then commit the files it
 * writes under assets/samples/:
 *
 *   node scripts/generate-sample-assets.js
 *
 * src/build.js copies assets/samples/** into dist/samples/** on every
 * build. Each PDF is built with real pdf-lib text draws (mirrors
 * test/tools.e2e.test.mjs's a.pdf/b.pdf, test/statementToCsv.e2e.test.mjs's
 * buildStatementPdf(), test/pdfTables.e2e.test.mjs's buildTablePdf(),
 * test/pdfToImages.e2e.test.mjs's colored-page builder, and
 * test/pdfImageExtract.e2e.test.mjs's real embedJpg()+drawImage() -- same
 * recipes, reused here instead of re-invented, so these bundled samples
 * exercise the exact real-PDF shapes those tests already verify against).
 * Photo samples are real canvas.toDataURL() images captured in an actual
 * Playwright page (mirrors test/imageResizeCompress.e2e.test.mjs's fixture
 * comment) rather than hand-encoded bytes. The HEIC sample is a real,
 * already-vetted fixture copied from test/fixtures/testsrc.heic (see that
 * directory's own README for its provenance/license) rather than a new
 * generation, since there is no practical way to encode a real HEIC file
 * from Node or a browser. The xlsx samples are built with the real exceljs
 * package (same as test/xlsxToJson.e2e.test.mjs's own fixture-building).
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const ExcelJSModule = require('exceljs');
const ExcelJS = ExcelJSModule.default || ExcelJSModule;

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'samples');
const FIXTURES_DIR = path.join(__dirname, '..', 'test', 'fixtures');

async function writeMergePdfSamples() {
  const dir = path.join(ASSETS_DIR, 'merge-pdf');
  fs.mkdirSync(dir, { recursive: true });

  const a = await PDFDocument.create();
  const aFont = await a.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 2; i += 1) {
    const p = a.addPage([300, 300]);
    p.drawText(`Sample A - page ${i + 1}`, { x: 24, y: 150, size: 18, font: aFont, color: rgb(0.1, 0.3, 0.6) });
  }
  fs.writeFileSync(path.join(dir, 'sample-a.pdf'), await a.save());

  const b = await PDFDocument.create();
  const bFont = await b.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 2; i += 1) {
    const p = b.addPage([300, 300]);
    p.drawText(`Sample B - page ${i + 1}`, { x: 24, y: 150, size: 18, font: bFont, color: rgb(0.6, 0.2, 0.1) });
  }
  fs.writeFileSync(path.join(dir, 'sample-b.pdf'), await b.save());

  console.log(`Wrote ${path.join(dir, 'sample-a.pdf')} and sample-b.pdf (2 pages each)`);
}

/** Same table shape test/statementToCsv.e2e.test.mjs's buildStatementPdf()
 * verifies against: a short letterhead confined to the first column's
 * x-range, then a 3-column Date/Description/Amount table with the same
 * header repeated on both pages, so a visitor clicking the sample sees the
 * tool's real header-de-duplication behavior, not just a single flat page. */
async function writeStatementSample() {
  const dir = path.join(ASSETS_DIR, 'bank-statement-to-csv');
  fs.mkdirSync(dir, { recursive: true });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const header = ['Date', 'Description', 'Amount'];
  const xs = [20, 180, 380];

  const page1Rows = [
    header,
    ['2026-02-02', 'Coffee Shop', '-4.75'],
    ['2026-02-03', 'Direct Deposit Paycheck', '1620.00'],
    ['2026-02-07', 'Grocery Store', '-58.32'],
  ];
  const page2Rows = [
    header,
    ['2026-02-15', 'Electric Company', '-91.40'],
    ['2026-02-18', 'Streaming Service', '-13.99'],
    ['2026-02-22', 'ATM Withdrawal', '-80.00'],
  ];

  for (const rows of [page1Rows, page2Rows]) {
    const page = doc.addPage([520, 300]);
    const draw = (text, x, y) => page.drawText(text, { x, y, size, font });
    draw('Sample Statement', 20, 270);
    let y = 230;
    for (const row of rows) {
      row.forEach((cell, i) => draw(cell, xs[i], y));
      y -= 22;
    }
  }

  fs.writeFileSync(path.join(dir, 'sample-statement.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample-statement.pdf')} (2 pages, 6 transaction rows)`);
}

/** A real canvas-drawn landscape scene (sky gradient, ground, sun, a row of
 * triangular "trees" whose hue shifts with `hueOffset` so two calls produce
 * visibly different, not copy-pasted, images). Returns a data URL. */
async function landscapePhotoDataUrl(page, { width, height, format, hueOffset = 0 }) {
  return page.evaluate(({ w, h, fmt, hue }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const groundY = Math.round(h * 0.67);
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, `hsl(${(210 + hue) % 360}, 55%, 55%)`);
    sky.addColorStop(1, `hsl(${(200 + hue) % 360}, 60%, 80%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);
    ctx.fillStyle = `hsl(${(100 + hue) % 360}, 40%, 35%)`;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = `hsl(${(45 + hue) % 360}, 85%, 60%)`;
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.18, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    const treeCount = 6;
    for (let i = 0; i < treeCount; i += 1) {
      ctx.fillStyle = `hsl(${(hue + i * 47) % 360}, 55%, 40%)`;
      const cx = w * (0.1 + i * (0.8 / (treeCount - 1)));
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.05, groundY);
      ctx.lineTo(cx, groundY - h * 0.22);
      ctx.lineTo(cx + w * 0.05, groundY);
      ctx.closePath();
      ctx.fill();
    }
    return canvas.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', 0.9);
  }, { w: width, h: height, fmt: format, hue: hueOffset });
}

async function writeImageResizeSample(browser) {
  const dir = path.join(ASSETS_DIR, 'image-resize-compress');
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  try {
    await page.goto('about:blank');
    const dataUrl = await landscapePhotoDataUrl(page, { width: 640, height: 480, format: 'jpeg', hueOffset: 0 });
    fs.writeFileSync(path.join(dir, 'sample-photo.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`Wrote ${path.join(dir, 'sample-photo.jpg')} (640x480)`);
  } finally {
    await page.close();
  }
}

async function writeCompareCsvSamples() {
  const dir = path.join(ASSETS_DIR, 'compare-csv');
  fs.mkdirSync(dir, { recursive: true });
  // ID is a unique column in both files, so the tool's own auto-detected
  // match-by-value key kicks in: row 2 shows as CHANGED (amount edited),
  // row 3 as REMOVED, and row 4 as ADDED, with row 1 UNCHANGED.
  const a = 'ID,Name,Amount\n1,Widget,10\n2,Gadget,20\n3,Gizmo,30\n';
  const b = 'ID,Name,Amount\n1,Widget,10\n2,Gadget,25\n4,Doohickey,40\n';
  fs.writeFileSync(path.join(dir, 'sample-a.csv'), a);
  fs.writeFileSync(path.join(dir, 'sample-b.csv'), b);
  console.log(`Wrote ${path.join(dir, 'sample-a.csv')} and sample-b.csv (1 unchanged, 1 changed, 1 removed, 1 added)`);
}

async function writeMergeCsvSamples() {
  const dir = path.join(ASSETS_DIR, 'merge-csv');
  fs.mkdirSync(dir, { recursive: true });
  // Deliberately mismatched columns (Email vs Phone) so the merged result
  // demonstrates the tool's real union-by-header-name behavior, with blanks
  // filled in rather than data shifted into the wrong column.
  const a = 'Name,Email\nAlice,alice@example.com\nBob,bob@example.com\n';
  const b = 'Name,Phone\nCarol,555-0101\nDave,555-0102\n';
  fs.writeFileSync(path.join(dir, 'sample-a.csv'), a);
  fs.writeFileSync(path.join(dir, 'sample-b.csv'), b);
  console.log(`Wrote ${path.join(dir, 'sample-a.csv')} and sample-b.csv (mismatched columns)`);
}

async function writeExtractImagesPdfSample(browser) {
  const dir = path.join(ASSETS_DIR, 'extract-images-from-pdf');
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 300, height: 200 } });
  let jpegBytes;
  try {
    await page.goto('about:blank');
    const dataUrl = await landscapePhotoDataUrl(page, { width: 300, height: 200, format: 'jpeg', hueOffset: 90 });
    // pdf-lib's own embedJpg() reads `imageData.buffer` directly via
    // `new DataView(imageData.buffer)`, ignoring byteOffset entirely -- a
    // small Node Buffer.from(base64) allocation often comes from Node's
    // shared small-buffer pool with a nonzero byteOffset into a much larger
    // underlying ArrayBuffer, which that DataView then misreads from
    // offset 0, throwing "SOI not found in JPEG" even on a genuinely valid
    // JPEG. Uint8Array.from() makes a real copy into its own fresh
    // ArrayBuffer at offset 0, sidestepping the bug (confirmed live: the
    // exact same bytes fail via embedJpg(rawBuffer) and succeed via
    // embedJpg(Uint8Array.from(rawBuffer))).
    jpegBytes = Uint8Array.from(Buffer.from(dataUrl.split(',')[1], 'base64'));
  } finally {
    await page.close();
  }

  const doc = await PDFDocument.create();
  const embedded = await doc.embedJpg(jpegBytes);
  for (let i = 0; i < 2; i += 1) {
    const p = doc.addPage([340, 240]);
    p.drawImage(embedded, { x: 20, y: 20, width: embedded.width, height: embedded.height });
  }
  fs.writeFileSync(path.join(dir, 'sample-with-images.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample-with-images.pdf')} (2 pages, 1 embedded JPEG each)`);
}

async function writeJpgPngToPdfSamples(browser) {
  const dir = path.join(ASSETS_DIR, 'jpg-png-to-pdf');
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  try {
    await page.goto('about:blank');
    const jpegDataUrl = await landscapePhotoDataUrl(page, { width: 320, height: 240, format: 'jpeg', hueOffset: 180 });
    fs.writeFileSync(path.join(dir, 'sample-a.jpg'), Buffer.from(jpegDataUrl.split(',')[1], 'base64'));
    const pngDataUrl = await landscapePhotoDataUrl(page, { width: 320, height: 240, format: 'png', hueOffset: 270 });
    fs.writeFileSync(path.join(dir, 'sample-b.png'), Buffer.from(pngDataUrl.split(',')[1], 'base64'));
    console.log(`Wrote ${path.join(dir, 'sample-a.jpg')} and sample-b.png (one of each format, per this tool's own "mix JPG and PNG" FAQ)`);
  } finally {
    await page.close();
  }
}

/** Copies the already-vetted real HEIC fixture (see test/fixtures/README.md
 * for its provenance/license) rather than generating a new one -- there is
 * no practical way to encode a real HEIC file from Node or a browser (this
 * repo's one HEIC-capable library, heic2any, only decodes). */
async function writeHeicSample() {
  const dir = path.join(ASSETS_DIR, 'heic-to-jpg-png');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES_DIR, 'testsrc.heic'), path.join(dir, 'sample-photo.heic'));
  console.log(`Wrote ${path.join(dir, 'sample-photo.heic')} (copied from test/fixtures/testsrc.heic)`);
}

async function writePdfRotateSample() {
  const dir = path.join(ASSETS_DIR, 'rotate-pdf');
  fs.mkdirSync(dir, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 2; i += 1) {
    const p = doc.addPage([300, 300]);
    p.drawText(`Sample page ${i + 1}`, { x: 24, y: 150, size: 18, font, color: rgb(0.15, 0.15, 0.15) });
  }
  fs.writeFileSync(path.join(dir, 'sample.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample.pdf')} (2 pages)`);
}

async function writePdfSplitSample() {
  const dir = path.join(ASSETS_DIR, 'split-pdf');
  fs.mkdirSync(dir, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 4; i += 1) {
    const p = doc.addPage([300, 300]);
    p.drawText(`Sample page ${i + 1}`, { x: 24, y: 150, size: 18, font, color: rgb(0.15, 0.15, 0.15) });
  }
  fs.writeFileSync(path.join(dir, 'sample.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample.pdf')} (4 pages, so a "1-2" range is meaningful)`);
}

/** Same table shape test/pdfTables.e2e.test.mjs's own buildTablePdf()
 * verifies against. */
async function writePdfTablesSample() {
  const dir = path.join(ASSETS_DIR, 'pdf-to-csv');
  fs.mkdirSync(dir, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 420]);
  const size = 12;
  const draw = (text, x, y) => page.drawText(text, { x, y, size, font });

  draw('Fruit Inventory Report', 20, 390);
  const rows = [
    ['Name', 'Qty', 'Price'],
    ['Apples', '3', '$1.50'],
    ['Bananas', '12', '$0.75'],
    ['Cherries', '5', '$4.20'],
  ];
  const xs = [20, 160, 260];
  let y = 350;
  for (const row of rows) {
    row.forEach((cell, i) => draw(cell, xs[i], y));
    y -= 22;
  }
  fs.writeFileSync(path.join(dir, 'sample-table.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample-table.pdf')} (1 page, 3-column table)`);
}

/** Same colored-page shape test/pdfToImages.e2e.test.mjs's own builder
 * verifies against -- a visibly different color per page, so the rendered
 * zip of images is obviously not one page repeated. */
async function writePdfToImagesSample() {
  const dir = path.join(ASSETS_DIR, 'pdf-to-jpg-png');
  fs.mkdirSync(dir, { recursive: true });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const colors = [rgb(0.75, 0.25, 0.25), rgb(0.25, 0.45, 0.75)];
  for (let i = 0; i < 2; i += 1) {
    const p = doc.addPage([200, 150]);
    p.drawRectangle({ x: 0, y: 0, width: 200, height: 150, color: colors[i] });
    p.drawText(`Page ${i + 1}`, { x: 20, y: 70, size: 18, font, color: rgb(1, 1, 1) });
  }
  fs.writeFileSync(path.join(dir, 'sample.pdf'), await doc.save());
  console.log(`Wrote ${path.join(dir, 'sample.pdf')} (2 colored pages)`);
}

/** Same small-workbook shape test/xlsxToJson.e2e.test.mjs's own fixture
 * builder verifies against -- one real ExcelJS workbook, written once and
 * copied to both xlsx-to-csv's and xlsx-to-json's own sample directory
 * (identical content, since both tools read the same input shape). */
async function writeXlsxSamples() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Orders');
  ws.addRow(['Name', 'Price', 'InStock']);
  ws.addRow(['Coffee', 4.5, true]);
  ws.addRow(['Tea', 3.25, false]);
  ws.addRow(['Cocoa', 5.75, true]);

  for (const slug of ['xlsx-to-csv', 'xlsx-to-json']) {
    const dir = path.join(ASSETS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    await workbook.xlsx.writeFile(path.join(dir, 'sample.xlsx'));
    console.log(`Wrote ${path.join(dir, 'sample.xlsx')} (1 sheet, 3 rows)`);
  }
}

async function main() {
  await writeMergePdfSamples();
  await writeStatementSample();
  await writeCompareCsvSamples();
  await writeMergeCsvSamples();
  await writeHeicSample();
  await writePdfRotateSample();
  await writePdfSplitSample();
  await writePdfTablesSample();
  await writePdfToImagesSample();
  await writeXlsxSamples();

  const browser = await chromium.launch();
  try {
    await writeImageResizeSample(browser);
    await writeExtractImagesPdfSample(browser);
    await writeJpgPngToPdfSamples(browser);
  } finally {
    await browser.close();
  }

  console.log('Done. Run `npm run build` to copy these into dist/samples/.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('generate-sample-assets failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  writeMergePdfSamples,
  writeStatementSample,
  writeImageResizeSample,
  writeCompareCsvSamples,
  writeMergeCsvSamples,
  writeExtractImagesPdfSample,
  writeJpgPngToPdfSamples,
  writeHeicSample,
  writePdfRotateSample,
  writePdfSplitSample,
  writePdfTablesSample,
  writePdfToImagesSample,
  writeXlsxSamples,
};
