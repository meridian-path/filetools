'use strict';

/**
 * One-shot capture of a single external page's above-the-fold desktop view,
 * for building this repo's competitor/template screenshot library (see the
 * craft doctrine's lineup test for the ritual this feeds, and
 * `scripts/lineup-squint.js`'s own header comment for where the resulting
 * files are expected to live and how they get composed into a lineup).
 *
 * Deliberately NOT wired into any automated run -- competitor sites change
 * on their own schedule, not this repo's build cadence, so refreshing the
 * library is a one-off, human-triggered action, not something CI re-fetches
 * on every push.
 *
 * Usage:
 *   node scripts/capture-competitor-screenshot.js <url> <output-png-path>
 *
 * Captures a NON-full-page 1440x900 viewport screenshot only (the same
 * "identifiable at a glance" hero view the lineup test itself judges, not a
 * full scroll) -- matches the shape `scripts/lineup-squint.js` captures for
 * this repo's own pages, so every tile in a composed lineup is a like-for-
 * like comparison.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VIEWPORT = { width: 1440, height: 900 };

async function captureCompetitorScreenshot(url, outputPath) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}

async function main() {
  const [, , url, outputPath] = process.argv;
  if (!url || !outputPath) {
    console.error('Usage: node scripts/capture-competitor-screenshot.js <url> <output-png-path>');
    process.exitCode = 1;
    return;
  }
  console.log(`Capturing ${url} -> ${outputPath}`);
  await captureCompetitorScreenshot(url, outputPath);
  console.log('Saved.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('capture-competitor-screenshot failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { captureCompetitorScreenshot, VIEWPORT };
