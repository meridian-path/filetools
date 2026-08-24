/**
 * The csv-to-sql-insert example panel -- Pattern C ("code-to-code": an
 * input code block plus the real result rendered as a second code block),
 * same shape as src/examples/sql-formatter.mjs. Runs the tool's OWN pure
 * module (csvToSqlInsert.mjs) on a tiny fixture at build time and renders
 * the real result, so this panel can never drift from what the live tool
 * actually does.
 */

import { parseCsv, generateInsertStatements } from '../pure/csvToSqlInsert.mjs';

export const slug = 'csv-to-sql-insert';

export const ariaLabel = 'Example of two CSV rows converted into a batched SQL INSERT statement';

export const note = 'Two rows of product data, converted into a single batched INSERT statement for MySQL.';

export const FIXTURE_TEXT = 'id,name,price\n1,Widget,9.99\n2,Gadget,14.50';

/**
 * @returns {string} the real generated SQL for the fixture -- exported
 *   separately so test/examples.test.mjs can assert against the exact
 *   same computed result the page renders.
 */
export function convertFixture() {
  const rows = parseCsv(FIXTURE_TEXT);
  const outcome = generateInsertStatements(rows, { tableName: 'products', dialect: 'mysql' });
  return outcome.sql;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw CSV, then an
 *   "Output" <pre><code> of the real generated SQL.
 */
export function render(escapeHtml) {
  const sql = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(sql)}</code></pre>`;
}
