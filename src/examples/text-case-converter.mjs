/**
 * The text-case-converter example panel -- Pattern C ("code-to-code": an
 * input code block plus the real result rendered as a second code block),
 * same shape as src/examples/html-entity-encode-decode.mjs. Runs the
 * tool's OWN pure module (textCaseConverter.mjs) on a tiny fixture at
 * build time and renders the real result, so this panel can never drift
 * from what the live tool actually does.
 *
 * Shows all six cases (not just one), since "all six at once" is this
 * tool's whole point -- the Output block lists each case's label next to
 * its real converted result, one per line.
 */

import { CASES } from '../pure/textCaseConverter.mjs';

export const slug = 'text-case-converter';

export const ariaLabel = 'Example of one phrase converted into all six text cases at once';

export const note = 'One phrase, converted into all six cases at once - copy or download whichever one you need.';

export const FIXTURE_TEXT = 'hello world';

/**
 * @returns {Array<{key:string, label:string, result:string}>} every case's
 *   real converted result for the fixture -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   results the page renders.
 */
export function convertFixture() {
  return CASES.map((c) => ({ key: c.key, label: c.label, result: c.fn(FIXTURE_TEXT) }));
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw text, then an
 *   "Output" <pre><code> listing every case's label and real result.
 */
export function render(escapeHtml) {
  const outcomes = convertFixture();
  const outputLines = outcomes.map((o) => `${o.label}: ${o.result}`).join('\n');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output (all six cases)</p>
<pre class="json-preview"><code>${escapeHtml(outputLines)}</code></pre>`;
}
