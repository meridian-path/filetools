'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BROWSER_DIR = path.join(__dirname, 'browser');

/**
 * Real, measured gzip weight (in bytes) of a file/paste-driven or
 * custom-panel tool's own initial-load JavaScript -- the shared
 * dropzone.client.js controller plus the tool's own clientEntry file for
 * the former, or the tool's own file (plus any Worker it spawns eagerly at
 * module-init time, not lazily on first interaction) for the latter.
 * Computed from the real vendored source in src/browser/ -- src/build.js
 * copies these files into dist/js/ byte-for-byte with no bundling or
 * minification step (see that file's own step-2 comment), so this number
 * is exactly what a browser transfers, never an estimate that can drift
 * from the shipped bytes.
 *
 * Craft-retrofit Phase 3(a) (developer folder): the one tool this applies
 * to today that spawns a Worker eagerly is regex-tester (see
 * regexTester.client.js's own header comment -- spawnWorker() runs at
 * module-init time, not on first keystroke, so the worker file is real
 * initial-load weight). No other tool on the site does this yet; a future
 * tool that does should be added to EAGER_WORKER_BY_CLIENT below rather
 * than hand-computed elsewhere.
 *
 * Phase 3(c) (spreadsheets folder): a tool with a `proFeature` (currently
 * only compare-csv) also always fetches that add-on's own client script --
 * toolPage.js's proFeatureHtml emits the <script> tag unconditionally
 * whenever `tool.proFeature` exists, not gated on whether the visitor has
 * actually unlocked it. realPageJsWeightBytes() below adds that file in
 * too, since it's real weight for every visitor, not a special case to
 * ignore.
 */
const EAGER_WORKER_BY_CLIENT = {
  regexTester: 'regexTester.worker.js',
};

function gzipBytes(file) {
  const buf = fs.readFileSync(path.join(BROWSER_DIR, file));
  return zlib.gzipSync(buf).length;
}

/**
 * @param {{clientEntry: string, customPanelMode?: boolean, proFeature?: {clientEntry: string}}} tool
 * @returns {number} combined gzip bytes of every script this tool's page
 *   fetches on first load.
 */
function realPageJsWeightBytes(tool) {
  const files = tool.customPanelMode
    ? [`${tool.clientEntry}.client.js`, ...(EAGER_WORKER_BY_CLIENT[tool.clientEntry] ? [EAGER_WORKER_BY_CLIENT[tool.clientEntry]] : [])]
    : ['dropzone.client.js', `${tool.clientEntry}.client.js`];
  // A tool with a `proFeature` (currently only compare-csv) loads that
  // add-on's own client script unconditionally on every page load --
  // toolPage.js's proFeatureHtml emits the <script> tag whenever
  // `tool.proFeature` exists, not gated on whether the visitor has
  // actually unlocked it (see that file's own proFeatureHtml comment).
  // Real initial-load weight for every visitor, not an edge case to skip.
  if (tool.proFeature && tool.proFeature.clientEntry) files.push(`${tool.proFeature.clientEntry}.client.js`);
  return files.reduce((sum, f) => sum + gzipBytes(f), 0);
}

/**
 * @param {{clientEntry: string, customPanelMode?: boolean}} tool
 * @returns {string} e.g. "11KB" -- rounded to the nearest whole KB, the
 *   same precision a reader would eyeball off a network-tab size column.
 */
function realPageJsWeightKbLabel(tool) {
  return `${Math.round(realPageJsWeightBytes(tool) / 1024)}KB`;
}

module.exports = { realPageJsWeightBytes, realPageJsWeightKbLabel };
