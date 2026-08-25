/**
 * The json-to-yaml example panel -- Pattern C ("code-to-code" -- an input
 * code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure module (jsonToYaml.mjs) fed a REAL js-yaml
 * dump() of a tiny authored fixture: an "Input" <pre><code> of the raw
 * JSON, and the REAL resulting YAML text as an "Output" <pre><code> --
 * see src/examples/yaml-to-json.mjs for the same "run the real code"
 * pattern on the sibling reverse-direction tool.
 */

import yaml from 'js-yaml';
import { parseJsonInput } from '../pure/jsonToYaml.mjs';

export const slug = 'json-to-yaml';

export const ariaLabel = 'Example conversion of a small JSON object into YAML';

export const note = 'A JSON object with a nested array converted into YAML.';

// 4 lines -- comfortably inside the 6-8 line hard cap.
export const FIXTURE_TEXT = `{
  "name": "Widget",
  "price": 9.5,
  "tags": ["hardware", "sale"]
}`;

/**
 * @returns {string} the real YAML text, the result of running the fixture
 *   through jsonToYaml.mjs's own parseJsonInput and js-yaml's real dump()
 *   -- exported separately so test/examples.test.mjs can assert against
 *   the exact same computed result the page renders.
 */
export function convertFixture() {
  const parsed = parseJsonInput(FIXTURE_TEXT);
  if (!parsed.ok) throw new Error(`json-to-yaml example fixture failed to parse: ${parsed.error}`);
  return yaml.dump(parsed.value);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw JSON, then an
 *   "Output" <pre><code> of the real converted YAML.
 */
export function render(escapeHtml) {
  const yamlText = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(yamlText)}</code></pre>`;
}
