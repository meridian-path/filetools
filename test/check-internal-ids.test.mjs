import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  findLeakedIds,
  ID_RE,
  DOC_FILENAME_RE,
  SERIES_LABEL_RE,
  scannableTrackedFiles,
  DENY_DIR_PREFIXES,
  SCANNED_EXT_RE,
  ROOT,
} from '../scripts/check-internal-ids.js';

/**
 * Regression coverage for the mechanical internal-id leak check
 * (public-repo-hygiene.md rule 1 -- no task-/decision- ids in anything
 * public-facing, including source comments). Written after this exact
 * incident class hit filetools a second time: a leak in a JS source
 * comment that a self-attested "grep clean" claim missed because the id
 * happened to wrap across a line break, and because the grep pattern used
 * that pass only matched one specific id-prefix shape rather than the
 * general task-/decision- id shape. Both gaps are covered here directly.
 *
 * Denylist conversion (external-eye audit rotation, 13th filetools
 * instance): this checker used to walk a hand-maintained SCAN_DIRS
 * directory allowlist, which went unscanned for a newly-added tracked
 * top-level directory until someone remembered to extend the list --
 * bitten FIVE separate times (the original narrow scope; .github added
 * only after a near-miss; .claude added only after the same gap recurred
 * a third time; visual-qa-competitors added the same day as the .claude
 * fix; .githooks and assets found still-unscanned, clean but exposed, by
 * this rotation's own 13th audit). scannableTrackedFiles() replaces the
 * old findFiles()/findRootFiles()/gitTrackedFiles()/SCAN_DIRS shape with a
 * single git-ls-files-based walk of the ENTIRE tracked tree, denylisting
 * only real generated/vendored output directories -- the same shape this
 * Orchestra rotation's two sibling assets already proved out first.
 */

function tmpFile(content, ext = '.js') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-test-'));
  const file = path.join(dir, `sample${ext}`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/**
 * @param {Record<string,string>} files relative path -> content, one entry
 *   per file to commit into a fresh throwaway git repo.
 * @returns {string} the repo's root directory.
 */
function tmpGitRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-repo-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
  return dir;
}

// ID_RE is a shared, `g`-flagged module-level regex object: assert.match
// exercises it via a stateful .test()-like call, which advances its own
// lastIndex on a successful match and never resets it back to 0 on its
// own. Reusing the same object across these two assertions would leave
// the second one starting its search from the first match's end offset
// instead of 0, so each assertion gets its own fresh copy via the
// pattern's source instead of touching the shared object's state.
test('ID_RE matches a plain task-id', () => {
  assert.match('task-mt6jcfwr-ed62cc', new RegExp(ID_RE.source));
});

test('ID_RE matches a plain decision-id', () => {
  assert.match('decision-mt3eshmp-4a3058', new RegExp(ID_RE.source));
});

test('findLeakedIds: catches a task-id on a single line', () => {
  const file = tmpFile('// see task-mt6jcfwr-ed62cc for the full spec\nconst x = 1;\n');
  assert.deepEqual(findLeakedIds(file), ['task-mt6jcfwr-ed62cc']);
});

test('findLeakedIds: catches a task-id split across a line-wrapped JSDoc comment (the real miss this check exists to catch)', () => {
  const file = tmpFile(' * navigation/IA redesign, task-mt6jcfwr-\n * ed62cc section 1.3\n');
  assert.deepEqual(findLeakedIds(file), ['task-mt6jcfwr-ed62cc']);
});

test('findLeakedIds: catches a task-id split across a line wrap with extra alignment indentation on the continuation line (real miss found in src/structuredData.js -- a "@returns" continuation indented past the marker)', () => {
  const file = tmpFile(' * @returns one per folder page (redesign, task-\n *   mt6jcfwr-ed62cc section 3.4), alongside\n');
  assert.deepEqual(findLeakedIds(file), ['task-mt6jcfwr-ed62cc']);
});

test('findLeakedIds: catches a task-id split across a line-wrapped // comment', () => {
  const file = tmpFile('  // three-level path, task-mt6jcfwr-\n  // ed62cc section 1.4\n');
  assert.deepEqual(findLeakedIds(file), ['task-mt6jcfwr-ed62cc']);
});

test('findLeakedIds: catches a decision-id', () => {
  const file = tmpFile('// per decision-mt3eshmp-4a3058, hold this exception\n');
  assert.deepEqual(findLeakedIds(file), ['decision-mt3eshmp-4a3058']);
});

test('findLeakedIds: finds multiple distinct ids in one file, deduplicated', () => {
  const file = tmpFile('// task-mt6jcfwr-ed62cc\n// task-mt6jcfwr-ed62cc again\n// task-mt6jtya9-215343\n');
  assert.deepEqual(findLeakedIds(file).sort(), ['task-mt6jcfwr-ed62cc', 'task-mt6jtya9-215343'].sort());
});

test('findLeakedIds: passes clean source with no id-shaped text', () => {
  const file = tmpFile('// this is a normal comment about the folder taxonomy spec section 1.1\nconst x = 1;\n');
  assert.deepEqual(findLeakedIds(file), []);
});

test('findLeakedIds: does not false-positive on an unrelated hyphenated identifier', () => {
  const file = tmpFile('// see the site-wide navigation-ia redesign work\nconst siteWideNav = true;\n');
  assert.deepEqual(findLeakedIds(file), []);
});

test('findLeakedIds: does not false-positive on a real commit SHA mention (no task-/decision- prefix)', () => {
  const file = tmpFile('// merged as commit 2791707752ad4ea0e290096305dce6ec5891fb6a\n');
  assert.deepEqual(findLeakedIds(file), []);
});

test('DOC_FILENAME_RE matches design-standards.md', () => {
  assert.match('design-standards.md', new RegExp(DOC_FILENAME_RE.source));
});

test('DOC_FILENAME_RE matches REFERENCE_LIBRARY.md and the bare REFERENCE_LIBRARY form', () => {
  assert.match('REFERENCE_LIBRARY.md', new RegExp(DOC_FILENAME_RE.source));
  assert.match('REFERENCE_LIBRARY', new RegExp(DOC_FILENAME_RE.source));
});

test('DOC_FILENAME_RE matches qa.md, CRAFT_DOCTRINE, DESIGN_PLAYBOOK, GOALS.md, TESTING.md', () => {
  for (const name of ['qa.md', 'CRAFT_DOCTRINE', 'DESIGN_PLAYBOOK', 'GOALS.md', 'TESTING.md']) {
    assert.match(name, new RegExp(DOC_FILENAME_RE.source), `expected a match for ${name}`);
  }
});

test('findLeakedIds: catches a governing-doc filename cited in a CSS design-rationale comment (the real 7th-occurrence leak shape)', () => {
  const file = tmpFile('/* accent-filled action per view (design-standards.md: exactly one) */\n', '.css');
  assert.deepEqual(findLeakedIds(file), ['design-standards.md']);
});

test('findLeakedIds: catches REFERENCE_LIBRARY.md entry citation split across a line wrap', () => {
  const file = tmpFile(' * (Cobalt, REFERENCE_LIBRARY.md entry 2, demotes secondary nav\n * to small text)\n');
  assert.deepEqual(findLeakedIds(file), ['REFERENCE_LIBRARY.md']);
});

test('SERIES_LABEL_RE matches the hyphenated internal series/tracking label shape', () => {
  for (const label of ['WS-3', 'Phase-1', 'spec-section-1.6', 'site-audit-item-4']) {
    assert.match(label, new RegExp(SERIES_LABEL_RE.source), `expected a match for ${label}`);
  }
});

test('SERIES_LABEL_RE deliberately does NOT match this repo\'s own space-separated prose form (not a leak, and pervasive/pre-existing across dozens of files out of this check\'s scope)', () => {
  for (const phrase of ['spec section 1.6', 'Phase 3(a)', 'craft-retrofit Phase 1']) {
    assert.doesNotMatch(phrase, new RegExp(SERIES_LABEL_RE.source), `expected NO match for ${phrase}`);
  }
});

test('SERIES_LABEL_RE is case-sensitive -- does not false-positive on the "ws" npm package\'s own version-numbered tarball URLs (real false positive caught in package-lock.json)', () => {
  for (const phrase of ['registry.npmjs.org/ws/-/ws-8.21.3.tgz', 'registry.npmjs.org/ws/-/ws-7.5.13.tgz']) {
    assert.doesNotMatch(phrase, new RegExp(SERIES_LABEL_RE.source), `expected NO match for ${phrase}`);
  }
});

test('findLeakedIds: catches an internal series label in a source comment', () => {
  const file = tmpFile('// see the folder taxonomy/nav spec-section-1.6 for the full shape\n');
  assert.deepEqual(findLeakedIds(file), ['spec-section-1.6']);
});

test('findLeakedIds: does not false-positive DOC_FILENAME_RE/SERIES_LABEL_RE on ordinary prose', () => {
  const file = tmpFile('// this tool converts between two common file formats\nconst x = 1;\n');
  assert.deepEqual(findLeakedIds(file), []);
});

test('scannableTrackedFiles: covers every git-tracked directory, including one never named in any hand-maintained scan list', () => {
  // The exact bug class this fix closes: a newly-added tracked top-level
  // directory (here, a synthetic stand-in for the real .githooks/assets
  // gap the audit found) must be scanned with zero code change, since
  // there is no directory allowlist left to forget to extend.
  const dir = tmpGitRepo({
    'a-brand-new-directory-nobody-ever-listed/notes.md': 'See task-mt6jcfwr-ed62cc for context.\n',
  });
  const absFiles = scannableTrackedFiles(dir);
  const relFiles = absFiles.map((f) => path.relative(dir, f).split(path.sep).join('/'));
  assert.deepEqual(relFiles, ['a-brand-new-directory-nobody-ever-listed/notes.md']);
  assert.deepEqual(findLeakedIds(absFiles[0]), ['task-mt6jcfwr-ed62cc']);
});

test('scannableTrackedFiles: covers a root-level tracked file with no subdirectory at all', () => {
  const dir = tmpGitRepo({ 'README.md': 'See design-standards.md for background.\n' });
  const files = scannableTrackedFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
  assert.deepEqual(files, ['README.md']);
});

test('scannableTrackedFiles: excludes an untracked file, even one sitting right next to tracked files', () => {
  const dir = tmpGitRepo({ 'README.md': 'tracked\n' });
  fs.writeFileSync(path.join(dir, 'ROLLING_PLAN.md'), 'task-mt6jcfwr-ed62cc\n', 'utf8');
  const files = scannableTrackedFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
  assert.deepEqual(files, ['README.md']);
});

test('scannableTrackedFiles: excludes a file under a denylisted directory prefix even if force-tracked', () => {
  const dir = tmpGitRepo({
    'src/real.js': '// nothing to see here\n',
    'dist/built.js': '// task-mt6jcfwr-ed62cc would leak here if scanned\n',
  });
  const files = scannableTrackedFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
  assert.deepEqual(files, ['src/real.js']);
});

test('scannableTrackedFiles: excludes a binary/non-scanned extension even when tracked', () => {
  const dir = tmpGitRepo({
    'assets/logo.png': 'not a real png, just a placeholder blob\n',
    'assets/notes.html': '<p>hello</p>\n',
  });
  const files = scannableTrackedFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
  assert.deepEqual(files, ['assets/notes.html']);
});

test('DENY_DIR_PREFIXES stays scoped to real generated/vendored output, never grows back into a scan-scope allowlist', () => {
  // A loose upper bound, not a golden list -- this test exists to catch the
  // regression this fix is named after (an allowlist creeping back in
  // disguised as a "denylist"), not to lock the exact membership. Every
  // entry must look like build/vendor/test-artifact output, not a real
  // content directory a human might write copy into.
  for (const prefix of DENY_DIR_PREFIXES) {
    assert.ok(prefix.endsWith('/'), `${prefix} should be a directory prefix ending in /`);
  }
  assert.ok(DENY_DIR_PREFIXES.length <= 10, 'DENY_DIR_PREFIXES is growing suspiciously large for a defense-in-depth-only list');
});

test('SCANNED_EXT_RE matches every extension the prior allowlist scanned, including .yml/.yaml and root-level .json', () => {
  for (const name of ['a.js', 'a.mjs', 'a.css', 'a.md', 'a.html', 'a.yml', 'a.yaml', 'a.json']) {
    assert.match(name, SCANNED_EXT_RE, `expected a match for ${name}`);
  }
});

test('SCANNED_EXT_RE does not match a binary extension', () => {
  for (const name of ['a.png', 'a.jpg', 'a.woff2', 'a.ttf']) {
    assert.doesNotMatch(name, SCANNED_EXT_RE, `expected NO match for ${name}`);
  }
});

test('CLI: the real repo passes end to end, including with an untracked ROLLING_PLAN.md-shaped file on disk at root', () => {
  // Exercises main() for real against the actual ROOT, the same way
  // `npm test`'s pretest step does -- if the git-tracked-only filtering
  // above ever regresses, this fails for real, right here, since a real
  // ROLLING_PLAN.md sits on disk in this exact checkout during this test.
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-internal-ids.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `expected exit 0, got stderr:\n${result.stderr}`);
  assert.match(result.stdout, /zero leaked ids/);
});

test('CLI: the real repo now scans .githooks/ and assets/ -- the two directories the external-eye audit found sitting unscanned', () => {
  const files = scannableTrackedFiles().map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
  assert.ok(files.some((f) => f.startsWith('.githooks/')), 'expected at least one scanned file under .githooks/');
  assert.ok(files.some((f) => f.startsWith('assets/')), 'expected at least one scanned file under assets/');
});
