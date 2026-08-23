/**
 * The hash-generator example panel -- Pattern C ("code-to-code": an input
 * code block plus the real result rendered as a second code block), same
 * shape as src/examples/html-entity-encode-decode.mjs. Runs the tool's OWN
 * pure module (hashGenerator.mjs) on a tiny fixture at build time and
 * renders the real result, so this panel can never drift from what the
 * live tool actually does.
 *
 * Async at the module level (top-level await), same shape
 * src/build.js's own header comment already explains for
 * src/examples/index.mjs's build-time import() of this whole directory --
 * computeHashes() is async (it awaits crypto.subtle.digest for four of
 * the five algorithms), so this is the one example module that can't stay
 * synchronous like most of its siblings.
 */

import { computeHashes } from '../pure/hashGenerator.mjs';

export const slug = 'hash-generator';

export const ariaLabel = 'Example of one short phrase hashed with all five algorithms at once';

export const note = 'A well-known pangram, hashed with all five algorithms - the same fixture used in most published hash-function documentation.';

export const FIXTURE_TEXT = 'The quick brown fox jumps over the lazy dog';

const FIXTURE_HASHES = await computeHashes(new TextEncoder().encode(FIXTURE_TEXT));

/**
 * @returns {Array<{key:string, label:string, hash:string}>} the real
 *   computed hashes for the fixture -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   results the page renders.
 */
export function hashFixture() {
  return FIXTURE_HASHES;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw text, then an
 *   "Output" <pre><code> listing every algorithm's label and real hash.
 */
export function render(escapeHtml) {
  const outputLines = FIXTURE_HASHES.map((h) => `${h.label}: ${h.hash}`).join('\n');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output (all five hashes)</p>
<pre class="json-preview"><code>${escapeHtml(outputLines)}</code></pre>`;
}
