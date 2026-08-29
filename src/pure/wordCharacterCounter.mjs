// Word/character/sentence counting and reading-time estimation. Pure
// logic, imported both by the browser client and directly by
// test/wordCharacterCounter.test.mjs -- no DOM or Node built-ins, so the
// exact same file runs unmodified in the browser and under `node --test`
// (same convention src/pure/uuidGenerator.mjs's header comment states).
//
// Distinct from word-frequency-counter.js's own pure module: that one
// ranks words by how often each one appears; this one only counts totals
// (words/characters/sentences/reading time), a different transactional
// query with no overlap in what it computes.

/**
 * A "word" here is any run of non-whitespace characters -- deliberately
 * simpler than word-frequency-counter.mjs's own word-shape regex (which
 * has to isolate individual words for ranking, so it excludes punctuation
 * carefully). A straight count has no ranking to protect from punctuation
 * noise, and this simpler definition is also what handles non-Latin
 * scripts (CJK, Cyrillic, Arabic, ...) correctly by construction -- a
 * letter-class regex tuned for English would undercount or zero out text
 * with no ASCII letters at all.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * @param {string} text
 * @returns {{withSpaces: number, withoutSpaces: number}} character counts.
 *   Uses Array.from (not .length) so counting is correct per Unicode code
 *   point, not per UTF-16 code unit -- a character outside the Basic
 *   Multilingual Plane (many emoji, some CJK extension characters) is one
 *   code point but two UTF-16 code units, and `.length` alone would
 *   silently double-count it.
 */
export function countCharacters(text) {
  const withSpaces = Array.from(text).length;
  const withoutSpaces = Array.from(text.replace(/\s/g, '')).length;
  return { withSpaces, withoutSpaces };
}

/**
 * @param {string} text
 * @returns {number} an estimated sentence count -- counts sentence-ending
 *   punctuation runs (a run of one or more ., !, or ? followed by
 *   whitespace or end-of-string, so "Wait..." or "Really?!" counts as one
 *   boundary, not three/two); a final chunk of non-whitespace text with no
 *   trailing terminator still counts as one sentence (a visitor mid-typing
 *   a sentence should see a plausible count, not one that's short by
 *   exactly one until they type the final period). Disclosed limitation
 *   in the FAQ: a "Mr. Smith" style abbreviation still reads as a
 *   sentence break; no abbreviation dictionary is worth the
 *   false-precision it would imply.
 */
export function countSentences(text) {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const terminators = trimmed.match(/[.!?]+(?=\s|$)/g) || [];
  const endsWithTerminator = /[.!?]\s*$/.test(trimmed);
  return endsWithTerminator ? terminators.length : terminators.length + 1;
}

const DEFAULT_WORDS_PER_MINUTE = 200;

/**
 * @param {number} wordCount
 * @param {number} [wordsPerMinute]
 * @returns {{minutes: number, label: string}} minutes is the raw
 *   fractional estimate (for tests/other callers); label is the
 *   human-facing rounded string ("< 1 min read" below one minute, "N min
 *   read" otherwise, rounded up so "1 min read" always means "genuinely
 *   under two minutes", not rounded down to a falsely-short estimate).
 */
export function estimateReadingTime(wordCount, wordsPerMinute = DEFAULT_WORDS_PER_MINUTE) {
  const minutes = wordCount / wordsPerMinute;
  if (wordCount === 0) return { minutes: 0, label: '0 min read' };
  if (minutes < 1) return { minutes, label: '< 1 min read' };
  const rounded = Math.ceil(minutes);
  return { minutes, label: `${rounded} min read` };
}

/**
 * @param {string} text
 * @returns {{
 *   words: number,
 *   charactersWithSpaces: number,
 *   charactersWithoutSpaces: number,
 *   sentences: number,
 *   readingTime: {minutes: number, label: string},
 * }} every stat this tool reports, computed once from the same input so
 *   they can never drift relative to each other.
 */
export function countAll(text) {
  const words = countWords(text);
  const { withSpaces, withoutSpaces } = countCharacters(text);
  return {
    words,
    charactersWithSpaces: withSpaces,
    charactersWithoutSpaces: withoutSpaces,
    sentences: countSentences(text),
    readingTime: estimateReadingTime(words),
  };
}
