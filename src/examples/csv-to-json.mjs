/**
 * The csv-to-json example panel -- Pattern C ("code-to-code" -- an input
 * code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure module (csvToJson.mjs) run on a tiny
 * authored fixture: an "Input" <pre><code> of the raw CSV, and the REAL
 * resulting JSON text as an "Output" <pre><code> -- see
 * src/examples/yaml-to-json.mjs for the same pattern on the sibling
 * JSON-output tool.
 */

import { parseCsvInput, csvRowsToJsonRecords } from '../pure/csvToJson.mjs';

export const slug = 'csv-to-json';

export const ariaLabel = 'Example conversion of a small CSV table into a JSON array';

export const note = 'A 3-row CSV converted into a 3-object JSON array. Every value stays a string.';

// 4 lines -- comfortably inside the 6-8 line hard cap.
export const FIXTURE_TEXT = `sku,name,price
A100,Widget,9.5
A101,Gadget,14
A102,Gizmo,21.75
`;

/**
 * @returns {string} pretty-printed JSON text, the real result of running
 *   the fixture through csvToJson.mjs's own parseCsvInput/
 *   csvRowsToJsonRecords -- exported separately so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders.
 */
export function convertFixture() {
  const parsed = parseCsvInput(FIXTURE_TEXT);
  if (!parsed.ok) throw new Error(`csv-to-json example fixture failed to parse: ${parsed.error}`);
  const records = csvRowsToJsonRecords(parsed.rows);
  return JSON.stringify(records, null, 2);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw CSV, then an
 *   "Output" <pre><code> of the real converted JSON.
 */
export function render(escapeHtml) {
  const jsonText = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(jsonText)}</code></pre>`;
}
