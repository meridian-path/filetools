import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitLines, tokenizeWords, diffWords, diffText, MAX_LINE_DIFF_CELLS, MIN_CHANGED_LINE_SIMILARITY,
} from '../src/pure/textDiff.mjs';

test('splitLines: empty string returns no lines', () => {
  assert.deepEqual(splitLines(''), []);
});

test('splitLines: a single trailing newline does not create a phantom extra blank line', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines('a\nb'), ['a', 'b']);
});

test('splitLines: a genuine blank line in the middle is preserved', () => {
  assert.deepEqual(splitLines('a\n\nb'), ['a', '', 'b']);
});

test('splitLines: CRLF and lone CR line endings are both normalized to LF', () => {
  assert.deepEqual(splitLines('a\r\nb\r\n'), ['a', 'b']);
  assert.deepEqual(splitLines('a\rb'), ['a', 'b']);
});

test('tokenizeWords: alternates non-whitespace and whitespace runs, reversibly', () => {
  const tokens = tokenizeWords('foo  bar');
  assert.deepEqual(tokens, ['foo', '  ', 'bar']);
  assert.equal(tokens.join(''), 'foo  bar');
});

test('tokenizeWords: empty string returns no tokens', () => {
  assert.deepEqual(tokenizeWords(''), []);
});

test('diffWords: identical lines report similarity 1 and a single equal op', () => {
  const result = diffWords('same line', 'same line');
  assert.equal(result.similarity, 1);
  assert.deepEqual(result.ops, [{ type: 'equal', text: 'same line' }]);
});

test('diffWords: two empty lines are perfectly similar with no ops', () => {
  const result = diffWords('', '');
  assert.equal(result.similarity, 1);
  assert.deepEqual(result.ops, []);
});

test('diffWords: a one-word change is reported as delete+insert around shared equal text', () => {
  const result = diffWords('The quick brown fox jumps over the lazy dog.', 'The quick brown fox leaps over the lazy dog.');
  assert.deepEqual(result.ops, [
    { type: 'equal', text: 'The quick brown fox ' },
    { type: 'delete', text: 'jumps' },
    { type: 'insert', text: 'leaps' },
    { type: 'equal', text: ' over the lazy dog.' },
  ]);
});

test('diffWords: word order matters -- same words in a different order is not treated as identical', () => {
  const result = diffWords('the cat sat', 'sat the cat');
  assert.ok(result.similarity < 1, 'reordered words must not report perfect similarity');
  // A real alignment exists ("the cat" survives as one equal run), it is
  // just not the whole-line match a bag-of-words comparison would report.
  assert.ok(result.ops.some((op) => op.type === 'equal' && op.text.includes('the cat')));
  assert.ok(result.ops.some((op) => op.type === 'insert'));
  assert.ok(result.ops.some((op) => op.type === 'delete'));
});

test('diffWords: ignoreCase makes token comparison case-insensitive without changing the rendered text', () => {
  const result = diffWords('Hello World', 'hello world', { ignoreCase: true });
  assert.equal(result.similarity, 1);
  // The rendered text still carries the ORIGINAL casing of whichever side
  // supplied it -- ignoreCase only changes the equality decision.
  assert.equal(result.ops.map((op) => op.text).join(''), 'Hello World');
});

test('diffWords: a token grid over MAX_WORD_DIFF_CELLS returns ops:null rather than hanging', () => {
  // Pick word counts whose product exceeds the cap without needing a huge
  // string (500 * 501 > 250,000).
  const lineA = Array.from({ length: 500 }, (_, i) => `a${i}`).join(' ');
  const lineB = Array.from({ length: 501 }, (_, i) => `b${i}`).join(' ');
  const result = diffWords(lineA, lineB);
  assert.equal(result.ops, null);
  assert.equal(result.similarity, 0);
});

test('diffText: identical multi-line text is entirely unchanged', () => {
  const outcome = diffText('same\ntext', 'same\ntext');
  assert.deepEqual(outcome.stats, {
    unchanged: 2, changed: 0, added: 0, removed: 0,
  });
});

test('diffText: a small mixed example reports one changed, one removed, one added, two unchanged', () => {
  const textA = 'The quick brown fox jumps over the lazy dog.\nThis line stays the same.\nThis line will be removed.\nA shared line at the end.';
  const textB = 'The quick brown fox leaps over the lazy dog.\nThis line stays the same.\nA brand new line goes here.\nA shared line at the end.';
  const outcome = diffText(textA, textB);
  assert.deepEqual(outcome.stats, {
    unchanged: 2, changed: 1, added: 1, removed: 1,
  });
  assert.deepEqual(outcome.rows.map((r) => r.status), ['changed', 'unchanged', 'removed', 'added', 'unchanged']);
  // The changed row carries word-level ops locating exactly the one word
  // that differs, not a whole-line replace.
  const changedRow = outcome.rows[0];
  assert.ok(changedRow.wordOps.some((op) => op.type === 'delete' && op.text === 'jumps'));
  assert.ok(changedRow.wordOps.some((op) => op.type === 'insert' && op.text === 'leaps'));
});

test('diffText: ignoreWhitespace treats lines differing only by spacing as unchanged', () => {
  const outcome = diffText('  hello  ', 'hello', { ignoreWhitespace: true });
  assert.deepEqual(outcome.stats, {
    unchanged: 1, changed: 0, added: 0, removed: 0,
  });
  // Rendering still shows the real original text, whitespace included.
  assert.equal(outcome.rows[0].a, '  hello  ');
});

test('diffText: without ignoreWhitespace, the same pair is reported as changed', () => {
  const outcome = diffText('  hello  ', 'hello', { ignoreWhitespace: false });
  assert.deepEqual(outcome.stats, {
    unchanged: 0, changed: 1, added: 0, removed: 0,
  });
});

test('diffText: ignoreCase treats lines differing only by case as unchanged', () => {
  const outcome = diffText('Hello World', 'hello world', { ignoreCase: true });
  assert.deepEqual(outcome.stats, {
    unchanged: 1, changed: 0, added: 0, removed: 0,
  });
});

test('diffText: a deleted line with almost nothing in common with the inserted line stays two separate rows, not one falsely "changed" row', () => {
  const outcome = diffText('completely different content here', 'xyz', {});
  assert.deepEqual(outcome.rows.map((r) => r.status).sort(), ['added', 'removed']);
});

test('diffText: both empty texts report nothing to compare, not an error', () => {
  const outcome = diffText('', '');
  assert.equal(outcome.overLimit, false);
  assert.deepEqual(outcome.rows, []);
  assert.equal(outcome.totalA, 0);
  assert.equal(outcome.totalB, 0);
});

test('diffText: a pure addition (empty original) reports every line of B as added', () => {
  const outcome = diffText('', 'x\ny');
  assert.deepEqual(outcome.rows.map((r) => r.status), ['added', 'added']);
});

test('diffText: a pure removal (empty changed text) reports every line of A as removed', () => {
  const outcome = diffText('x\ny', '');
  assert.deepEqual(outcome.rows.map((r) => r.status), ['removed', 'removed']);
});

test('diffText: line counts whose product exceeds MAX_LINE_DIFF_CELLS return overLimit instead of hanging', () => {
  const n = Math.ceil(Math.sqrt(MAX_LINE_DIFF_CELLS)) + 10;
  const textA = Array.from({ length: n }, (_, i) => `line${i}`).join('\n');
  const textB = Array.from({ length: n }, (_, i) => `other${i}`).join('\n');
  assert.ok(n * n > MAX_LINE_DIFF_CELLS);
  const outcome = diffText(textA, textB);
  assert.equal(outcome.overLimit, true);
  assert.deepEqual(outcome.rows, []);
  assert.equal(outcome.totalA, n);
  assert.equal(outcome.totalB, n);
});

test('MIN_CHANGED_LINE_SIMILARITY is a sane threshold between 0 and 1', () => {
  assert.ok(MIN_CHANGED_LINE_SIMILARITY > 0 && MIN_CHANGED_LINE_SIMILARITY < 1);
});
