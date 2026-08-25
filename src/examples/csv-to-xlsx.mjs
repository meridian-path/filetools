/**
 * The csv-to-xlsx example panel -- Pattern C ("code-to-grid" -- an input
 * code block plus the real result rendered as a grid). The real download
 * is a binary .xlsx workbook, which can't be shown as text/code, so this
 * renders the same preview table the live tool itself shows (the real
 * computed rows and numeric-column detection, not a mock) -- the same
 * "code in, real grid out" shape src/examples/json-to-csv.mjs already
 * uses for its own binary-adjacent CSV output.
 *
 * Do not change the fixture without checking test/examples.test.mjs's
 * literal assertions against it still hold.
 */

import { parseCsvInput, detectNumericColumns } from '../pure/csvToXlsx.mjs';

export const slug = 'csv-to-xlsx';

export const ariaLabel = 'Example conversion of a small CSV table into an Excel-ready grid, with the price column detected as numeric';

export const note = 'A 3-row CSV becomes a 3-row grid. The price column is detected as numeric and will be a real Excel number, right-aligned here to match.';

// 4 lines -- comfortably inside the 6-8 line hard cap.
export const FIXTURE_TEXT = `sku,name,price
A100,Widget,9.5
A101,Gadget,14
A102,Gizmo,21.75
`;

/**
 * @returns {{rows: string[][], numericColumns: boolean[]}} the real result
 *   of running the fixture through csvToXlsx.mjs -- exported separately
 *   so test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function convertFixture() {
  const parsed = parseCsvInput(FIXTURE_TEXT);
  if (!parsed.ok) throw new Error(`csv-to-xlsx example fixture failed to parse: ${parsed.error}`);
  return { rows: parsed.rows, numericColumns: detectNumericColumns(parsed.rows) };
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw CSV, then an
 *   "Output" .table-scroll > .extracted-table of the real converted grid,
 *   numeric columns right-aligned and labeled "(number)" - the same
 *   markup ../browser/csvToXlsx.client.js's own live preview renders.
 */
export function render(escapeHtml) {
  const { rows, numericColumns } = convertFixture();
  const [header, ...dataRows] = rows;

  const headCells = header.map((c, i) => `<th scope="col">${escapeHtml(numericColumns[i] ? `${c} (number)` : c)}</th>`).join('');
  const bodyRows = dataRows
    .map((row) => `<tr>${header.map((_, i) => `<td${numericColumns[i] ? ' style="text-align:right"' : ''}>${escapeHtml(row[i] ?? '')}</td>`).join('')}</tr>`)
    .join('');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}
