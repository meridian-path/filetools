import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonInput } from '../src/pure/jsonToYaml.mjs';

test('parseJsonInput: empty/whitespace-only input is a friendly error', () => {
  assert.equal(parseJsonInput('').ok, false);
  assert.equal(parseJsonInput('   \n  ').ok, false);
});

test('parseJsonInput: invalid JSON is a friendly error, not a raw SyntaxError', () => {
  const result = parseJsonInput('{not valid json');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid json/i);
});

test('parseJsonInput: a valid JSON object returns ok:true and the parsed value', () => {
  const result = parseJsonInput('{"name":"Widget","price":9.5}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { name: 'Widget', price: 9.5 });
});

test('parseJsonInput: a valid JSON array returns ok:true and the parsed array', () => {
  const result = parseJsonInput('[1,2,3]');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, [1, 2, 3]);
});

test('parseJsonInput: a bare JSON primitive (not an object/array) is still accepted - unlike json-to-csv, YAML can represent any JSON value', () => {
  const result = parseJsonInput('"just a string"');
  assert.equal(result.ok, true);
  assert.equal(result.value, 'just a string');
});
