/**
 * JSON minify/beautify -- the shared logic behind the "JSON Minify and
 * Beautify" tool. Pure data in, pure data out -- no DOM -- directly
 * unit-testable in Node (test/jsonMinifyBeautify.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * Both directions need the SAME successful JSON.parse first (unlike
 * ../pure/urlEncode.mjs's encode/decode, which are independent and can
 * each fail on their own) -- parseJsonSafe() is the one gate both
 * minifyJson() and beautifyJson() sit behind, so a caller only ever
 * catches one parse error, not two.
 */

/**
 * @param {string} text raw text to parse as JSON.
 * @returns {{ok:true, value:*} | {ok:false, error:string}} the parsed
 *   value, or a friendly error if the text isn't valid JSON.
 */
export function parseJsonSafe(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: formatJsonParseError(err) };
  }
}

/**
 * @param {Error} err a caught SyntaxError from JSON.parse.
 * @returns {string} a one-line, plain-English message. V8's own
 *   SyntaxError.message (e.g. "Unexpected token } in JSON at position 12")
 *   already names the real problem, so it's reused as the detail rather
 *   than replaced -- same "reuse the engine's own reason" shape
 *   ../pure/yamlToJson.mjs's formatYamlError uses for js-yaml.
 */
export function formatJsonParseError(err) {
  const raw = err && typeof err.message === 'string' ? err.message : '';
  const reason = raw.trim() || 'the syntax couldn’t be parsed';
  return `That isn’t valid JSON - ${reason}. Check the syntax and try again.`;
}

/**
 * @param {*} value a JSON.parse()'d value.
 * @returns {string} the same value re-serialized with no whitespace at
 *   all -- the smallest valid JSON text for that value.
 */
export function minifyJson(value) {
  return JSON.stringify(value);
}

/** @type {Record<string, string|number>} the three indent choices the tool
 *  page's <select> offers, keyed by their <option value>. */
export const INDENT_OPTIONS = { '2': 2, '4': 4, tab: '\t' };

/**
 * @param {*} value a JSON.parse()'d value.
 * @param {string|number} [indent] a key of INDENT_OPTIONS ('2'/'4'/'tab'),
 *   or a raw indent value (number of spaces, or a literal string) passed
 *   straight through to JSON.stringify. Defaults to 2 spaces.
 * @returns {string} the same value re-serialized with one value/key pair
 *   per line, indented for readability.
 */
export function beautifyJson(value, indent = 2) {
  const resolved = Object.prototype.hasOwnProperty.call(INDENT_OPTIONS, indent) ? INDENT_OPTIONS[indent] : indent;
  return JSON.stringify(value, null, resolved);
}
