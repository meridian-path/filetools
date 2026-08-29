/**
 * The unix-timestamp-converter example panel -- Pattern C ("code-to-code":
 * an input code block plus the real result rendered as a second code
 * block), same shape as src/examples/regex-tester.mjs. Runs the tool's
 * own pure module (unixTimestampConverter.mjs) on a fixed sample at build
 * time and renders the real result, so this panel can never drift from
 * what the live tool actually does.
 *
 * The fixture is deliberately shaped like a real API JSON response's
 * `created_at` field (per this tool's own content-depth requirement: a
 * worked example against a realistic API-response-shaped timestamp, not
 * a bare number with no context) -- the kind of value a developer would
 * actually paste in here after hitting "what does this timestamp even
 * mean" while debugging.
 */

import { epochToDate } from '../pure/unixTimestampConverter.mjs';

export const slug = 'unix-timestamp-converter';

export const ariaLabel = 'Example converting a timestamp field from a sample API JSON response into UTC and local date/time';

export const note = 'The real UTC and local time for this exact timestamp, computed the same way the live tool computes yours.';

export const FIXTURE_JSON = '{\n  "id": 48213,\n  "status": "completed",\n  "created_at": 1735689600\n}';
export const FIXTURE_TIMESTAMP = 1735689600;

/**
 * @returns {object} the real conversion result for the fixture -- exported
 *   separately so test/examples.test.mjs can assert against the exact
 *   same computed result the page renders.
 */
export function convertFixture() {
  return epochToDate(FIXTURE_TIMESTAMP, 'seconds');
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of a sample API JSON response,
 *   then an "Output" <pre><code> with the real UTC/local conversion of
 *   its `created_at` field.
 */
export function render(escapeHtml) {
  const result = convertFixture();
  const outputText = [
    `created_at: ${FIXTURE_TIMESTAMP} (seconds)`,
    `UTC: ${result.utcLabel}`,
    `Local (${result.localTimeZone}): ${result.localLabel}`,
  ].join('\n');

  return `<p class="caption">Input (a sample API response)</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_JSON)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(outputText)}</code></pre>`;
}
