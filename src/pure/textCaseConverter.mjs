/**
 * Text case conversion -- the shared logic behind the "Text Case Converter"
 * tool. Pure data in, pure data out -- no DOM -- directly unit-testable in
 * Node (test/textCaseConverter.test.mjs) and loaded client-side the same
 * way every other src/pure/*.mjs module is.
 *
 * All six conversions work LINE BY LINE, not on the whole input as one
 * block: a pasted list (one identifier or phrase per line) is the realistic
 * "batch conversion" shape this tool's task brief calls out, so each line
 * keeps its own boundary in the output rather than being smashed together
 * into one run-on camelCase blob. Blank lines pass through as blank lines.
 * UPPERCASE/lowercase are pure per-character transforms and so preserve
 * every other character (numbers, punctuation, existing whitespace)
 * untouched; the other four re-tokenize each line into words first, so
 * punctuation and multiple spaces between words are normalized away in
 * their output the same way any real case converter's word-boundary
 * output would be.
 */

/**
 * @param {string} line one line of input (no embedded newline).
 * @returns {string[]} the line's words, split on any run of non-alphanumeric
 *   characters AND on a camelCase/PascalCase boundary (lowercase-or-digit
 *   followed by uppercase, or a run of uppercase followed by a
 *   capitalized word -- so "XMLParser" splits as ["XML", "Parser"], not
 *   ["XMLParser"]). This is what lets already-camelCase or already-
 *   kebab-case input convert cleanly into any of the other cases, not just
 *   plain space-separated phrases.
 */
export function splitWords(line) {
  return String(line == null ? '' : line)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {string} text raw multi-line input.
 * @param {(words: string[]) => string} joinLine turns one line's word list
 *   into that line's converted output.
 * @returns {string} the same number of lines as the input, each converted
 *   independently; a blank line stays blank.
 */
function perLine(text, joinLine) {
  return String(text == null ? '' : text)
    .split('\n')
    .map((line) => joinLine(splitWords(line)))
    .join('\n');
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** @param {string} text @returns {string} every letter uppercased; every
 *  other character (numbers, punctuation, whitespace) untouched. */
export function toUpperCase(text) {
  return String(text == null ? '' : text).toUpperCase();
}

/** @param {string} text @returns {string} every letter lowercased; every
 *  other character untouched. */
export function toLowerCase(text) {
  return String(text == null ? '' : text).toLowerCase();
}

/** @param {string} text @returns {string} each line's words capitalized
 *  and space-separated, e.g. "hello world" -> "Hello World". */
export function toTitleCase(text) {
  return perLine(text, (words) => words.map(capitalize).join(' '));
}

/** @param {string} text @returns {string} each line's words joined with no
 *  separator, first word lowercase and every later word capitalized, e.g.
 *  "hello world" -> "helloWorld". */
export function toCamelCase(text) {
  return perLine(text, (words) => words
    .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w)))
    .join(''));
}

/** @param {string} text @returns {string} each line's words lowercased and
 *  joined with underscores, e.g. "hello world" -> "hello_world". */
export function toSnakeCase(text) {
  return perLine(text, (words) => words.map((w) => w.toLowerCase()).join('_'));
}

/** @param {string} text @returns {string} each line's words lowercased and
 *  joined with hyphens, e.g. "hello world" -> "hello-world". */
export function toKebabCase(text) {
  return perLine(text, (words) => words.map((w) => w.toLowerCase()).join('-'));
}

/**
 * The six cases this tool offers, in the fixed order they're presented on
 * the page -- one array both the pure tests and the browser client can
 * iterate over, so a case can never be added to one and forgotten in the
 * other.
 * @type {Array<{key:string, label:string, fn:(text:string)=>string, fileSuffix:string}>}
 */
export const CASES = [
  { key: 'upper', label: 'UPPERCASE', fn: toUpperCase, fileSuffix: 'uppercase' },
  { key: 'lower', label: 'lowercase', fn: toLowerCase, fileSuffix: 'lowercase' },
  { key: 'title', label: 'Title Case', fn: toTitleCase, fileSuffix: 'title-case' },
  { key: 'camel', label: 'camelCase', fn: toCamelCase, fileSuffix: 'camel-case' },
  { key: 'snake', label: 'snake_case', fn: toSnakeCase, fileSuffix: 'snake-case' },
  { key: 'kebab', label: 'kebab-case', fn: toKebabCase, fileSuffix: 'kebab-case' },
];
