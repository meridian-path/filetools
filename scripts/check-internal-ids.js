'use strict';

/**
 * Mechanical check for a leaked internal task-/decision-id (the shared
 * Orchestra queue's own ID shape, e.g. "task-mt6jcfwr-ed62cc" or
 * "decision-mt3eshmp-4a3058") anywhere in this PUBLIC repo's source or
 * test files -- see .claude/rules/public-repo-hygiene.md rule 1 (no
 * task-/decision- IDs in anything public-facing, including source
 * comments) and .claude/rules/incidents.md's never-twice rule (this is
 * the 2nd occurrence of this exact incident class on this repo, task-
 * mt6ltz1z-243dc4 -- a self-attested "grep clean" claim in a task's own
 * progress_notes is not a substitute for a real mechanical check that
 * runs on every build, which is what this file is).
 *
 * Same multi-file scan shape as scripts/check-em-dash.js, with one
 * addition: an ID can be split across a line wrap inside a long comment
 * (a real miss during the first occurrence's own manual grep --
 * "task-mt6jcfwr-\ned62cc" split across two source lines does not match
 * a single-line regex), so each file is checked in two passes -- once
 * line by line, once over every adjacent pair of lines concatenated --
 * see findLeakedIds's own doc comment for why.
 *
 * Usage:
 *   node scripts/check-internal-ids.js
 * Exits 1 and prints every match (file, and the matched id) if anything
 * is found; exits 0 with a summary otherwise. Wired into `npm test` via
 * package.json's `pretest` script, alongside check-em-dash.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Scans this repo's own source/test/docs/CI config -- NOT dist/ (a fresh
// build output, regenerated every run, would only ever mirror src/ anyway)
// and NOT node_modules/vendor (third-party code this repo doesn't author).
// .github added after a near-miss: a CI workflow YAML comment is exactly
// as public-facing as any src/ comment, but was never scanned since it
// lived outside every prior SCAN_DIRS entry.
const SCAN_DIRS = ['src', 'test', 'scripts', 'docs', '.github'];

// Matches the shared queue's own id shape: "task-" or "decision-" followed
// by a lowercase-alphanumeric segment, a hyphen, and a hex segment (the
// exact shape every id cited in this session's own commit history uses,
// e.g. task-mt6jcfwr-ed62cc, decision-mt3eshmp-4a3058). Intentionally
// does NOT match this file's own header comment above (which discusses
// the pattern in prose) differently from real code -- a real occurrence
// anywhere, including a comment, is exactly what rule 1 forbids.
const ID_RE = /\b(?:task|decision)-[0-9a-z]+-[0-9a-f]{4,}\b/g;

function findFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(full));
    else if (/\.(js|mjs|css|md|html|yml|yaml)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * @param {string} filePath
 * @returns {string[]} every matched id in this file. Two passes: each
 *   stripped line checked on its own (preserves real word boundaries for
 *   the normal single-line case), plus every adjacent pair of stripped
 *   lines concatenated with no separator (catches an id split mid-hyphen
 *   across a line wrap, e.g. "task-mt6jcfwr-\ned62cc"). Pass two can only
 *   ever ADD matches to the found set, never remove one found by pass one,
 *   so it can't weaken the normal case while fixing the wrap case.
 */
function findLeakedIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip each line's own leading comment-continuation marker (`*` for a
  // JSDoc/block-comment continuation line, `//` for a line-comment
  // continuation) first -- otherwise an id wrapped across two source
  // lines (a real miss during this incident's own first manual grep
  // pass) would reassemble as "task-mt6jcfwr- * ed62cc" instead of
  // "task-mt6jcfwr-ed62cc", silently defeating the very check meant to
  // catch it.
  // trim() after stripping the marker (not just one optional space): a
  // JSDoc continuation line is often indented several spaces past the
  // marker for alignment (e.g. " *   mt6jcfwr-..." under a wrapped
  // "@returns" line) -- leaving that indentation in place defeated the
  // very adjacent-line-pair concatenation below (real miss, caught by
  // this file's own check missing a genuine leak in src/structuredData.js:
  // concatenating "...task-" with "  mt6jcfwr-..." left a two-space gap
  // inside the id, which ID_RE's no-internal-whitespace shape can't
  // match). Trimming is safe for the per-line pass too, since match()
  // doesn't care about surrounding whitespace either way.
  const strippedLines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\*|\/\/)\s?/, '').trim());

  const matches = [];
  for (const line of strippedLines) {
    matches.push(...(line.match(ID_RE) || []));
  }
  // Concatenating two full lines with no separator (not just their tail/
  // head) is deliberately wasteful but simple, and safe: a match found
  // only in the concatenation and not in either line alone can only be
  // one that genuinely spans the line break, since ID_RE's `\b` anchors
  // mean a match wholly inside one line's own text is already found by
  // the per-line pass above.
  for (let i = 0; i < strippedLines.length - 1; i += 1) {
    const pair = strippedLines[i] + strippedLines[i + 1];
    matches.push(...(pair.match(ID_RE) || []));
  }
  return [...new Set(matches)];
}

// This checker's own header comment, and its own regression test's
// literal id-shaped fixtures (needed to actually exercise the matching
// logic), are the two legitimate places these patterns appear as prose/
// test data rather than a real leak. test/check-copy-tells.test.mjs joins
// this list for the same reason: it needs literal id-shaped fixtures
// ("task-mt6jcfwr-ed62cc" etc.) to exercise check-copy-tells.js's own
// process-talk-marker detection, which reuses this file's ID_RE against
// rendered dist/ output rather than source.
const EXCLUDED_FILES = [
  __filename,
  path.join(ROOT, 'test', 'check-internal-ids.test.mjs'),
  path.join(ROOT, 'test', 'check-copy-tells.test.mjs'),
].map((f) => path.resolve(f));

function main() {
  const files = SCAN_DIRS.flatMap((d) => findFiles(path.join(ROOT, d)))
    .filter((f) => !EXCLUDED_FILES.includes(path.resolve(f)));

  const offenders = [];
  for (const file of files) {
    const ids = findLeakedIds(file);
    if (ids.length > 0) offenders.push({ file: path.relative(ROOT, file), ids });
  }

  if (offenders.length > 0) {
    console.error(`Internal task-/decision-id check FAILED on ${offenders.length} file(s):`);
    for (const { file, ids } of offenders) {
      console.error(`  ${file}: ${ids.join(', ')}`);
    }
    console.error('\nSee .claude/rules/public-repo-hygiene.md rule 1 -- no internal task-/decision- ids in anything public-facing, including source comments. Rewrite the comment to state the reasoning/citation without the internal ticket id.');
    process.exitCode = 1;
    return;
  }

  console.log(`Internal task-/decision-id check passed on ${files.length} files -- zero leaked ids.`);
}

if (require.main === module) {
  main();
}

module.exports = { findLeakedIds, ID_RE, findFiles, SCAN_DIRS };
