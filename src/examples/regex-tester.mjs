/**
 * The regex-tester example panel -- Pattern C ("code-to-code": an input
 * code block plus the real result rendered as a second code block), same
 * shape as src/examples/csv-to-sql-insert.mjs. Runs the tool's OWN pure
 * module (regexTester.mjs) on a tiny fixture at build time and renders the
 * real result, so this panel can never drift from what the live tool
 * actually does. Same fixture the client's own default state uses
 * (src/browser/regexTester.client.js's DEFAULT_PATTERN/DEFAULT_TEST_STRING),
 * so a first-time visitor sees the identical example both here and live.
 */

import { findMatches } from '../pure/regexTester.mjs';

export const slug = 'regex-tester';

export const ariaLabel = 'Example of a pattern with two capture groups matching two email addresses in a sentence';

export const note = 'Two matches, each with two capture groups (the name and the domain) - the real output for this pattern and text.';

export const FIXTURE_PATTERN = String.raw`(\w+)@(\w+\.\w+)`;
export const FIXTURE_FLAGS = 'g';
export const FIXTURE_TEST_STRING = 'Contact us at hello@example.com or support@example.org for help.';

/**
 * @returns {object[]} the real matches for the fixture -- exported
 *   separately so test/examples.test.mjs can assert against the exact
 *   same computed result the page renders.
 */
export function matchFixture() {
  const outcome = findMatches(FIXTURE_PATTERN, FIXTURE_FLAGS, FIXTURE_TEST_STRING);
  return outcome.ok ? outcome.matches : [];
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the pattern/flags/test
 *   string, then an "Output" <pre><code> summarizing each match and its
 *   capture groups.
 */
export function render(escapeHtml) {
  const matches = matchFixture();
  const inputText = `/${FIXTURE_PATTERN}/${FIXTURE_FLAGS}\n\n${FIXTURE_TEST_STRING}`;
  const outputText = matches.map((m, i) => {
    const groupLines = m.groups.map((g) => `  Group ${g.index}: "${g.value}"`).join('\n');
    return `Match ${i + 1}: "${m.match}" at ${m.index}-${m.end}\n${groupLines}`;
  }).join('\n');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(inputText)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(outputText)}</code></pre>`;
}
