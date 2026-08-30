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
 * test/tools.e2e.test.mjs's a.pdf/b.pdf and
 * test/statementToCsv.e2e.test.mjs's buildStatementPdf() -- same recipe,
 * reused here instead of re-invented, so these bundled samples exercise
 * the exact same real-PDF shape those tests already verify against). The
 * photo sample is a real canvas.toDataURL() JPEG captured in an actual
 * Playwright page (mirrors test/imageResizeCompress.e2e.test.mjs's fixture
 * comment) rather than hand-encoded bytes, so it's a genuine decodable
 * JPEG, not a synthetic stand-in.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'samples');

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

async function writeImageResizeSample(browser) {
  const dir = path.join(ASSETS_DIR, 'image-resize-compress');
  fs.mkdirSync(dir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  try {
    await page.goto('about:blank');
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const sky = ctx.createLinearGradient(0, 0, 0, 480);
      sky.addColorStop(0, '#4a7fc9');
      sky.addColorStop(1, '#bcd9f0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 640, 320);
      ctx.fillStyle = '#3c7a3c';
      ctx.fillRect(0, 320, 640, 160);
      ctx.fillStyle = '#f4d35e';
      ctx.beginPath();
      ctx.arc(520, 90, 50, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = `hsl(${(i * 47) % 360}, 55%, 45%)`;
        ctx.beginPath();
        ctx.moveTo(60 + i * 90, 320);
        ctx.lineTo(90 + i * 90, 220 - (i % 3) * 20);
        ctx.lineTo(120 + i * 90, 320);
        ctx.closePath();
        ctx.fill();
      }
      return canvas.toDataURL('image/jpeg', 0.9);
    });
    fs.writeFileSync(path.join(dir, 'sample-photo.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`Wrote ${path.join(dir, 'sample-photo.jpg')} (640x480)`);
  } finally {
    await page.close();
  }
}

async function main() {
  await writeMergePdfSamples();
  await writeStatementSample();

  const browser = await chromium.launch();
  try {
    await writeImageResizeSample(browser);
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

module.exports = { writeMergePdfSamples, writeStatementSample, writeImageResizeSample };
