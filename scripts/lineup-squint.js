'use strict';

/**
 * Composes the two rituals the craft doctrine names as visual-QA checks
 * (definitions live there, not restated here -- see the craft doctrine's
 * section 2.4 "the rituals"):
 *
 *   - The LINEUP TEST: this repo's own screenshot placed alongside 4-5
 *     competitor/template screenshots in one composed image, so a reviewer
 *     can judge at a glance whether the surface reads as not-a-template.
 *   - The SQUINT TEST: a heavily blurred variant of this repo's own
 *     screenshot, so a reviewer can judge whether one dominant element's
 *     hierarchy survives losing all fine detail.
 *
 * Competitor/template screenshots are PROVIDED, not fetched live by this
 * script -- they live in `visual-qa-competitors/<tool-slug>/*.png` per
 * asset (see this repo's TESTING.md for the full convention and how a
 * reviewer records a verdict). Populate that directory ahead of time with
 * `scripts/capture-competitor-screenshot.js`, or any real screenshot.
 *
 * Deliberately zero new dependencies: both composed images are built by
 * rendering a small throwaway HTML page (a CSS grid for the lineup, a CSS
 * `filter: blur()` for the squint) through the Playwright browser this repo
 * already depends on for `visual-qa.js`, then screenshotting that page --
 * the same trick, not an image-processing library.
 *
 * Usage:
 *   node scripts/lineup-squint.js <target-url-or-local-html-path> <competitors-dir> [blur-px]
 *
 * Examples:
 *   node scripts/lineup-squint.js dist/data/hash-generator/index.html visual-qa-competitors/hash-generator
 *   node scripts/lineup-squint.js http://localhost:8080/data/hash-generator/ visual-qa-competitors/hash-generator 24
 *
 * Outputs two PNGs into OUTPUT_DIR (same `visual-qa-output/` directory
 * `visual-qa.js` already uses and this repo's `.gitignore` already excludes
 * from version control): `<page>-lineup.png` and `<page>-squint.png`.
 * Prints nothing but the two saved paths and a reminder that a human
 * reviewer still has to actually look at them and record a verdict --
 * this script produces the artifact, it does not itself judge it.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  OUTPUT_DIR,
  isHttpUrl,
  pageNameFor,
  findSiteRoot,
  startStaticServer,
} = require('./visual-qa.js');

const TARGET_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_BLUR_PX = 20;
const IMAGE_EXT_RE = /\.(png|jpe?g)$/i;

/** Minimal HTML-escaping for text placed inside element content. */
function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/** Minimal escaping for text placed inside a double-quoted HTML attribute. */
function escapeAttr(text) {
  return String(text).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
}

/**
 * Reads every image file directly inside `dir` (non-recursive), sorted by
 * filename for a stable, reproducible lineup order. Throws (rather than
 * silently composing a too-small lineup) if fewer than 2 usable images are
 * found -- a lineup of one competitor is not the ritual the doctrine
 * describes. Does not enforce an upper bound: the doctrine names "4-5" as
 * the expected count, but a caller adding a 6th reference screenshot is a
 * judgment call for whoever curates the directory, not this function's to
 * block.
 *
 * @param {string} dir
 * @returns {{ label: string, absPath: string }[]}
 */
function readCompetitorScreenshots(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Competitor/template screenshots directory not found: ${dir}\n`
      + 'Populate it first -- see scripts/capture-competitor-screenshot.js and this repo\'s TESTING.md.',
    );
  }
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (files.length < 2) {
    throw new Error(
      `Expected at least 2 competitor/template screenshots in ${dir}, found ${files.length}. `
      + 'The lineup test needs real comparators to judge "identifiable at a glance" against.',
    );
  }
  return files.map((file) => ({
    label: path.basename(file, path.extname(file)).replace(/[-_]+/g, ' '),
    absPath: path.join(dir, file),
  }));
}

/** Reads an image file and returns it as a `data:` URI, for embedding directly in a throwaway HTML page with no filesystem/CORS wrinkles. */
function toDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const bytes = fs.readFileSync(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/**
 * Builds the lineup page: every entry's image in one row, equal width,
 * with a small caption underneath for the record (the doctrine's "at a
 * glance" judgment is made by looking at the row as a whole; captions are
 * for the saved artifact's own record-keeping, not to be read before
 * judging).
 *
 * @param {{ label: string, src: string }[]} entries
 * @returns {string} full HTML document
 */
function buildLineupHtml(entries) {
  const cells = entries
    .map(
      (entry) => `    <figure class="cell">
      <img src="${escapeAttr(entry.src)}" alt="${escapeAttr(entry.label)}">
      <figcaption>${escapeHtml(entry.label)}</figcaption>
    </figure>`,
    )
    .join('\n');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #1a1a1a; font-family: system-ui, sans-serif; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${entries.length}, 1fr);
    gap: 12px;
    padding: 16px;
  }
  .cell {
    margin: 0;
    background: #fff;
    border-radius: 6px;
    overflow: hidden;
    border: 2px solid #333;
  }
  .cell img { display: block; width: 100%; height: auto; }
  .cell figcaption {
    font-size: 12px;
    padding: 6px 8px;
    color: #222;
    text-align: center;
    background: #f4f4f4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
</head>
<body>
  <div class="grid">
${cells}
  </div>
</body>
</html>`;
}

/**
 * Builds the squint page: one image, heavily blurred via CSS. The blur
 * radius is deliberately strong (default 20px against a 1440px-wide
 * screenshot) -- the squint test's whole point is losing fine detail so
 * only large shapes/contrast remain, not a light softening.
 *
 * @param {string} src data: URI or any valid <img src>
 * @param {number} blurPx
 * @returns {string} full HTML document
 */
function buildSquintHtml(src, blurPx = DEFAULT_BLUR_PX) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #1a1a1a; }
  img { display: block; width: 100%; height: auto; filter: blur(${blurPx}px); }
</style>
</head>
<body>
  <img src="${escapeAttr(src)}">
</body>
</html>`;
}

/** Renders an HTML string in a throwaway page sized to fit its content and screenshots it. */
async function renderHtmlToScreenshot(browser, html, outputPath, viewport) {
  const page = await browser.newPage({ viewport });
  await page.setContent(html, { waitUntil: 'networkidle' });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
}

/** Captures this repo's own target page as a non-full-page 1440x900 viewport screenshot -- the same "hero view" shape every competitor screenshot in the library is captured at, for a like-for-like lineup. */
async function captureTargetScreenshot(browser, target) {
  let server = null;
  let pageUrl;
  if (isHttpUrl(target)) {
    pageUrl = target;
  } else {
    const absPath = path.resolve(target);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Target file not found: ${absPath}`);
    }
    const rootDir = findSiteRoot(path.dirname(absPath));
    server = await startStaticServer(rootDir);
    const port = server.address().port;
    const relPath = path.relative(rootDir, absPath).split(path.sep).join('/');
    pageUrl = `http://localhost:${port}/${relPath}`;
  }
  try {
    const page = await browser.newPage({ viewport: TARGET_VIEWPORT });
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const tmpPath = path.join(OUTPUT_DIR, `${pageNameFor(target)}-target-raw.png`);
    await page.screenshot({ path: tmpPath, fullPage: false });
    await page.close();
    return tmpPath;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const [, , target, competitorsDir, blurArg] = process.argv;
  if (!target || !competitorsDir) {
    console.error('Usage: node scripts/lineup-squint.js <target-url-or-local-html-path> <competitors-dir> [blur-px]');
    process.exitCode = 1;
    return;
  }
  const blurPx = blurArg ? Number(blurArg) : DEFAULT_BLUR_PX;
  if (!Number.isFinite(blurPx) || blurPx <= 0) {
    console.error(`Invalid blur-px: ${blurArg}`);
    process.exitCode = 1;
    return;
  }

  const competitors = readCompetitorScreenshots(competitorsDir);
  const pageName = pageNameFor(target);

  const browser = await chromium.launch({ headless: true });
  try {
    console.log(`Capturing target screenshot: ${target}`);
    const targetRawPath = await captureTargetScreenshot(browser, target);

    const entries = [
      { label: 'usefiletools.com (ours)', src: toDataUri(targetRawPath) },
      ...competitors.map((c) => ({ label: c.label, src: toDataUri(c.absPath) })),
    ];

    const lineupHtml = buildLineupHtml(entries);
    const lineupPath = path.join(OUTPUT_DIR, `${pageName}-lineup.png`);
    await renderHtmlToScreenshot(browser, lineupHtml, lineupPath, {
      width: Math.min(entries.length * 340, 4000),
      height: 900,
    });
    console.log(`  saved ${path.relative(process.cwd(), lineupPath)}`);

    const squintHtml = buildSquintHtml(toDataUri(targetRawPath), blurPx);
    const squintPath = path.join(OUTPUT_DIR, `${pageName}-squint.png`);
    await renderHtmlToScreenshot(browser, squintHtml, squintPath, TARGET_VIEWPORT);
    console.log(`  saved ${path.relative(process.cwd(), squintPath)}`);

    console.log('');
    console.log('Both images produced. A human reviewer still has to view them and record a');
    console.log('PASS/FAIL verdict for each ritual -- see this repo\'s TESTING.md for where.');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('lineup-squint failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  readCompetitorScreenshots,
  toDataUri,
  buildLineupHtml,
  buildSquintHtml,
  escapeHtml,
  escapeAttr,
  DEFAULT_BLUR_PX,
};
