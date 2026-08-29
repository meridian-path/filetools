import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluatePreToolUse, findLeak } from '../scripts/hooks/pr-metadata-id-leak-guard.js';

/**
 * Regression coverage for the PR-metadata leak guard, closing the gap
 * check-internal-ids.js/check-copy-tells.js/check-commit-message.js all
 * leave open: none of those scan a `gh pr create`/`gh pr edit` command's
 * own --title/--body text, which is publicly visible on GitHub the
 * instant the PR opens.
 */

function hookInput(command, overrides = {}) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    cwd: overrides.cwd,
  };
}

test('findLeak: catches a leaked task-id', () => {
  assert.equal(findLeak('Fixed per task-mt6jcfwr-ab12 last week.'), 'task-mt6jcfwr-ab12');
});

test('findLeak: catches an internal governing-doc filename', () => {
  assert.equal(findLeak('Per design-standards.md section 2.'), 'design-standards.md');
});

test('findLeak: returns null for clean text', () => {
  assert.equal(findLeak('fix: xlsx-to-csv invalid-file test asserted on transient text'), null);
});

test('evaluatePreToolUse: blocks a leaked task-id in --title', () => {
  const cmd = `gh pr create --title "fix: task-mt6jcfwr-ab12 cleanup" --body "clean"`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, true);
  assert.match(reason, /task-mt6jcfwr-ab12/);
});

test('evaluatePreToolUse: blocks a leaked decision-id in --body', () => {
  const cmd = `gh pr create --title "fix: cleanup" --body "See decision-mt3eshmp-cd34 for context"`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, true);
  assert.match(reason, /decision-mt3eshmp-cd34/);
});

test('evaluatePreToolUse: blocks a leaked governing-doc filename in gh pr edit', () => {
  const cmd = `gh pr edit 42 --body "Reworded per design-standards.md"`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, true);
  assert.match(reason, /design-standards\.md/);
});

test('evaluatePreToolUse: allows a clean gh pr create', () => {
  const cmd = `gh pr create --title "fix: xlsx-to-csv invalid-file test" --body "Waits for the real error state instead."`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, false);
  assert.equal(reason, null);
});

test('evaluatePreToolUse: ignores non-Bash tool calls', () => {
  const { block } = evaluatePreToolUse({
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: 'task-mt6jcfwr-ab12.txt' },
  });
  assert.equal(block, false);
});

test('evaluatePreToolUse: ignores a Bash command that is not gh pr create/edit', () => {
  const { block } = evaluatePreToolUse(hookInput('echo task-mt6jcfwr-ab12'));
  assert.equal(block, false);
});

test('evaluatePreToolUse: fails open on missing hookInput', () => {
  const { block, reason } = evaluatePreToolUse(null);
  assert.equal(block, false);
  assert.equal(reason, null);
});

test('evaluatePreToolUse: blocks a leaked id inside a --body-file target it can read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-metadata-guard-test-'));
  const bodyFile = path.join(dir, 'BODY.md');
  fs.writeFileSync(bodyFile, 'Fixed per task-mt6jcfwr-ab12.\n', 'utf8');
  const cmd = `gh pr create --title "fix: cleanup" --body-file "${bodyFile}"`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, true);
  assert.match(reason, /task-mt6jcfwr-ab12/);
});

test('evaluatePreToolUse: allows a gh pr create whose --body-file cannot be read (fail open)', () => {
  const cmd = `gh pr create --title "fix: cleanup" --body-file "C:/does/not/exist/BODY.md"`;
  const { block, reason } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, false);
  assert.equal(reason, null);
});

test('evaluatePreToolUse: ignores a --title/--body leak sitting in a different, unrelated command', () => {
  const cmd = `echo task-mt6jcfwr-ab12 && gh pr create --title "fix: clean" --body "clean"`;
  const { block } = evaluatePreToolUse(hookInput(cmd));
  assert.equal(block, false);
});
