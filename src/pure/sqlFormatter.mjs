/**
 * SQL formatting -- the shared logic behind the "SQL Formatter" tool.
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/sqlFormatter.test.mjs) and loaded client-side the same way every
 * other src/pure/*.mjs module is.
 *
 * SCOPE NOTE (also stated in the tool page's own FAQ copy): this is a
 * token-based reformatter, not a full SQL parser with a grammar per
 * dialect -- writing a correct, complete grammar for even one of MySQL/
 * PostgreSQL/T-SQL/SQLite/BigQuery/Snowflake is a genuinely large
 * undertaking (each has its own reserved-word set, operator quirks, and
 * statement forms), and a subtly wrong parser is worse than an honest
 * reformatter. This tokenizes the query correctly (string literals,
 * comments, and every dialect's own identifier-quoting style are never
 * misread as SQL structure), then applies one consistent, disclosed set of
 * layout rules: uppercase reserved keywords, a new line before each major
 * clause, one column per line under SELECT, and indentation that tracks
 * parenthesis depth. It does not validate that the SQL is correct, and it
 * does not understand dialect-specific grammar beyond identifier quoting
 * and a shared, broad reserved-word list covering ANSI SQL plus the
 * common keywords across all six listed dialects.
 */

/** @type {Record<string, {quote:string[], label:string}>} the dialect
 *  selector's only real effect: which characters this tokenizer treats as
 *  a quoted-identifier delimiter (T-SQL's square brackets and MySQL's
 *  backticks are otherwise indistinguishable from stray punctuation).
 *  Double quotes are accepted as identifier quotes in every dialect here
 *  (the ANSI SQL standard form, and valid in all six by default or under
 *  a compatibility setting), so they're listed for all of them. */
export const DIALECTS = {
  ansi: { quote: ['"'], label: 'ANSI SQL / PostgreSQL / SQLite / Snowflake' },
  mysql: { quote: ['"', '`'], label: 'MySQL / BigQuery' },
  tsql: { quote: ['"', '['], label: 'SQL Server (T-SQL)' },
};

const KEYWORDS = new Set([
  'select', 'from', 'where', 'group', 'by', 'order', 'having', 'limit', 'offset',
  'insert', 'into', 'values', 'update', 'set', 'delete', 'merge',
  'create', 'table', 'view', 'index', 'database', 'schema', 'drop', 'alter', 'add', 'column',
  'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on', 'using',
  'union', 'all', 'intersect', 'except', 'distinct',
  'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'ilike', 'is', 'null',
  'as', 'with', 'recursive', 'case', 'when', 'then', 'else', 'end',
  'asc', 'desc', 'nulls', 'first', 'last',
  'primary', 'key', 'foreign', 'references', 'unique', 'default', 'constraint', 'check',
  'begin', 'commit', 'rollback', 'transaction',
  'over', 'partition', 'window', 'row', 'rows', 'range', 'unbounded', 'preceding', 'following', 'current',
  'top', 'fetch', 'next', 'only', 'for',
  'true', 'false', 'cast', 'convert', 'returning',
]);

// Clause keywords each start a fresh line at the current indent depth.
// Multi-word entries are matched greedily (longest first) so e.g. "group
// by" starts one new line, not two.
const CLAUSE_STARTS = [
  'union all', 'union', 'intersect', 'except',
  'left outer join', 'right outer join', 'full outer join',
  'left join', 'right join', 'full join', 'cross join', 'inner join', 'join',
  'group by', 'order by',
  'select', 'from', 'where', 'having', 'limit', 'offset', 'set', 'values',
  'insert into', 'update', 'delete from', 'with',
  'on',
].sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length);

const INDENT = '  ';

/**
 * @param {string} sql
 * @param {string} dialectKey a key of DIALECTS.
 * @returns {Array<{type:string, value:string}>} type is one of 'keyword',
 *   'string', 'quoted-ident', 'comment', 'punct', 'op', 'word', 'number',
 *   'ws'.
 */
export function tokenize(sql, dialectKey = 'ansi') {
  const dialect = DIALECTS[dialectKey] || DIALECTS.ansi;
  const src = String(sql == null ? '' : sql);
  const tokens = [];
  let i = 0;
  const n = src.length;

  const closeFor = { '[': ']' };

  while (i < n) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      let j = i + 1;
      while (j < n && /\s/.test(src[j])) j++;
      tokens.push({ type: 'ws', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '-' && src[i + 1] === '-') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      tokens.push({ type: 'comment', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "'" && src[j + 1] === "'") { j += 2; continue; }
        if (src[j] === "'") { j += 1; break; }
        j += 1;
      }
      tokens.push({ type: 'string', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (dialect.quote.includes(ch)) {
      const close = closeFor[ch] || ch;
      let j = i + 1;
      while (j < n) {
        if (close !== ch && src[j] === close) { j += 1; break; }
        if (close === ch && src[j] === ch && src[j + 1] === ch) { j += 2; continue; }
        if (close === ch && src[j] === ch) { j += 1; break; }
        j += 1;
      }
      tokens.push({ type: 'quoted-ident', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < n && /[0-9.eE+-]/.test(src[j]) && !(/[+-]/.test(src[j]) && !/[eE]/.test(src[j - 1]))) j++;
      tokens.push({ type: 'number', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'word', value: word });
      i = j;
      continue;
    }

    const twoChar = src.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '||', '::'].includes(twoChar)) {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }

    if (',();.'.includes(ch)) {
      tokens.push({ type: 'punct', value: ch });
      i += 1;
      continue;
    }

    tokens.push({ type: 'op', value: ch });
    i += 1;
  }

  return tokens;
}

/**
 * @param {Array<{type:string, value:string}>} tokens from tokenize(),
 *   still carrying 'ws' tokens.
 * @returns {Array<{type:string, value:string}>} the same tokens with
 *   every 'ws' entry removed and every keyword's value uppercased --
 *   the two normalizations both beautify() and minify() start from.
 */
function significantTokens(tokens) {
  return tokens
    .filter((t) => t.type !== 'ws')
    .map((t) => (t.type === 'keyword' ? { ...t, value: t.value.toUpperCase() } : t));
}

function clauseStartAt(tokens, index) {
  for (const phrase of CLAUSE_STARTS) {
    const words = phrase.split(' ');
    if (index + words.length > tokens.length) continue;
    const slice = tokens.slice(index, index + words.length);
    if (slice.every((t) => t.type === 'keyword') && slice.map((t) => t.value.toLowerCase()).join(' ') === phrase) {
      return words.length;
    }
  }
  return 0;
}

/**
 * @param {string} sql
 * @param {string} [dialectKey] a key of DIALECTS. Defaults to 'ansi'.
 * @returns {string} the query reformatted: uppercase keywords, a new line
 *   before each major clause, one SELECT column per line, indentation
 *   tracking parenthesis depth.
 */
export function beautify(sql, dialectKey = 'ansi') {
  const tokens = significantTokens(tokenize(sql, dialectKey));
  if (!tokens.length) return '';

  const lines = [];
  let current = '';
  let depth = 0;
  // The last real token appended to the still-open `current` line (null
  // right after a flush) -- spacing before '(' and ')' depends on it: no
  // space between a function name and its call, e.g. COUNT(x), but a space
  // after a keyword, e.g. "IN (" or "VALUES (".
  let lastTok = null;
  // Only a paren immediately followed by SELECT/WITH (a real subquery) gets
  // its own indented lines; a plain function-call paren (COUNT(x), SUM(x))
  // stays inline at the surrounding line's depth. One boolean per currently
  // -open paren, so a nested subquery-inside-a-function-call (or vice
  // versa) unwinds correctly on its matching close.
  const parenIsSubquery = [];
  // Which depths are currently inside a SELECT column list -- a comma at
  // that exact depth starts a new column line; a comma inside a function
  // call's argument list (a different, deeper or inline, context) does not.
  const selectListAtDepth = {};

  function flush() {
    const trimmed = current.trim();
    if (trimmed) {
      // A SELECT column list's own first line ("SELECT id,") stays at the
      // clause's own indent; every later column line for that same list
      // (comma-broken, or the trailing column just before the next clause)
      // sits one level deeper, whichever token triggered this flush.
      const isClauseOpeningLine = trimmed.toUpperCase().startsWith('SELECT');
      const extra = selectListAtDepth[depth] && !isClauseOpeningLine ? 1 : 0;
      lines.push(INDENT.repeat(depth + extra) + trimmed);
    }
    current = '';
    lastTok = null;
  }

  function append(text, { spaceBefore = true } = {}) {
    const needsSpace = spaceBefore && current.length > 0 && !current.endsWith('.') && !current.endsWith('(');
    current += (needsSpace ? ' ' : '') + text;
  }

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    const clauseLen = clauseStartAt(tokens, i);
    if (clauseLen) {
      flush();
      const phrase = tokens.slice(i, i + clauseLen).map((tok) => tok.value).join(' ');
      current = phrase;
      selectListAtDepth[depth] = tokens[i].value === 'SELECT';
      lastTok = tokens[i + clauseLen - 1];
      i += clauseLen;
      continue;
    }

    if (t.type === 'punct' && t.value === '(') {
      const next = tokens[i + 1];
      const isSubquery = !!next && next.type === 'keyword' && (next.value === 'SELECT' || next.value === 'WITH');
      append('(');
      lastTok = t;
      if (isSubquery) flush();
      depth += 1;
      parenIsSubquery.push(isSubquery);
      i += 1;
      continue;
    }
    if (t.type === 'punct' && t.value === ')') {
      const wasSubquery = parenIsSubquery.pop();
      if (wasSubquery) flush();
      depth = Math.max(0, depth - 1);
      delete selectListAtDepth[depth + 1];
      append(')', { spaceBefore: false });
      lastTok = t;
      i += 1;
      continue;
    }
    if (t.type === 'punct' && t.value === ',') {
      current += ',';
      if (selectListAtDepth[depth]) flush();
      i += 1;
      continue;
    }
    if (t.type === 'punct' && t.value === ';') {
      current += ';';
      flush();
      i += 1;
      continue;
    }
    if (t.type === 'punct' && t.value === '.') {
      current += '.';
      lastTok = t;
      i += 1;
      continue;
    }

    append(t.value);
    lastTok = t;
    i += 1;
  }
  flush();

  return lines.join('\n');
}

/**
 * @param {string} sql
 * @param {string} [dialectKey] a key of DIALECTS. Defaults to 'ansi'.
 * @returns {string} the query on one line: comments stripped, all
 *   whitespace collapsed to single spaces (none at all around `(` `)` `,`
 *   `.`), keywords uppercased.
 */
export function minify(sql, dialectKey = 'ansi') {
  const tokens = significantTokens(tokenize(sql, dialectKey)).filter((t) => t.type !== 'comment');
  let out = '';
  for (const t of tokens) {
    if (t.type === 'punct' && (t.value === ')' || t.value === ',' || t.value === ';' || t.value === '.')) {
      out += t.value;
      continue;
    }
    const needsSpace = out.length > 0 && !/[\s(.]$/.test(out);
    out += (needsSpace ? ' ' : '') + t.value;
  }
  return out;
}
