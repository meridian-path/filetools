/**
 * The sql-formatter example panel -- Pattern C ("code-to-code": an input
 * code block plus the real result rendered as a second code block), same
 * shape as src/examples/json-minify-beautify.mjs. Runs the tool's OWN
 * pure module (sqlFormatter.mjs) on a tiny fixture at build time and
 * renders the real result, so this panel can never drift from what the
 * live tool actually does.
 */

import { beautify } from '../pure/sqlFormatter.mjs';

export const slug = 'sql-formatter';

export const ariaLabel = 'Example of a compact SQL query beautified into a readable, indented form';

export const note = 'A short query with a join and a filter, beautified into readable, indented form.';

export const FIXTURE_TEXT = "select u.id, u.name from users u join orders o on o.user_id = u.id where o.total > 100 order by u.name";

/**
 * @returns {string} the real beautified result of running the fixture
 *   through this tool's own beautify -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function beautifyFixture() {
  return beautify(FIXTURE_TEXT);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw query, then an
 *   "Output" <pre><code> of the real beautified result.
 */
export function render(escapeHtml) {
  const beautified = beautifyFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output (beautified)</p>
<pre class="json-preview"><code>${escapeHtml(beautified)}</code></pre>`;
}
