import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findLeaksInMessage } from '../scripts/check-commit-message.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Regression coverage for the commit-time hygiene gate (public-repo-
 * hygiene.md rule 3's "commit-time habit, not just a /ship-time grep").
 * Written after a hygiene-verification pass found five already-published
 * commit messages on this repo's own history leaking task-/decision-ids
 * or internal governing-doc filenames despite every touched source file
 * passing check-internal-ids.js/check-copy-tells.js cleanly -- neither of
 * those checkers scans commit messages, which is the gap this closes.
 */

test('findLeaksInMessage: catches a leaked task-id in a commit body', () => {
  const hits = findLeaksInMessage('fix: something\n\nFixed per task-mt6jcfwr-ed62cc last week.\n');
  assert.ok(hits.includes('task-mt6jcfwr-ed62cc'));
});

test('findLeaksInMessage: catches a leaked decision-id in a commit body', () => {
  const hits = findLeaksInMessage('fix: something\n\nSee decision-mt3eshmp-4a3058 for the reasoning.\n');
  assert.ok(hits.includes('decision-mt3eshmp-4a3058'));
});

test('findLeaksInMessage: catches an internal governing-doc filename reference', () => {
  const hits = findLeaksInMessage('docs: update copy\n\nPer design-standards.md section 2.\n');
  assert.ok(hits.some((h) => h === 'design-standards.md'));
});

test('findLeaksInMessage: catches internal role/process vocabulary', () => {
  const hits = findLeaksInMessage('chore: routed for review\n\nEscalated to chief-of-staff for a decision brief.\n');
  assert.ok(hits.some((h) => /process-talk phrase "chief-of-staff"/.test(h)));
  assert.ok(hits.some((h) => /process-talk phrase "decision brief"/.test(h)));
});

test('findLeaksInMessage: passes a clean, ordinary commit message', () => {
  const hits = findLeaksInMessage('fix: xlsx-to-csv invalid-file test asserted on transient loading text\n\nWaits for the real error state instead.\n');
  assert.deepEqual(hits, []);
});

test('findLeaksInMessage: does not false-positive on the ordinary word "builder" alone', () => {
  const hits = findLeaksInMessage('feat: add a PDF builder page\n');
  assert.deepEqual(hits, []);
});

test('CLI: exits 1 and reports leaks for a file containing a leaked id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-commit-message-test-'));
  const file = path.join(dir, 'MSG');
  fs.writeFileSync(file, 'fix: something\n\ntask-mt6jcfwr-ed62cc\n', 'utf8');
  const result = importAndRunCli(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /task-mt6jcfwr-ed62cc/);
});

test('CLI: exits 0 silently for a clean message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-commit-message-test-'));
  const file = path.join(dir, 'MSG');
  fs.writeFileSync(file, 'fix: a normal commit message\n', 'utf8');
  const result = importAndRunCli(file);
  assert.equal(result.status, 0);
});

function importAndRunCli(msgFile) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'check-commit-message.js');
  return spawnSync(process.execPath, [scriptPath, msgFile], { encoding: 'utf8' });
}
