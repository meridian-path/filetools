// Regex match-finding logic. Pure and synchronous -- runs unmodified in
// Node (test/regexTester.test.mjs imports it directly) and in the browser,
// where src/browser/regexTester.worker.js is the ONLY thing that imports
// it (see that file's header comment for why the actual matching call
// happens inside a Worker rather than being imported directly by
// regexTester.client.js).
//
// This module intentionally does NOT and CANNOT protect against
// catastrophic backtracking (a pathological pattern like /(a+)+b/ against
// a long non-matching string): a native RegExp.prototype.exec() call is a
// single, synchronous, uninterruptible operation from JavaScript's own
// point of view -- there is no way to check elapsed time *during* it, only
// before and after. The only real mitigation is running it somewhere that
// CAN be forcibly killed mid-call, which is exactly what
// regexTester.worker.js's Worker + timeout does. What this module DOES
// bound is the OTHER two dimensions of a runaway result: MAX_MATCHES caps
// how many matches a `g`-flagged pattern will collect against a huge
// input, and MAX_TEST_STRING_LENGTH/MAX_PATTERN_LENGTH cap the inputs
// themselves.

export const MAX_MATCHES = 1000;
export const MAX_TEST_STRING_LENGTH = 50000;
export const MAX_PATTERN_LENGTH = 2000;

/**
 * Scans a regex pattern's source text for every CAPTURING group's opening
 * `(`, in left-to-right order (the same order JS itself assigns capture
 * group numbers, regardless of nesting), and records the name of any
 * named group `(?<name>...)`. Skips escaped characters (`\(`) and
 * characters inside a `[...]` character class (where `(` is literal, not
 * group syntax), and correctly distinguishes a named group `(?<name>` from
 * a lookbehind `(?<=`/`(?<!` (neither of which is a capturing group).
 *
 * @param {string} source a RegExp's `.source` (or an uncompiled pattern
 *   string -- both are plain strings with the same group syntax).
 * @returns {{totalGroups: number, names: (string|undefined)[]}} names is
 *   1-indexed to match RegExp match-array/group numbering (names[0] is
 *   always undefined).
 */
export function parseGroupNames(source) {
  const names = [];
  let groupIndex = 0;
  let inClass = false;
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (inClass) {
      if (ch === ']') inClass = false;
      i += 1;
      continue;
    }
    if (ch === '[') { inClass = true; i += 1; continue; }
    if (ch === '(') {
      if (source[i + 1] === '?') {
        if (source[i + 2] === '<' && source[i + 3] !== '=' && source[i + 3] !== '!') {
          const close = source.indexOf('>', i + 3);
          groupIndex += 1;
          if (close !== -1) names[groupIndex] = source.slice(i + 3, close);
          i = close === -1 ? source.length : close + 1;
          continue;
        }
        // (?:...) non-capturing, (?=...)/(?!...) lookahead -- not a capture group.
        i += 1;
        continue;
      }
      groupIndex += 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  return { totalGroups: groupIndex, names };
}

const ALLOWED_FLAGS = new Set(['g', 'i', 'm', 's', 'u']);

/**
 * @param {string} pattern
 * @param {string} flags
 * @returns {{ok: true, regex: RegExp} | {ok: false, error: string}}
 */
export function compileRegex(pattern, flags) {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { ok: false, error: `Pattern is too long (max ${MAX_PATTERN_LENGTH.toLocaleString()} characters).` };
  }
  const badFlag = [...flags].find((f) => !ALLOWED_FLAGS.has(f));
  if (badFlag) {
    return { ok: false, error: `Unsupported flag "${badFlag}" - supported flags are g, i, m, s, u.` };
  }
  try {
    return { ok: true, regex: new RegExp(pattern, flags) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function toMatchRecord(m, names) {
  const groups = [];
  for (let i = 1; i < m.length; i += 1) {
    groups.push({ index: i, name: names[i] || null, value: m[i] === undefined ? null : m[i] });
  }
  return {
    match: m[0],
    index: m.index,
    end: m.index + m[0].length,
    groups,
  };
}

/**
 * @param {string} pattern
 * @param {string} flags
 * @param {string} testString
 * @returns {{ok: true, matches: object[], truncated: boolean} | {ok: false, error: string}}
 */
export function findMatches(pattern, flags, testString) {
  if (testString.length > MAX_TEST_STRING_LENGTH) {
    return { ok: false, error: `Test string is too long (max ${MAX_TEST_STRING_LENGTH.toLocaleString()} characters).` };
  }
  const compiled = compileRegex(pattern, flags);
  if (!compiled.ok) return compiled;
  const { regex } = compiled;
  const { names } = parseGroupNames(pattern);

  const matches = [];
  let truncated = false;
  if (flags.includes('g')) {
    let m = regex.exec(testString);
    while (m !== null) {
      matches.push(toMatchRecord(m, names));
      if (m[0].length === 0) regex.lastIndex += 1;
      if (matches.length >= MAX_MATCHES) {
        truncated = regex.lastIndex <= testString.length && regex.exec(testString) !== null;
        break;
      }
      m = regex.exec(testString);
    }
  } else {
    const m = regex.exec(testString);
    if (m) matches.push(toMatchRecord(m, names));
  }

  return { ok: true, matches, truncated };
}
