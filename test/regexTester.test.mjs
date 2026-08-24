import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGroupNames, compileRegex, findMatches, MAX_MATCHES, MAX_TEST_STRING_LENGTH, MAX_PATTERN_LENGTH,
} from '../src/pure/regexTester.mjs';

test('parseGroupNames: no groups returns totalGroups 0', () => {
  assert.deepEqual(parseGroupNames('abc'), { totalGroups: 0, names: [] });
});

test('parseGroupNames: plain unnamed capturing groups are counted in left-to-right open-paren order', () => {
  const result = parseGroupNames('(a)(b)(c)');
  assert.equal(result.totalGroups, 3);
  assert.deepEqual(result.names, []);
});

test('parseGroupNames: a named group records its name at the right 1-indexed slot', () => {
  const result = parseGroupNames(String.raw`(\d+)-(?<year>\d{4})`);
  assert.equal(result.totalGroups, 2);
  assert.equal(result.names[1], undefined);
  assert.equal(result.names[2], 'year');
});

test('parseGroupNames: non-capturing groups (?:...) are not counted', () => {
  const result = parseGroupNames('(?:abc)(def)');
  assert.equal(result.totalGroups, 1);
});

test('parseGroupNames: lookahead (?=...) and negative lookahead (?!...) are not counted', () => {
  const result = parseGroupNames('foo(?=bar)(baz)(?!qux)');
  assert.equal(result.totalGroups, 1);
});

test('parseGroupNames: lookbehind (?<=...) and negative lookbehind (?<!...) are not counted and not mistaken for named groups', () => {
  const result = parseGroupNames('(?<=foo)(bar)(?<!baz)');
  assert.equal(result.totalGroups, 1);
  assert.deepEqual(result.names, []);
});

test('parseGroupNames: an escaped literal paren \\( is not a group boundary', () => {
  const result = parseGroupNames(String.raw`\(literal\)(real)`);
  assert.equal(result.totalGroups, 1);
});

test('parseGroupNames: a literal paren inside a character class [(] is not a group boundary', () => {
  const result = parseGroupNames('[()](real)');
  assert.equal(result.totalGroups, 1);
});

test('parseGroupNames: an empty class [] closes immediately (JS semantics, unlike POSIX) -- text right after it is ordinary syntax, not still inside the class', () => {
  // [] is a complete, always-non-matching empty class in JS (unlike POSIX,
  // where a leading ] is treated as a literal); so the "()" right after it
  // is a REAL (if pointless) capturing group, same as new RegExp('[]()]')
  // itself agrees -- verified independently against native RegExp.
  const result = parseGroupNames('[]()](real)');
  assert.equal(result.totalGroups, 2);
});

test('parseGroupNames: nested groups are numbered by opening-paren order, not nesting depth', () => {
  const result = parseGroupNames('((a)(b(c)))');
  // Opening parens in order: outer(1), (a)(2), (b(c))(3), (c)(4).
  assert.equal(result.totalGroups, 4);
});

test('parseGroupNames: multiple named groups', () => {
  const result = parseGroupNames('(?<a>x)(?<b>y)(z)(?<c>w)');
  assert.equal(result.totalGroups, 4);
  assert.equal(result.names[1], 'a');
  assert.equal(result.names[2], 'b');
  assert.equal(result.names[3], undefined);
  assert.equal(result.names[4], 'c');
});

test('compileRegex: a valid pattern compiles to a real RegExp with the given flags', () => {
  const result = compileRegex('a+b', 'gi');
  assert.equal(result.ok, true);
  assert.ok(result.regex instanceof RegExp);
  assert.equal(result.regex.source, 'a+b');
  assert.equal(result.regex.flags, 'gi');
});

test('compileRegex: an invalid pattern returns a friendly ok:false with the native error message', () => {
  const result = compileRegex('(unterminated', 'g');
  assert.equal(result.ok, false);
  assert.match(result.error, /unterminated/i);
});

test('compileRegex: an unsupported flag is rejected with a specific message', () => {
  const result = compileRegex('abc', 'y');
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported flag "y"/i);
});

test('compileRegex: a pattern over MAX_PATTERN_LENGTH is rejected before ever reaching RegExp', () => {
  const result = compileRegex('a'.repeat(MAX_PATTERN_LENGTH + 1), 'g');
  assert.equal(result.ok, false);
  assert.match(result.error, /too long/i);
});

test('findMatches: without the g flag, returns at most one match (the first)', () => {
  const result = findMatches('a', '', 'aaa');
  assert.equal(result.ok, true);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].index, 0);
});

test('findMatches: with the g flag, returns every non-overlapping match', () => {
  const result = findMatches('a', 'g', 'aaa');
  assert.equal(result.ok, true);
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map((m) => m.index), [0, 1, 2]);
});

test('findMatches: a pattern that can match zero-width (a*) never infinite-loops and advances past every position', () => {
  const result = findMatches('a*', 'g', 'baab');
  assert.equal(result.ok, true);
  // Positions: 0 (empty before 'b'), 1 ('aa'), 3 (empty before 'b'), 4 (empty at end).
  assert.equal(result.matches.length, 4);
  assert.deepEqual(result.matches.map((m) => m.match), ['', 'aa', '', '']);
});

test('findMatches: capture groups are reported with 1-based index, null name for unnamed, and the captured text', () => {
  const result = findMatches(String.raw`(\w+)@(\w+)\.(\w+)`, '', 'user@example.com');
  assert.equal(result.ok, true);
  const groups = result.matches[0].groups;
  assert.deepEqual(groups.map((g) => g.index), [1, 2, 3]);
  assert.deepEqual(groups.map((g) => g.name), [null, null, null]);
  assert.deepEqual(groups.map((g) => g.value), ['user', 'example', 'com']);
});

test('findMatches: named groups carry their name alongside the numeric index', () => {
  const result = findMatches(String.raw`(?<user>\w+)@(?<domain>\w+)`, '', 'ada@example');
  const groups = result.matches[0].groups;
  assert.equal(groups[0].name, 'user');
  assert.equal(groups[0].value, 'ada');
  assert.equal(groups[1].name, 'domain');
  assert.equal(groups[1].value, 'example');
});

test('findMatches: a group inside an unmatched alternative reports value null, not undefined or an empty string', () => {
  const result = findMatches('(a)|(b)', 'g', 'b');
  const groups = result.matches[0].groups;
  assert.equal(groups[0].value, null, 'group 1 (the "a" branch) did not participate in this match');
  assert.equal(groups[1].value, 'b');
});

test('findMatches: no matches returns ok:true with an empty array, not an error', () => {
  const result = findMatches('xyz', 'g', 'abc');
  assert.equal(result.ok, true);
  assert.deepEqual(result.matches, []);
});

test('findMatches: an invalid pattern surfaces the same compileRegex error', () => {
  const result = findMatches('(unterminated', 'g', 'abc');
  assert.equal(result.ok, false);
  assert.match(result.error, /unterminated/i);
});

test('findMatches: a test string over MAX_TEST_STRING_LENGTH is rejected with a friendly error', () => {
  const result = findMatches('a', 'g', 'a'.repeat(MAX_TEST_STRING_LENGTH + 1));
  assert.equal(result.ok, false);
  assert.match(result.error, /too long/i);
});

test('findMatches: a pattern matching far more than MAX_MATCHES times is truncated, not left to grow unbounded', () => {
  const result = findMatches('a', 'g', 'a'.repeat(MAX_MATCHES + 500));
  assert.equal(result.ok, true);
  assert.equal(result.matches.length, MAX_MATCHES);
  assert.equal(result.truncated, true);
});

test('findMatches: a match count exactly at MAX_MATCHES with nothing left to match is not marked truncated', () => {
  const result = findMatches('a', 'g', 'a'.repeat(MAX_MATCHES));
  assert.equal(result.ok, true);
  assert.equal(result.matches.length, MAX_MATCHES);
  assert.equal(result.truncated, false);
});

test('findMatches: the i flag makes matching case-insensitive', () => {
  const withoutI = findMatches('ABC', '', 'abc');
  assert.equal(withoutI.matches.length, 0);
  const withI = findMatches('ABC', 'i', 'abc');
  assert.equal(withI.matches.length, 1);
});

test('findMatches: the m flag makes ^ and $ match at line boundaries, not just string boundaries', () => {
  const withoutM = findMatches('^b', 'g', 'a\nb\nc');
  assert.equal(withoutM.matches.length, 0);
  const withM = findMatches('^b', 'gm', 'a\nb\nc');
  assert.equal(withM.matches.length, 1);
});

test('findMatches: the s flag makes . match newlines too', () => {
  const withoutS = findMatches('a.b', '', 'a\nb');
  assert.equal(withoutS.matches.length, 0);
  const withS = findMatches('a.b', 's', 'a\nb');
  assert.equal(withS.matches.length, 1);
});
