/**
 * CSV to SQL INSERT statement generation -- the shared logic behind the
 * "CSV to SQL INSERT" tool. Pure data in, pure data out -- no DOM --
 * directly unit-testable in Node (test/csvToSqlInsert.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * parseCsv() is a duplicate of ../pure/splitCsv.mjs's own RFC 4180 state
 * machine, not an import of it -- this directory's own established
 * convention (see that file's header comment: "no pure module here
 * imports another") keeps each module self-contained for the browser's
 * dynamic-import-per-tool loading, the same "accepted duplication" shape
 * src/examples/index.mjs's header comment documents for escapeHtml
 * between src/shell.js and that file.
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

/** @type {Record<string, {quoteIdent:(name:string)=>string, label:string}>}
 *  each dialect's only real effect: how a column/table identifier is
 *  quoted in the generated SQL. Value literals (strings, numbers, NULL)
 *  are formatted identically across all four -- standard SQL string/
 *  numeric literal syntax is shared by every one of these engines. */
export const DIALECTS = {
  mysql: { quoteIdent: (name) => `\`${name.replace(/`/g, '``')}\``, label: 'MySQL' },
  postgres: { quoteIdent: (name) => `"${name.replace(/"/g, '""')}"`, label: 'PostgreSQL' },
  sqlserver: { quoteIdent: (name) => `[${name.replace(/]/g, ']]')}]`, label: 'SQL Server' },
  oracle: { quoteIdent: (name) => `"${name.replace(/"/g, '""')}"`, label: 'Oracle' },
};

// Integer part is either a bare "0" or a non-zero digit followed by more
// digits ("[1-9]\d*") -- this is what excludes a leading-zero code like
// "0042" or "007" from matching while still accepting "0" itself and a
// leading-zero decimal like "0.5" (whose integer part is just "0").
const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/**
 * @param {string[]} values every row's value for one column (header
 *   excluded).
 * @returns {'number'|'text'} 'number' only when every non-empty value in
 *   the column matches a plain integer or decimal (optionally negative) --
 *   a single non-numeric-looking value (a leading zero like "0123" some
 *   systems use as a code, a phone number, free text) is enough to keep
 *   the whole column quoted as text, since a wrongly-unquoted value would
 *   produce invalid or silently wrong SQL. An all-empty column defaults
 *   to text (every value would render as NULL regardless).
 */
export function detectColumnType(values) {
  const nonEmpty = values.filter((v) => v !== '');
  if (nonEmpty.length === 0) return 'text';
  return nonEmpty.every((v) => NUMBER_RE.test(v)) ? 'number' : 'text';
}

/**
 * @param {string} value
 * @returns {string} a single-quoted SQL string literal with every
 *   embedded single quote doubled (the standard SQL escape -- the same
 *   convention ../pure/sqlFormatter.mjs's tokenizer already reads).
 */
export function escapeStringLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * @param {string} value the raw CSV cell text.
 * @param {'number'|'text'} columnType from detectColumnType().
 * @returns {string} the SQL literal for this one cell: NULL (unquoted) for
 *   an empty cell regardless of column type, the raw digits for a number-
 *   typed column, or an escaped string literal for a text-typed column.
 */
export function formatValue(value, columnType) {
  if (value === '') return 'NULL';
  return columnType === 'number' ? value : escapeStringLiteral(value);
}

/**
 * @param {string} name a visitor-supplied or CSV-derived table name.
 * @returns {string} a safe SQL identifier: non-alphanumeric characters
 *   become underscores, a leading digit gets prefixed, empty input falls
 *   back to a plain default -- table/column names are never taken as
 *   literal SQL text the way string values are, so this sanitizes rather
 *   than escapes.
 */
export function sanitizeIdentifier(name, fallback = 'table_name') {
  const cleaned = String(name || '').trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (!cleaned) return fallback;
  return /^[0-9]/.test(cleaned) ? `t_${cleaned}` : cleaned;
}

/**
 * @param {string[][]} rows parseCsv()'s output, including the header row.
 * @param {{tableName?:string, dialect?:string, oneStatementPerRow?:boolean}} [opts]
 * @returns {{ok:true, sql:string, rowCount:number, columns:string[]} | {ok:false, error:string}}
 *   the generated SQL, or a friendly error for input with no real data.
 */
export function generateInsertStatements(rows, opts = {}) {
  const { tableName = 'my_table', dialect = 'mysql', oneStatementPerRow = false } = opts;
  const dialectDef = DIALECTS[dialect] || DIALECTS.mysql;

  if (!rows.length) {
    return { ok: false, error: 'That’s empty - there’s no data to convert.' };
  }
  const [header, ...dataRows] = rows;
  const realDataRows = dataRows.filter((r) => r.some((cell) => cell !== ''));
  if (!realDataRows.length) {
    return { ok: false, error: 'That has a header row but no data rows - there’s nothing to insert.' };
  }

  const columnTypes = header.map((_, colIndex) => detectColumnType(realDataRows.map((r) => r[colIndex] ?? '')));
  const quotedTable = dialectDef.quoteIdent(sanitizeIdentifier(tableName));
  const quotedColumns = header.map((h, i) => dialectDef.quoteIdent(sanitizeIdentifier(h, `column_${i + 1}`)));
  const columnList = quotedColumns.join(', ');

  const valueTuples = realDataRows.map((row) => {
    const values = header.map((_, i) => formatValue(row[i] ?? '', columnTypes[i]));
    return `(${values.join(', ')})`;
  });

  const sql = oneStatementPerRow
    ? valueTuples.map((tuple) => `INSERT INTO ${quotedTable} (${columnList}) VALUES ${tuple};`).join('\n')
    : `INSERT INTO ${quotedTable} (${columnList}) VALUES\n${valueTuples.map((t) => `  ${t}`).join(',\n')};`;

  return { ok: true, sql, rowCount: realDataRows.length, columns: header };
}
