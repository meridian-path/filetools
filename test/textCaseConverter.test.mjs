import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitWords, toUpperCase, toLowerCase, toTitleCase, toCamelCase, toSnakeCase, toKebabCase, CASES,
} from '../src/pure/textCaseConverter.mjs';

// -- splitWords -------------------------------------------------------------

test('splitWords: splits a plain space-separated phrase', () => {
  assert.deepEqual(splitWords('hello world'), ['hello', 'world']);
});

test('splitWords: splits on hyphens, underscores, and other punctuation', () => {
  assert.deepEqual(splitWords('hello-world_again, now!'), ['hello', 'world', 'again', 'now']);
});

test('splitWords: splits an existing camelCase boundary', () => {
  assert.deepEqual(splitWords('helloWorldAgain'), ['hello', 'World', 'Again']);
});

test('splitWords: splits a run of uppercase letters from a following capitalized word', () => {
  assert.deepEqual(splitWords('XMLParser'), ['XML', 'Parser']);
});

test('splitWords: keeps digits attached to an adjacent letter run', () => {
  assert.deepEqual(splitWords('item2 count'), ['item2', 'count']);
});

test('splitWords: collapses multiple spaces and trims', () => {
  assert.deepEqual(splitWords('  hello   world  '), ['hello', 'world']);
});

test('splitWords: an empty or punctuation-only line has zero words', () => {
  assert.deepEqual(splitWords(''), []);
  assert.deepEqual(splitWords('   '), []);
  assert.deepEqual(splitWords('---'), []);
});

// -- toUpperCase / toLowerCase -------------------------------------------------------------

test('toUpperCase: uppercases letters, leaves numbers/punctuation/whitespace untouched', () => {
  assert.equal(toUpperCase('Hello, World! 123'), 'HELLO, WORLD! 123');
});

test('toLowerCase: lowercases letters, leaves numbers/punctuation/whitespace untouched', () => {
  assert.equal(toLowerCase('Hello, World! 123'), 'hello, world! 123');
});

test('toUpperCase/toLowerCase: preserve line breaks exactly', () => {
  assert.equal(toUpperCase('a\nb\nc'), 'A\nB\nC');
  assert.equal(toLowerCase('A\nB\nC'), 'a\nb\nc');
});

// -- toTitleCase -------------------------------------------------------------

test('toTitleCase: capitalizes each word, lowercases the rest of each word', () => {
  assert.equal(toTitleCase('hello WORLD again'), 'Hello World Again');
});

test('toTitleCase: converts an existing camelCase or kebab-case line', () => {
  assert.equal(toTitleCase('helloWorld'), 'Hello World');
  assert.equal(toTitleCase('hello-world'), 'Hello World');
  assert.equal(toTitleCase('hello_world'), 'Hello World');
});

// -- toCamelCase -------------------------------------------------------------

test('toCamelCase: first word lowercase, later words capitalized, no separator', () => {
  assert.equal(toCamelCase('hello world again'), 'helloWorldAgain');
});

test('toCamelCase: converts an existing snake_case or kebab-case line', () => {
  assert.equal(toCamelCase('hello_world_again'), 'helloWorldAgain');
  assert.equal(toCamelCase('hello-world-again'), 'helloWorldAgain');
});

test('toCamelCase: a single word is just lowercased', () => {
  assert.equal(toCamelCase('HELLO'), 'hello');
});

// -- toSnakeCase -------------------------------------------------------------

test('toSnakeCase: lowercases and joins words with underscores', () => {
  assert.equal(toSnakeCase('Hello World Again'), 'hello_world_again');
});

test('toSnakeCase: converts an existing camelCase or kebab-case line', () => {
  assert.equal(toSnakeCase('helloWorldAgain'), 'hello_world_again');
  assert.equal(toSnakeCase('hello-world-again'), 'hello_world_again');
});

// -- toKebabCase -------------------------------------------------------------

test('toKebabCase: lowercases and joins words with hyphens', () => {
  assert.equal(toKebabCase('Hello World Again'), 'hello-world-again');
});

test('toKebabCase: converts an existing camelCase or snake_case line', () => {
  assert.equal(toKebabCase('helloWorldAgain'), 'hello-world-again');
  assert.equal(toKebabCase('hello_world_again'), 'hello-world-again');
});

// -- per-line / batch behavior -------------------------------------------------------------

test('toTitleCase/toCamelCase/toSnakeCase/toKebabCase: each line of a pasted list converts independently, line breaks preserved', () => {
  const input = 'first item\nsecond item\nthird item';
  assert.equal(toTitleCase(input), 'First Item\nSecond Item\nThird Item');
  assert.equal(toCamelCase(input), 'firstItem\nsecondItem\nthirdItem');
  assert.equal(toSnakeCase(input), 'first_item\nsecond_item\nthird_item');
  assert.equal(toKebabCase(input), 'first-item\nsecond-item\nthird-item');
});

test('a blank line in a multi-line paste stays blank in every case\'s output', () => {
  const input = 'first item\n\nthird item';
  assert.equal(toTitleCase(input), 'First Item\n\nThird Item');
  assert.equal(toCamelCase(input), 'firstItem\n\nthirdItem');
});

// -- CASES -------------------------------------------------------------

test('CASES: exactly six entries, each with a unique key and a working fn', () => {
  assert.equal(CASES.length, 6);
  const keys = CASES.map((c) => c.key);
  assert.equal(new Set(keys).size, 6, 'expected six unique keys');
  for (const c of CASES) {
    assert.equal(typeof c.fn('hello world'), 'string');
  }
});
