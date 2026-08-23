/**
 * The json-minify-beautify example panel -- Pattern C ("code-to-code" -- an
 * input code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure module (jsonMinifyBeautify.mjs) fed a tiny
 * authored fixture: an "Input" <pre><code> of the raw pretty-printed JSON,
 * and the REAL resulting minified text as an "Output" <pre><code> -- the
 * same "run the real code" principle src/examples/index.mjs's header
 * explains, and the same structure src/examples/url-encode-decode.mjs uses.
 */

import { minifyJson, beautifyJson } from '../pure/jsonMinifyBeautify.mjs';

export const slug = 'json-minify-beautify';

export const ariaLabel = 'Example of a JSON object minified to remove all whitespace';

export const note = 'A small nested object, minified to remove every character that isn’t part of the data.';

// A fixture with a nested object and an array, both handled the same by
// minify/beautify. FIXTURE_TEXT is derived from the fixture VALUE through
// this tool's own beautifyJson (2-space, the tool's own default) rather
// than hand-typed, so the "Input" panel can never drift out of the exact
// format JSON.stringify's indent actually produces (e.g. each array item
// on its own line) -- the same "run the real code" principle
// src/examples/index.mjs's header explains.
const FIXTURE_VALUE = { user: { name: 'Ada', roles: ['admin', 'editor'] } };

export const FIXTURE_TEXT = beautifyJson(FIXTURE_VALUE);

/**
 * @returns {string} the real minified result of running the fixture
 *   through this tool's own minifyJson -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function minifyFixture() {
  return minifyJson(FIXTURE_VALUE);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the beautified fixture, then
 *   an "Output" <pre><code> of the real minified result.
 */
export function render(escapeHtml) {
  const minified = minifyFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output (minified)</p>
<pre class="json-preview"><code>${escapeHtml(minified)}</code></pre>`;
}
