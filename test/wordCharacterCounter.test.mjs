import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords, countCharacters, countSentences, estimateReadingTime, countAll,
} from '../src/pure/wordCharacterCounter.mjs';

test('countWords: empty and whitespace-only text is 0 words', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   \n\t  '), 0);
});

test('countWords: counts runs of non-whitespace, collapsing multiple spaces/newlines between them', () => {
  assert.equal(countWords('one two three'), 3);
  assert.equal(countWords('one   two\n\nthree'), 3);
  assert.equal(countWords('  leading and trailing  '), 3);
});

test('countWords: a single word with internal punctuation is still one word', () => {
  assert.equal(countWords("don't"), 1);
  assert.equal(countWords('well-known'), 1);
});

test('countWords: handles non-English/non-Latin text (space-separated scripts count correctly)', () => {
  assert.equal(countWords('café über naïve'), 3);
  assert.equal(countWords('Привет как дела'), 3);
});

test('countCharacters: counts with and without spaces', () => {
  assert.deepEqual(countCharacters('a b c'), { withSpaces: 5, withoutSpaces: 3 });
  assert.deepEqual(countCharacters(''), { withSpaces: 0, withoutSpaces: 0 });
});

test('countCharacters: strips all whitespace kinds (space, tab, newline) for the no-spaces count', () => {
  assert.deepEqual(countCharacters('a\tb\nc'), { withSpaces: 5, withoutSpaces: 3 });
});

test('countCharacters: counts astral-plane characters (e.g. emoji) as one character each, not two', () => {
  // '😀' is one Unicode code point but two UTF-16 code units -- a naive
  // `.length` count would report 2 here instead of 1.
  assert.deepEqual(countCharacters('😀'), { withSpaces: 1, withoutSpaces: 1 });
  assert.deepEqual(countCharacters('a😀b'), { withSpaces: 3, withoutSpaces: 3 });
});

test('countSentences: empty text is 0 sentences', () => {
  assert.equal(countSentences(''), 0);
  assert.equal(countSentences('   '), 0);
});

test('countSentences: counts terminator-ended sentences', () => {
  assert.equal(countSentences('One. Two! Three?'), 3);
});

test('countSentences: a trailing run of punctuation (ellipsis, "?!") counts as a single boundary', () => {
  assert.equal(countSentences('Wait... Really?!'), 2);
});

test('countSentences: an in-progress final sentence with no trailing terminator still counts as one', () => {
  assert.equal(countSentences('One. Two'), 2);
  assert.equal(countSentences('still typing this sentence'), 1);
});

test('estimateReadingTime: 0 words reads as "0 min read"', () => {
  assert.deepEqual(estimateReadingTime(0), { minutes: 0, label: '0 min read' });
});

test('estimateReadingTime: under one minute at 200 wpm reads as "< 1 min read"', () => {
  const result = estimateReadingTime(50);
  assert.equal(result.label, '< 1 min read');
  assert.equal(result.minutes, 0.25);
});

test('estimateReadingTime: rounds up to whole minutes, never down', () => {
  // 201 words at 200 wpm is 1.005 minutes -- must read "2 min read", not
  // "1 min read", so the estimate is never falsely short.
  assert.equal(estimateReadingTime(201).label, '2 min read');
  assert.equal(estimateReadingTime(200).label, '1 min read');
  assert.equal(estimateReadingTime(400).label, '2 min read');
});

test('estimateReadingTime: accepts a custom words-per-minute rate', () => {
  assert.equal(estimateReadingTime(100, 100).label, '1 min read');
});

test('countAll: returns every stat computed from the same input, consistent with the individual functions', () => {
  const text = 'The quick brown fox. Jumps over the lazy dog!';
  const result = countAll(text);
  assert.equal(result.words, countWords(text));
  assert.equal(result.charactersWithSpaces, countCharacters(text).withSpaces);
  assert.equal(result.charactersWithoutSpaces, countCharacters(text).withoutSpaces);
  assert.equal(result.sentences, countSentences(text));
  assert.deepEqual(result.readingTime, estimateReadingTime(result.words));
});

test('countAll: empty text returns all-zero stats without throwing', () => {
  const result = countAll('');
  assert.equal(result.words, 0);
  assert.equal(result.charactersWithSpaces, 0);
  assert.equal(result.charactersWithoutSpaces, 0);
  assert.equal(result.sentences, 0);
  assert.equal(result.readingTime.label, '0 min read');
});
