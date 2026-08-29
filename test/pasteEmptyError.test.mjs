import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../src/tools/index.js';
import { pasteEmptyErrorMessage } from '../src/pure/pasteEmptyError.mjs';

/**
 * Regression coverage for the craft-audit fix: the paste-box empty-input
 * error used to hardcode "Paste some markup first" for every tool with a
 * `pasteInput` field, which was only ever accurate for html-table-to-csv.
 * Runs the real derivation against every real tool's own registered
 * `pasteInput.label` (not a hand-copied list), so a future tool that adds
 * a `pasteInput` field with an awkward label is caught here rather than
 * only ever discovered live.
 */

test('pasteEmptyErrorMessage: every real tool with a pasteInput field produces a grammatical, tool-specific message', () => {
  const pasteTools = TOOLS.filter((t) => t.pasteInput);
  assert.ok(pasteTools.length >= 15, 'sanity: expected a real, non-trivial number of paste-capable tools');
  for (const tool of pasteTools) {
    const msg = pasteEmptyErrorMessage(tool.pasteInput.label);
    assert.match(msg, /^Paste .+ first, or choose a file instead\.$/, `${tool.slug}: "${msg}"`);
    assert.doesNotMatch(msg, /paste some a /i, `${tool.slug}: "some a" bad-grammar guard tripped -- "${msg}"`);
  }
});

test('pasteEmptyErrorMessage: only html-table-to-csv\'s own message says "markup" -- the one real markup-input tool', () => {
  const markupTools = TOOLS
    .filter((t) => t.pasteInput)
    .filter((t) => /\bmarkup\b/i.test(pasteEmptyErrorMessage(t.pasteInput.label)));
  assert.deepEqual(markupTools.map((t) => t.slug).sort(), ['html-entity-encode-decode', 'html-table-to-csv']);
});

test('pasteEmptyErrorMessage: a real, exact expected message for a representative sample of tools', () => {
  const bySlug = Object.fromEntries(TOOLS.filter((t) => t.pasteInput).map((t) => [t.slug, t.pasteInput.label]));
  assert.equal(pasteEmptyErrorMessage(bySlug['csv-to-json']), 'Paste some CSV first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['json-to-csv']), 'Paste some JSON first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['xml-to-json']), 'Paste some XML first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['yaml-to-json']), 'Paste some YAML first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['sql-formatter']), 'Paste some SQL first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['html-table-to-csv']), 'Paste some HTML markup first, or choose a file instead.');
  // The one grammar edge case a mechanical "Paste some <label>" would get
  // wrong -- a label already carrying its own article ("a list") must not
  // double up into "Paste some a list first".
  assert.equal(pasteEmptyErrorMessage(bySlug['sort-lines']), 'Paste a list first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(bySlug['remove-duplicate-lines']), 'Paste a list first, or choose a file instead.');
});

test('pasteEmptyErrorMessage: a missing or empty label falls back to a safe generic noun rather than a blank sentence', () => {
  assert.equal(pasteEmptyErrorMessage(''), 'Paste some something first, or choose a file instead.');
  assert.equal(pasteEmptyErrorMessage(undefined), 'Paste some something first, or choose a file instead.');
});
