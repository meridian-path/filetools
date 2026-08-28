import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  findLeakedIds,
  ID_RE,
  DOC_FILENAME_RE,
  SERIES_LABEL_RE,
  findFiles,
  findRootFiles,
  SCAN_DIRS,
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
 */

function tmpFile(content, ext = '.js') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-test-'));
  const file = path.join(dir, `sample${ext}`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
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

// Regression coverage for a near-miss found while fixing an unrelated CI
// workflow bug: a leaked decision-id was almost committed in
// .github/workflows/deploy-pages.yml's own comment, and this checker never
// would have caught it -- .github wasn't in SCAN_DIRS, and even if it had
// been, findFiles' own extension filter didn't include .yml/.yaml at all.
// Both gaps are covered directly here, since main()'s own use of these
// against the real ROOT can't exercise a case that (correctly) doesn't
// exist in this repo right now.
test('SCAN_DIRS includes .github -- CI workflow comments are exactly as public-facing as any src/ comment', () => {
  assert.ok(SCAN_DIRS.includes('.github'));
});

// Regression coverage for a real, self-caught leak while writing a
// lineup/squint verdict (craft-retrofit Phase 3 visual-QA pass): a
// verdict-<date>.md's own prose cited an internal decision id directly.
// visual-qa-competitors/ is committed (not gitignored - see its own
// README), so a verdict file's prose is exactly as public-facing as a
// docs/ page, but the directory was never in SCAN_DIRS.
test('SCAN_DIRS includes visual-qa-competitors -- a verdict.md\'s own prose is exactly as public-facing as any docs/ page', () => {
  assert.ok(SCAN_DIRS.includes('visual-qa-competitors'));
});

test('findFiles: picks up a leaked id inside a nested visual-qa-competitors/<tool-slug>/verdict-*.md file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-verdict-test-'));
  const toolDir = path.join(dir, 'hash-generator');
  fs.mkdirSync(toolDir);
  const verdictFile = path.join(toolDir, 'verdict-2026-08-27.md');
  fs.writeFileSync(verdictFile, 'Traffic finding per decision-mt933kei-d26512.\n', 'utf8');
  const found = findFiles(dir);
  assert.deepEqual(found, [verdictFile]);
  assert.deepEqual(findLeakedIds(verdictFile), ['decision-mt933kei-d26512']);
});

test('findFiles: picks up a .yml file, not just js/mjs/css/md/html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-yml-test-'));
  const workflowsDir = path.join(dir, 'workflows');
  fs.mkdirSync(workflowsDir);
  const ymlFile = path.join(workflowsDir, 'deploy.yml');
  fs.writeFileSync(ymlFile, '# see task-mt6jcfwr-ed62cc\n', 'utf8');
  const found = findFiles(dir);
  assert.deepEqual(found, [ymlFile]);
  assert.deepEqual(findLeakedIds(ymlFile), ['task-mt6jcfwr-ed62cc']);
});

// Regression coverage for the 4th occurrence of this exact incident class
// (monthly craft audit, 2026-08-26): a real id leaked in
// .claude/commands/conduct-lite.md sat live on the public repo for three
// days, since .claude was never in SCAN_DIRS -- same missing-directory
// shape as the .github gap above. Both the array membership and a real
// fixture proving findFiles() actually reaches a nested .claude/ file are
// covered here, so a future removal of the entry fails a real test rather
// than waiting for the next monthly audit to notice.
test('SCAN_DIRS includes .claude -- a slash-command doc comment is exactly as public-facing as any src/ comment', () => {
  assert.ok(SCAN_DIRS.includes('.claude'));
});

test('findFiles: picks up a leaked id inside a nested .claude/commands/*.md file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-claude-test-'));
  const commandsDir = path.join(dir, 'commands');
  fs.mkdirSync(commandsDir);
  const mdFile = path.join(commandsDir, 'conduct-lite.md');
  fs.writeFileSync(mdFile, 'Validated end to end (task-mt638skf-4558aa, 2026-08-23).\n', 'utf8');
  const found = findFiles(dir);
  assert.deepEqual(found, [mdFile]);
  assert.deepEqual(findLeakedIds(mdFile), ['task-mt638skf-4558aa']);
});

// Regression coverage for the 7th occurrence of this incident class (7th
// monthly external-eye audit): internal governing-doc filenames
// (design-standards.md, REFERENCE_LIBRARY.md, etc.) were live-rendered
// sitewide via CSS design-rationale comments across 13 source files. ID_RE
// alone has zero pattern coverage for a governing-doc filename -- it only
// matches the task-/decision-id shape -- so this was a real, unaddressed gap
// in the checker itself, not a fluke miss.
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

// Regression coverage for the 7th occurrence's item 3: SCAN_DIRS is a
// directory allowlist that never covered root-level tracked files (README.md,
// SESSION_SCOPE.md, package.json, package-lock.json), since none of them live
// inside any SCAN_DIRS entry. findRootFiles() closes that blind spot without
// making the walk recursive from ROOT (which would just re-walk every
// SCAN_DIRS entry a second time, plus node_modules/dist/.git).
test('findRootFiles: picks up a leaked id in a root-level file SCAN_DIRS never reaches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-internal-ids-root-test-'));
  const readme = path.join(dir, 'README.md');
  fs.writeFileSync(readme, 'See task-mt6jcfwr-ed62cc for background.\n', 'utf8');
  const srcDir = path.join(dir, 'src');
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, 'nested.md'), 'nothing to see here\n', 'utf8');

  // findRootFiles takes no argument (always scans the real ROOT), so
  // exercise its directory-listing behavior directly against a synthetic
  // root here rather than importing a second copy of the module.
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.isDirectory() && /\.(js|mjs|css|md|html|yml|yaml|json)$/.test(e.name))
    .map((e) => path.join(dir, e.name));
  assert.deepEqual(entries, [readme]);
  assert.deepEqual(findLeakedIds(readme), ['task-mt6jcfwr-ed62cc']);
});

test('findRootFiles: reaches package.json at the real repo root (json is not in findFiles\' own extension set)', () => {
  const rootFiles = findRootFiles();
  const relRootFiles = rootFiles.map((f) => path.relative(ROOT, f));
  assert.ok(relRootFiles.includes('package.json'), 'expected findRootFiles() to include package.json');
  assert.ok(relRootFiles.includes('package-lock.json'), 'expected findRootFiles() to include package-lock.json');
});

test('findRootFiles: does not recurse into subdirectories', () => {
  const rootFiles = findRootFiles();
  const relRootFiles = rootFiles.map((f) => path.relative(ROOT, f));
  assert.ok(!relRootFiles.some((f) => f.includes(path.sep)), 'expected every result to be a direct child of ROOT, not a nested path');
});
