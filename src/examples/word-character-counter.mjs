/**
 * The word-character-counter example panel -- Pattern C ("code-to-code":
 * an input code block plus the real result rendered as a second code
 * block), same shape as src/examples/regex-tester.mjs. Runs the tool's
 * own pure module (wordCharacterCounter.mjs) on a fixed sample at build
 * time and renders the real result, so this panel can never drift from
 * what the live tool actually does.
 */

import { countAll } from '../pure/wordCharacterCounter.mjs';

export const slug = 'word-character-counter';

export const ariaLabel = 'Example showing word, character, and sentence counts plus estimated reading time for a two-sentence sample';

export const note = 'The real counts for this exact sample text, computed the same way the live tool computes yours.';

export const FIXTURE_TEXT = 'The quick brown fox jumps over the lazy dog. It happens every single day.';

/**
 * @returns {object} the real stats for the fixture -- exported separately
 *   so test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function countFixture() {
  return countAll(FIXTURE_TEXT);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the sample text, then an
 *   "Output" <pre><code> listing every stat.
 */
export function render(escapeHtml) {
  const stats = countFixture();
  const outputText = [
    `Words: ${stats.words}`,
    `Characters (with spaces): ${stats.charactersWithSpaces}`,
    `Characters (without spaces): ${stats.charactersWithoutSpaces}`,
    `Sentences: ${stats.sentences}`,
    `Reading time: ${stats.readingTime.label}`,
  ].join('\n');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(outputText)}</code></pre>`;
}
