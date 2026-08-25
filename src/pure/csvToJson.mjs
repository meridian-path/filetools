/**
 * CSV to JSON conversion -- the shared logic behind the "CSV to JSON" tool.
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/csvToJson.test.mjs) and loaded client-side the same way every
 * other src/pure/*.mjs module is.
 *
 * parseCsv() is a duplicate of ../pure/csvToSqlInsert.mjs's own RFC 4180
 * state machine, not an import of it -- this directory's own established
 * convention ("no pure module here imports another") keeps each module
 * self-contained for the browser's dynamic-import-per-tool loading.
 *
 * DOCUMENTED TYPE BEHAVIOR (also stated on the tool page's FAQ, so this
 * isn't a silent choice a visitor has to reverse-engineer from the
 * output): every value becomes a JSON STRING, never auto-coerced to a
 * number or boolean. CSV itself carries no type information - every cell
 * is text - so guessing at a "real" type risks the exact class of bug an
 * independent review already caught elsewhere in this codebase: a
 * leading-zero code like "0042" silently losing its zero once treated as
 * numeric. json-to-csv.js's own reverse direction (this tool's
 * counterpart) makes the opposite, also-safe choice for the opposite
 * reason (a JSON value already carries a real type, so it's preserved,
 * not guessed at) - the two tools are consistent in ALWAYS trusting the
 * source's own type information and never inventing new information the
 * source didn't have.
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
 *   result for blank/header-only input.
 */
export function parseCsvInput(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) {
    return { ok: false, error: 'That’s empty - paste or drop some CSV first.' };
  }
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { ok: false, error: 'That CSV needs a header row plus at least one data row - only a header (or nothing) was found.' };
  }
  return { ok: true, rows };
}

/**
 * @param {string[]} headerRow the CSV's own first row.
 * @returns {string[]} the header row, blank cells replaced with
 *   "column_N" (1-indexed by position) and repeated names de-duplicated
 *   with a trailing "_2"/"_3"/etc, so every key is unique and non-empty.
 */
function uniqueKeys(headerRow) {
  const used = new Set();
  return headerRow.map((raw, i) => {
    const base = raw && raw.trim() ? raw.trim() : `column_${i + 1}`;
    // Checked against the full set of already-assigned OUTPUT keys, not
    // just a per-base counter: a counter alone can still collide when a
    // later column's own literal name happens to match an earlier
    // duplicate's generated suffix (e.g. header ["a", "a", "a_2"] -- a
    // naive counter assigns "a", "a_2", then "a_2" again for the third
    // column, since it only ever counted occurrences of "a_2" itself,
    // never checked "a_2" was already taken). Real bug, caught by
    // independent review before this shipped.
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * @param {string[][]} rows parseCsv()'s output, header row included as
 *   rows[0].
 * @returns {object[]} one plain object per data row, keyed by the
 *   (de-duplicated, never-blank) header row. A row shorter than the
 *   header gets '' for its missing trailing fields; a row longer than the
 *   header has its extra fields silently dropped, matching every other
 *   ragged-row handling on this site (missing data becomes a blank cell,
 *   never a shifted column).
 */
export function csvRowsToJsonRecords(rows) {
  const keys = uniqueKeys(rows[0]);
  return rows.slice(1).map((row) => {
    const record = {};
    keys.forEach((key, i) => {
      record[key] = row[i] == null ? '' : row[i];
    });
    return record;
  });
}
