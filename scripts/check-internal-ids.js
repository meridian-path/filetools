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
 * SCAN SCOPE: walks the full `git ls-files` tree (see scannableTrackedFiles()),
 * not a hand-maintained directory allowlist. This checker previously scanned
 * only an explicit SCAN_DIRS list ('src', 'test', 'scripts', 'docs',
 * '.github', '.claude', 'visual-qa-competitors'), which went unscanned for a
 * newly-added tracked top-level directory until someone remembered to add it
 * -- the exact shape that bit this checker FOUR separate times (the original
 * narrow scope; .github added only after a near-miss; .claude added only
 * after "the same class of gap recurred a third time"; visual-qa-competitors
 * added the same day as the .claude fix), and was found STILL open a fifth
 * time by the external-eye audit rotation's 13th instance (two more tracked
 * top-level directories -- .githooks, assets -- sitting unscanned, no live
 * leak in either at the time, but the structural gap was real). Both
 * sibling assets in this same Orchestra rotation (repertoire-builder,
 * lol-practice-system) converted to this same git-ls-files-based denylist
 * shape first; this is filetools' own port of that proven pattern.
 *
 * Usage:
 *   node scripts/check-internal-ids.js
 * Exits 1 and prints every match (file, and the matched id) if anything
 * is found; exits 0 with a summary otherwise. Wired into `npm test` via
 * package.json's `pretest` script, alongside check-em-dash.js.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Matches the shared queue's own id shape: "task-" or "decision-" followed
// by a lowercase-alphanumeric segment, a hyphen, and a hex segment (the
// exact shape every id cited in this session's own commit history uses,
// e.g. task-mt6jcfwr-ed62cc, decision-mt3eshmp-4a3058). Intentionally
// does NOT match this file's own header comment above (which discusses
// the pattern in prose) differently from real code -- a real occurrence
// anywhere, including a comment, is exactly what rule 1 forbids.
const ID_RE = /\b(?:task|decision)-[0-9a-z]+-[0-9a-f]{4,}\b/g;

// Internal governing-doc filenames -- a design-rationale comment that cites
// "design-standards.md" or "REFERENCE_LIBRARY.md entry 2" by name is exactly
// as much a leak as a task-/decision-id: it names a document a stranger
// reading this source has never heard of and can never open. Real leak,
// found live-rendered sitewide (13 source files, this repo's own 7th
// external-eye audit): a CSS design-rationale comment inlined verbatim into
// every page's shipped <style> block. Named literally (these are a fixed,
// small set of real filenames, not a general shape) rather than inferred
// from a pattern the way ID_RE is. `.md` is optional on the ones commonly
// referenced without it in prose (CRAFT_DOCTRINE, DESIGN_PLAYBOOK,
// REFERENCE_LIBRARY).
const DOC_FILENAME_RE = /\b(?:design-standards\.md|qa\.md|CRAFT_DOCTRINE(?:\.md)?|DESIGN_PLAYBOOK(?:\.md)?|REFERENCE_LIBRARY(?:\.md)?|GOALS\.md|TESTING\.md)\b/g;

// Internal series/tracking labels -- "WS-3", "Phase-1", "spec-section-1.6",
// "site-audit-item-4" and similar read as gibberish to an outside reader and
// are a reliable signal this comment was copied straight out of an internal
// planning/tracking artifact rather than written for this repo's own
// audience. Deliberately matches ONLY the hyphenated machine-tracking shape,
// not this codebase's own long-standing, widespread space-separated prose
// ("spec section 1.6", "Phase 3(a)") used throughout src/test comments to
// cite this repo's own design spec/rollout -- that space form is this repo's
// own established convention, not a leak, and appears in dozens of files far
// outside this fix's scope; matching it here would fail CI on all of them.
// The hyphenated form is the shape actually found leaking cross-repo (this
// rotation's sibling fixes in lol-practice-system/repertoire-builder), and
// is rare/incidental enough in this repo's own pre-existing text that the
// few real hits found here were fixed as part of adding this check (see the
// PR this shipped in). Case-sensitive, deliberately not /i: a
// case-insensitive "WS-\d" matched "ws-8"/"ws-7" inside package-lock.json's
// own real npm-registry URLs ("ws/-/ws-8.21.3.tgz", the `ws` websocket
// package's own version-numbered tarball name) -- a real false positive
// caught while writing this check, not a hypothetical one.
const SERIES_LABEL_RE = /\b(?:WS-\d+|Phase-\d+|spec-section-\d+(?:\.\d+)*|site-audit-item-\d+)\b/g;

// Every pattern class findLeakedIds checks, in one place -- extend this
// array (not ID_RE itself) to add a new leak shape, since ID_RE is also
// imported directly by check-copy-tells.js for its own narrower id-shape-only
// use and must keep meaning exactly "a task-/decision-id", nothing broader.
const LEAK_PATTERNS = [ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE];

// Directory-name denylist -- defense in depth only, not the primary scope
// control (scannableTrackedFiles() below already filters to git-tracked
// files, and all three of these are gitignored in this repo, so none of
// them should ever appear in `git ls-files` output under normal use).
// Protects against a future `git add -f` accident forcibly tracking build
// output or a vendored third-party copy the same way the sibling repos' own
// denylists do. Extend ONLY for real build/dependency/generated output,
// never turn this back into a scan-scope allowlist -- reintroducing a
// hand-maintained "these are the directories we scan" list is exactly the
// bug class this fix closes.
const DENY_DIR_PREFIXES = ['node_modules/', 'dist/', 'vendor/', 'tmp_test/', 'visual-qa-output/', '.lighthouseci/'];

// Extensions this checker reads as text and scans for a leak -- unchanged
// from the prior allowlist's own extension set (that was never the bug;
// only the DIRECTORY scope was). Binary files (images, fonts, xlsx/pdf
// fixtures) can't carry a text-shaped leak and would just be wasted I/O.
const SCANNED_EXT_RE = /\.(js|mjs|css|md|html|yml|yaml|json)$/i;

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
    for (const re of LEAK_PATTERNS) {
      matches.push(...(line.match(re) || []));
    }
  }
  // Concatenating two full lines with no separator (not just their tail/
  // head) is deliberately wasteful but simple, and safe: a match found
  // only in the concatenation and not in either line alone can only be
  // one that genuinely spans the line break, since each pattern's `\b`
  // anchors mean a match wholly inside one line's own text is already
  // found by the per-line pass above.
  for (let i = 0; i < strippedLines.length - 1; i += 1) {
    const pair = strippedLines[i] + strippedLines[i + 1];
    for (const re of LEAK_PATTERNS) {
      matches.push(...(pair.match(re) || []));
    }
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
// rendered dist/ output rather than source. test/check-commit-message.test.mjs
// joins for the identical reason, against scripts/check-commit-message.js's
// own reuse of these same patterns at commit-message-check time.
// test/pr-metadata-id-leak-guard.test.mjs joins for the same reason again,
// against scripts/hooks/pr-metadata-id-leak-guard.js's own reuse of these
// same patterns to scan a "gh pr create"/"gh pr edit" command's --title/
// --body text before it ever reaches GitHub.
//
// scripts/check-copy-tells.js and scripts/check-em-dash.js join this list
// for a different reason (governing-doc-filename leak audit, 7th
// occurrence): both are dev-tooling scripts that never get bundled or
// shipped to a browser, and their own source comments name the exact rule
// file they implement -- the same accepted shape as this file's own header
// above naming public-repo-hygiene.md, not a leak into anything
// public-facing. Explicitly reviewed and cleared, not an oversight.
const EXCLUDED_FILES = [
  __filename,
  path.join(ROOT, 'test', 'check-internal-ids.test.mjs'),
  path.join(ROOT, 'test', 'check-copy-tells.test.mjs'),
  path.join(ROOT, 'test', 'check-commit-message.test.mjs'),
  path.join(ROOT, 'test', 'pr-metadata-id-leak-guard.test.mjs'),
  path.join(ROOT, 'scripts', 'check-copy-tells.js'),
  path.join(ROOT, 'scripts', 'check-em-dash.js'),
].map((f) => path.resolve(f));

/**
 * @param {string} [dir] repo root to scan (the real ROOT by default; a
 *   synthetic fixture repo in tests).
 * @returns {string[]} the absolute path of every git-tracked file under
 *   `dir`, after the directory-name denylist and the scanned-extension
 *   filter -- the full tracked tree, not a hand-picked directory subset,
 *   so a newly-added tracked top-level directory (root-level files
 *   included -- `git ls-files` has no notion of "top-level" to miss) is
 *   covered automatically with no list to remember to update. Rule 1 only
 *   governs what is public-facing, and a file git does not track will
 *   never be pushed to the public repo -- an untracked local note (this
 *   session's own ROLLING_PLAN.md, gitignored, genuinely full of real
 *   task-/decision-ids by design) is correctly never scanned, since
 *   `git ls-files` never lists it in the first place.
 */
function scannableTrackedFiles(dir = ROOT) {
  const out = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => !DENY_DIR_PREFIXES.some((prefix) => f.startsWith(prefix)))
    .filter((f) => SCANNED_EXT_RE.test(f))
    .map((f) => path.resolve(dir, f));
}

function main() {
  const files = scannableTrackedFiles().filter((f) => !EXCLUDED_FILES.includes(path.resolve(f)));

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

module.exports = {
  findLeakedIds, ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE, scannableTrackedFiles, DENY_DIR_PREFIXES, SCANNED_EXT_RE, ROOT,
};
