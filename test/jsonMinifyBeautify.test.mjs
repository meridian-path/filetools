import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonSafe, formatJsonParseError, minifyJson, beautifyJson, INDENT_OPTIONS } from '../src/pure/jsonMinifyBeautify.mjs';

// -- parseJsonSafe -------------------------------------------------------------

test('parseJsonSafe: parses a well-formed object', () => {
  assert.deepEqual(parseJsonSafe('{"a":1,"b":[2,3]}'), { ok: true, value: { a: 1, b: [2, 3] } });
});

test('parseJsonSafe: parses a bare top-level primitive (a number, string, or null)', () => {
  assert.deepEqual(parseJsonSafe('42'), { ok: true, value: 42 });
  assert.deepEqual(parseJsonSafe('"hello"'), { ok: true, value: 'hello' });
  assert.deepEqual(parseJsonSafe('null'), { ok: true, value: null });
});

test('parseJsonSafe: a malformed object is a friendly error, not a throw', () => {
  const result = parseJsonSafe('{"a":1,}');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid JSON/i);
});

test('parseJsonSafe: an empty string is a friendly error, not a throw', () => {
  const result = parseJsonSafe('');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid JSON/i);
});

// -- formatJsonParseError -------------------------------------------------------------

test('formatJsonParseError: returns a non-empty, plain-English message regardless of the caught error', () => {
  const msg = formatJsonParseError(new SyntaxError('Unexpected token } in JSON at position 7'));
  assert.match(msg, /valid JSON/i);
  assert.match(msg, /Unexpected token/);
});

test('formatJsonParseError: falls back to a generic reason when the error has no message', () => {
  const msg = formatJsonParseError({});
  assert.match(msg, /syntax couldn.t be parsed/i);
});

// -- minifyJson -------------------------------------------------------------

test('minifyJson: strips all whitespace from a pretty-printed object', () => {
  const parsed = { a: 1, b: { c: [1, 2, 3] } };
  assert.equal(minifyJson(parsed), '{"a":1,"b":{"c":[1,2,3]}}');
});

test('minifyJson: round-trips through JSON.parse back to an equal value', () => {
  const parsed = { name: 'Ada', tags: ['admin', 'editor'], active: true, meta: null };
  assert.deepEqual(JSON.parse(minifyJson(parsed)), parsed);
});

// -- beautifyJson -------------------------------------------------------------

test('beautifyJson: defaults to 2-space indentation', () => {
  assert.equal(beautifyJson({ a: 1 }), '{\n  "a": 1\n}');
});

test('beautifyJson: "4" indents with 4 spaces', () => {
  assert.equal(beautifyJson({ a: 1 }, '4'), '{\n    "a": 1\n}');
});

test('beautifyJson: "tab" indents with a literal tab character', () => {
  assert.equal(beautifyJson({ a: 1 }, 'tab'), '{\n\t"a": 1\n}');
});

test('beautifyJson: round-trips through JSON.parse back to an equal value, for every indent option', () => {
  const parsed = { name: 'Ada', tags: ['admin', 'editor'], nested: { active: true } };
  for (const key of Object.keys(INDENT_OPTIONS)) {
    assert.deepEqual(JSON.parse(beautifyJson(parsed, key)), parsed);
  }
});
