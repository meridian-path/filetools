#!/usr/bin/env node
// Claude Code PreToolUse hook.
//
// check-internal-ids.js and check-copy-tells.js both scan tracked source and built output for
// a leaked internal task-/decision-id, governing-doc filename, or series label, and
// check-commit-message.js extends that same coverage to a new commit's own message body. None
// of those three ever sees a PR TITLE or BODY, though: a `gh pr create --title ... --body ...`
// call is an ordinary Bash invocation over free text that is never a tracked file and never a
// commit message, so it sits outside every one of this repo's existing checks. That gap is real
// (this repo's own git history has commits and PR bodies that leaked internal ids before this
// class of check existed at all), and a PR body is publicly visible on GitHub the instant `gh pr
// create` returns -- there is no build step or commit-time hook downstream that could catch it
// after the fact. This hook closes that gap by scanning the command text itself, before the
// shell ever runs it.
//
// Deliberately reuses this repo's OWN check-internal-ids.js patterns (ID_RE, DOC_FILENAME_RE,
// SERIES_LABEL_RE) rather than redefining a fourth copy of the same leak shapes -- same reuse
// pattern check-commit-message.js already established (that file's own header explains why: so
// the pattern lists across every caller can't silently drift apart from one another).
//
// Fires only when (a) tool_name is "Bash" and (b) the command contains a `gh pr create` or `gh
// pr edit` invocation anywhere in the string (not anchored to a single split segment -- a
// leaked id living in an unrelated earlier command in the same compound Bash call could
// spuriously block an otherwise-clean `gh pr create`; accepted, a false positive here is far
// cheaper than a false negative). Scans any inline `--title`/`--body` argument value, and the
// file contents referenced by a `--body-file` path when that file can be read.
//
// Fails open on any uncertainty: missing/malformed stdin, an unparseable command, or a
// `--body-file` path that can't be resolved or read all result in ALLOWING the tool call, never
// in blocking on incomplete information.
'use strict';
const fs = require('fs');
const path = require('path');
const { ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE } = require('../check-internal-ids.js');

// Matches a `gh pr create` or `gh pr edit` invocation anywhere in the command string.
const GH_PR_CREATE_EDIT_RE = /\bgh\s+pr\s+(create|edit)\b/;

// Matches `--title <value>` / `--body <value>`, where <value> is either a quoted span (single
// or double quote, `[\s\S]` so it spans newlines -- this is what lets a heredoc nested inside
// the quotes be captured whole) or a single unquoted token. Group 1 = flag name; group 2 =
// quote char, if quoted; group 3 = quoted content; group 4 = unquoted token. Global, so
// multiple --title/--body occurrences in one command are all scanned.
const FLAG_VALUE_RE = /--(title|body)\s+(?:(["'])((?:\\.|(?!\2)[\s\S])*)\2|(\S+))/g;

// Matches `--body-file <path>`, same quoted/unquoted-token shape as FLAG_VALUE_RE above.
const BODY_FILE_RE = /--body-file\s+(?:(["'])((?:\\.|(?!\1)[\s\S])*)\1|(\S+))/g;

// Fresh copy of a shared module-level `g`-flagged regex, so repeated calls in the same process
// don't inherit another caller's lastIndex state -- same reasoning check-commit-message.js's
// own freshGlobal() documents.
function freshGlobal(re) {
  return new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
}

const LEAK_PATTERNS = [ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE];

// Returns the first leaked substring found in `text` across every pattern class this repo's
// own check-internal-ids.js defines, or null.
function findLeak(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const re of LEAK_PATTERNS) {
    const m = freshGlobal(re).exec(text);
    if (m) return m[0];
  }
  return null;
}

// Returns [{ flag: '--title'|'--body', value }] for every inline --title/--body match found in
// `command`.
function extractFlagValues(command) {
  const results = [];
  if (typeof command !== 'string' || command.length === 0) return results;
  const re = freshGlobal(FLAG_VALUE_RE);
  let m;
  while ((m = re.exec(command))) {
    const flagName = m[1];
    const value = m[3] !== undefined ? m[3] : m[4];
    if (value !== undefined) results.push({ flag: `--${flagName}`, value });
  }
  return results;
}

// Returns every raw `--body-file <path>` path string found in `command` (unresolved, exactly
// as written).
function extractBodyFilePaths(command) {
  const results = [];
  if (typeof command !== 'string' || command.length === 0) return results;
  const re = freshGlobal(BODY_FILE_RE);
  let m;
  while ((m = re.exec(command))) {
    const rawPath = m[2] !== undefined ? m[2] : m[3];
    if (rawPath) results.push(rawPath);
  }
  return results;
}

// Resolves a `--body-file` path against `cwd`: an absolute path (Windows- or POSIX-style,
// regardless of which OS this hook itself runs on) is used as-is; a relative path is resolved
// against `cwd` when usable, otherwise returned unresolved (best-effort, never throws).
function resolveBodyFilePath(cwd, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return null;
  if (path.win32.isAbsolute(rawPath) || path.posix.isAbsolute(rawPath)) return rawPath;
  if (typeof cwd === 'string' && cwd.length > 0) return path.resolve(cwd, rawPath);
  return rawPath;
}

// Best-effort file read for a --body-file target. Returns the file's text content, or null on
// any failure -- always fails open, never treats a read failure as a reason to block.
// `deps.readFileFn` is injectable for tests.
function readBodyFileContent(cwd, rawPath, deps = {}) {
  const readFileFn = deps.readFileFn || fs.readFileSync;
  try {
    const resolved = resolveBodyFilePath(cwd, rawPath);
    if (!resolved) return null;
    return readFileFn(resolved, 'utf-8');
  } catch {
    return null;
  }
}

function buildBlockReason(fieldLabel, leaked, command) {
  return (
    `PR-metadata leak guard: this "gh pr create"/"gh pr edit" command's ${fieldLabel} contains ` +
    `an internal reference ("${leaked}") that check-internal-ids.js would already reject in a ` +
    `tracked source file. A PR title/body is publicly visible the instant the PR opens, so this ` +
    `is the same leak class caught earlier, just before it reaches a surface none of this repo's ` +
    `other checks can see.\n\n` +
    `Command refused:\n  ${command}\n\n` +
    `Rewrite the ${fieldLabel} to describe WHY the change was made (a plain-English reason), not ` +
    `the internal ticket/doc name that discovered it, then re-run the command.`
  );
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

// Pure decision function (no process.exit, no stderr writes), unconditionally exception-safe.
// Returns { block: boolean, reason: string|null }.
function evaluatePreToolUse(hookInput, deps = {}) {
  try {
    if (!hookInput || typeof hookInput !== 'object') return { block: false, reason: null };
    if (hookInput.tool_name !== 'Bash') return { block: false, reason: null };
    const toolInput = hookInput.tool_input;
    if (!toolInput || typeof toolInput !== 'object') return { block: false, reason: null };
    const command = toolInput.command;
    if (typeof command !== 'string' || command.length === 0) return { block: false, reason: null };

    if (!GH_PR_CREATE_EDIT_RE.test(command)) return { block: false, reason: null };

    for (const { flag, value } of extractFlagValues(command)) {
      const leaked = findLeak(value);
      if (leaked) return { block: true, reason: buildBlockReason(`${flag} value`, leaked, command) };
    }

    for (const rawPath of extractBodyFilePaths(command)) {
      const content = readBodyFileContent(hookInput.cwd, rawPath, deps);
      if (content === null) continue;
      const leaked = findLeak(content);
      if (leaked) {
        return { block: true, reason: buildBlockReason(`--body-file target (${rawPath})`, leaked, command) };
      }
    }

    return { block: false, reason: null };
  } catch {
    return { block: false, reason: null };
  }
}

function main() {
  let hookInput = {};
  try {
    hookInput = JSON.parse(readStdin() || '{}');
  } catch {
    process.exit(0);
    return;
  }

  try {
    const eventName = hookInput && hookInput.hook_event_name;
    if (eventName !== 'PreToolUse') {
      process.exit(0);
      return;
    }
    const { block, reason } = evaluatePreToolUse(hookInput);
    if (block) {
      process.stderr.write(reason);
      process.exit(2);
      return;
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  GH_PR_CREATE_EDIT_RE,
  FLAG_VALUE_RE,
  BODY_FILE_RE,
  extractFlagValues,
  extractBodyFilePaths,
  resolveBodyFilePath,
  readBodyFileContent,
  findLeak,
  buildBlockReason,
  evaluatePreToolUse,
  main,
};
