/**
 * CSV to XLSX conversion -- the shared logic behind the "CSV to XLSX" tool.
 * Pure data in, pure data out -- no DOM, no ExcelJS -- directly
 * unit-testable in Node (test/csvToXlsx.test.mjs) and loaded client-side
 * the same way every other src/pure/*.mjs module is. The actual XLSX
 * byte-writing itself happens in ../browser/csvToXlsx.client.js (ExcelJS
 * is a browser-loaded UMD bundle, not something this pure module touches);
 * this module's job is parsing the CSV and deciding, per column, whether
 * its values should become real Excel numbers or stay text.
 *
 * parseCsv() is a duplicate of ../pure/csvToJson.mjs's own RFC 4180 state
 * machine, not an import of it -- this directory's own established
 * convention ("no pure module here imports another") keeps each module
 * self-contained for the browser's dynamic-import-per-tool loading.
 *
 * NUMBER_RE/isNumericColumn() are a duplicate of
 * ../pure/csvToSqlInsert.mjs's own detectColumnType() logic, for the exact
 * same reason that tool's own FAQ states and an independent review already
 * caught as a real bug once in this codebase: a leading-zero value like
 * "0042" is NOT a number by this rule (it is a code that merely looks
 * numeric), so a column containing it is written as text, never coerced
 * into a real Excel number that would silently drop the leading zero.
 */

/**
 * @param {string} text raw CSV file text, any line-ending convention.
 * @returns {string[][]} every row as an array of field strings, quotes and
 *   doubled-quote escaping removed. An entirely empty `text` returns [].
 */
export function parseCsv(text) {
  const src = String(text == null ? '' : text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = src.length;
  let rowHasContent = false;

  function pushField() {
    row.push(field);
    field = '';
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
    rowHasContent = false;
  }

  while (i < len) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      rowHasContent = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      rowHasContent = true;
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    rowHasContent = true;
    i += 1;
  }
  if (field !== '' || row.length > 0 || rowHasContent) {
    pushRow();
  }

  return rows;
}

/**
 * @param {string} text raw pasted/uploaded CSV text.
 * @returns {{ok:true, rows:string[][]} | {ok:false, error:string}} a
 *   friendly, specific error rather than silently producing an empty
 *   workbook for blank input.
 */
export function parseCsvInput(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) {
    return { ok: false, error: 'That’s empty - paste or drop some CSV first.' };
  }
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ok: false, error: 'That doesn’t look like any real CSV rows.' };
  }
  return { ok: true, rows };
}

// Integer part is either a bare "0" or a non-zero digit followed by more
// digits ("[1-9]\d*") -- this is what excludes a leading-zero code like
// "0042" or "007" from matching while still accepting "0" itself and a
// leading-zero decimal like "0.5" (whose integer part is just "0").
const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/**
 * @param {string[]} values every data row's value for one column (header
 *   excluded).
 * @returns {boolean} true only when every non-empty value in the column
 *   matches a plain integer or decimal (optionally negative). A single
 *   non-numeric-looking value (a leading-zero code, a phone number, free
 *   text) keeps the whole column as text - the same "one bad value keeps
 *   the whole column safe" rule ../pure/csvToSqlInsert.mjs's own
 *   detectColumnType() already established and had independently
 *   reviewed. An all-empty column is not numeric (nothing to convert).
 */
export function isNumericColumn(values) {
  const nonEmpty = values.filter((v) => v !== '');
  if (nonEmpty.length === 0) return false;
  return nonEmpty.every((v) => NUMBER_RE.test(v));
}

/**
 * @param {string[][]} rows parseCsv()'s output, header row included as
 *   rows[0].
 * @returns {boolean[]} one entry per column, true where every data-row
 *   value in that column is safely numeric (see isNumericColumn).
 */
export function detectNumericColumns(rows) {
  const width = rows[0].length;
  const dataRows = rows.slice(1);
  return Array.from({ length: width }, (_, col) => isNumericColumn(dataRows.map((row) => row[col] ?? '')));
}
