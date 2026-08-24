import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, beautify, minify, DIALECTS } from '../src/pure/sqlFormatter.mjs';

// -- tokenize -------------------------------------------------------------

test('tokenize: recognizes a single-quoted string literal, including an escaped \'\' quote', () => {
  const tokens = tokenize("SELECT 'O''Brien'").filter((t) => t.type !== 'ws');
  const str = tokens.find((t) => t.type === 'string');
  assert.equal(str.value, "'O''Brien'");
});

test('tokenize: a line comment runs to end of line, not into the next statement', () => {
  const tokens = tokenize('SELECT 1 -- comment\nFROM t').filter((t) => t.type !== 'ws');
  const comment = tokens.find((t) => t.type === 'comment');
  assert.equal(comment.value, '-- comment');
});

test('tokenize: a block comment is captured whole, including an unterminated one at EOF', () => {
  const tokens = tokenize('SELECT 1 /* a\nb */ FROM t').filter((t) => t.type !== 'ws');
  assert.equal(tokens.find((t) => t.type === 'comment').value, '/* a\nb */');
  const unterminated = tokenize('SELECT 1 /* oops').filter((t) => t.type !== 'ws');
  assert.equal(unterminated.find((t) => t.type === 'comment').value, '/* oops');
});

test('tokenize: double quotes are a quoted identifier in every dialect', () => {
  for (const dialect of Object.keys(DIALECTS)) {
    const tokens = tokenize('SELECT "my col" FROM t', dialect).filter((t) => t.type !== 'ws');
    assert.equal(tokens.find((t) => t.type === 'quoted-ident').value, '"my col"');
  }
});

test('tokenize: backticks are a quoted identifier only for the mysql dialect', () => {
  const mysqlTokens = tokenize('SELECT `my col` FROM t', 'mysql').filter((t) => t.type !== 'ws');
  assert.equal(mysqlTokens.find((t) => t.type === 'quoted-ident')?.value, '`my col`');

  const ansiTokens = tokenize('SELECT `x`', 'ansi').filter((t) => t.type !== 'ws');
  assert.equal(ansiTokens.find((t) => t.type === 'quoted-ident'), undefined);
});

test('tokenize: square brackets are a quoted identifier only for the tsql dialect', () => {
  const tsqlTokens = tokenize('SELECT [my col] FROM t', 'tsql').filter((t) => t.type !== 'ws');
  assert.equal(tsqlTokens.find((t) => t.type === 'quoted-ident')?.value, '[my col]');
});

test('tokenize: a keyword is recognized case-insensitively; an ordinary identifier is not a keyword', () => {
  const tokens = tokenize('select id from users').filter((t) => t.type !== 'ws');
  assert.equal(tokens[0].type, 'keyword');
  assert.equal(tokens[1].type, 'word'); // "id"
  assert.equal(tokens[2].type, 'keyword'); // "from"
});

test('tokenize: recognizes two-character operators as single tokens', () => {
  const tokens = tokenize('a <> b, c >= d, e != f').filter((t) => t.type !== 'ws');
  const ops = tokens.filter((t) => t.type === 'op').map((t) => t.value);
  assert.deepEqual(ops, ['<>', '>=', '!=']);
});

// -- beautify -------------------------------------------------------------

test('beautify: a simple SELECT breaks each clause onto its own line, keywords uppercased', () => {
  const out = beautify('select id, name, email from users where active = true and age > 18 order by name asc');
  assert.equal(out, [
    'SELECT id,',
    '  name,',
    '  email',
    'FROM users',
    'WHERE active = TRUE AND age > 18',
    'ORDER BY name ASC',
  ].join('\n'));
});

test('beautify: a two-word clause (LEFT JOIN) stays on one line, not split across two', () => {
  const out = beautify('SELECT a FROM t1 LEFT JOIN t2 ON t1.id = t2.id');
  assert.ok(out.includes('LEFT JOIN t2'), `expected "LEFT JOIN t2" together, got:\n${out}`);
  assert.ok(!/LEFT\s*\n/.test(out), 'LEFT should not be alone on its own line');
});

test('beautify: a function call stays inline, with no space before its opening paren', () => {
  const out = beautify('SELECT COUNT(id), SUM(amount) FROM orders');
  assert.ok(out.includes('COUNT(id)'), `expected COUNT(id) with no space before the paren, got:\n${out}`);
  assert.ok(out.includes('SUM(amount)'), `expected SUM(amount) with no space before the paren, got:\n${out}`);
  assert.ok(!out.includes('\n  id'), 'function-call argument should not be indented onto its own line');
});

test('beautify: no-arg and star-arg function calls also get no space before the paren', () => {
  const out = beautify('SELECT COUNT(*), ROW_NUMBER() FROM t');
  assert.equal(out, [
    'SELECT COUNT(*),',
    '  ROW_NUMBER()',
    'FROM t',
  ].join('\n'));
});

test('beautify: a table name (not a function) keeps its usual space before a column-list paren', () => {
  const out = beautify("INSERT INTO users (name, email) VALUES ('Ada', 'ada@example.com')");
  assert.ok(out.startsWith('INSERT INTO users (name, email)'), `expected a space before the column list, got:\n${out}`);
});

test('beautify: CREATE TABLE keeps its usual space before the column-definition paren', () => {
  const out = beautify('CREATE TABLE users (id INT, name TEXT)');
  assert.equal(out, 'CREATE TABLE users (id INT, name TEXT)');
});

test('beautify: a window function (OVER PARTITION BY / ORDER BY) formats as one clean, correctly indented block, exactly matching a real formatter\'s output', () => {
  const out = beautify('SELECT ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC), COUNT(*) FROM emp');
  assert.equal(out, [
    'SELECT ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC),',
    '  COUNT(*)',
    'FROM emp',
  ].join('\n'));
});

test('beautify: GROUP BY inside a window function OVER(...) also stays inline, not broken onto a page-level line', () => {
  const out = beautify('SELECT SUM(amount) OVER (PARTITION BY region GROUP BY dept) FROM sales');
  assert.equal(out, [
    'SELECT SUM(amount) OVER (PARTITION BY region GROUP BY dept)',
    'FROM sales',
  ].join('\n'));
});

test('beautify: ORDER BY inside OVER(...) does not corrupt a real top-level ORDER BY that follows it', () => {
  const out = beautify('SELECT ROW_NUMBER() OVER (ORDER BY dept) AS rn FROM emp ORDER BY rn');
  assert.equal(out, [
    'SELECT ROW_NUMBER() OVER (ORDER BY dept) AS rn',
    'FROM emp',
    'ORDER BY rn',
  ].join('\n'));
});

test('beautify: a real subquery (paren immediately followed by SELECT) gets its own indented block', () => {
  const out = beautify('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 100)');
  assert.equal(out, [
    'SELECT *',
    'FROM users',
    'WHERE id IN (',
    '  SELECT user_id',
    '  FROM orders',
    '  WHERE total > 100',
    ')',
  ].join('\n'));
});

test('beautify: a CTE (WITH ... AS (SELECT ...)) indents the CTE body one level', () => {
  const out = beautify('WITH active_users AS (SELECT id FROM users WHERE active = true) SELECT * FROM active_users');
  assert.equal(out, [
    'WITH active_users AS (',
    '  SELECT id',
    '  FROM users',
    '  WHERE active = TRUE',
    ')',
    'SELECT *',
    'FROM active_users',
  ].join('\n'));
});

test('beautify: INSERT INTO ... VALUES keeps its column/value lists inline (not broken as a subquery)', () => {
  const out = beautify("INSERT INTO users (name, email) VALUES ('Ada', 'ada@example.com')");
  assert.equal(out, [
    'INSERT INTO users (name, email)',
    "VALUES ('Ada', 'ada@example.com')",
  ].join('\n'));
});

test('beautify: UPDATE ... SET ... WHERE each start their own line', () => {
  const out = beautify('UPDATE users SET active = false WHERE last_login < 2020');
  assert.equal(out, [
    'UPDATE users',
    'SET active = FALSE',
    'WHERE last_login < 2020',
  ].join('\n'));
});

test('beautify: UNION starts its own line, both SELECTs keep their own clause structure', () => {
  const out = beautify('SELECT id FROM a UNION SELECT id FROM b');
  assert.equal(out, [
    'SELECT id',
    'FROM a',
    'UNION',
    'SELECT id',
    'FROM b',
  ].join('\n'));
});

test('beautify: preserves a line comment and a block comment without corrupting surrounding structure', () => {
  const out = beautify('-- a comment\nSELECT id FROM users /* trailing */ WHERE id = 1');
  assert.equal(out, [
    '-- a comment',
    'SELECT id',
    'FROM users /* trailing */',
    'WHERE id = 1',
  ].join('\n'));
});

test('beautify: dialect-specific quoted identifiers survive unescaped and untouched', () => {
  const mysql = beautify('SELECT `user id` FROM `users`', 'mysql');
  assert.ok(mysql.includes('`user id`'));
  const tsql = beautify('SELECT [user id] FROM [dbo].[users]', 'tsql');
  assert.ok(tsql.includes('[user id]'));
  assert.ok(tsql.includes('[dbo].[users]'), `expected dotted bracket identifiers preserved, got:\n${tsql}`);
});

test('beautify: an escaped quote inside a string literal never breaks tokenization', () => {
  const out = beautify("SELECT * FROM users WHERE name = 'O''Brien'");
  assert.ok(out.includes("'O''Brien'"));
});

test('beautify: empty input returns an empty string, not a throw', () => {
  assert.equal(beautify(''), '');
  assert.equal(beautify('   '), '');
});

test('beautify: a trailing semicolon ends its own line cleanly', () => {
  const out = beautify('SELECT 1;');
  assert.equal(out, 'SELECT 1;');
});

// -- minify -------------------------------------------------------------

test('minify: collapses a multi-line, multi-space query onto one line with single spaces', () => {
  const out = minify('SELECT   id,\n  name\nFROM   users\nWHERE  id = 1');
  assert.equal(out, 'SELECT id, name FROM users WHERE id = 1');
});

test('minify: strips line and block comments entirely', () => {
  const out = minify('SELECT id -- comment\nFROM users /* note */ WHERE id = 1');
  assert.equal(out, 'SELECT id FROM users WHERE id = 1');
});

test('minify: no space immediately inside/around ( ) , . but a space still separates real tokens', () => {
  const out = minify('SELECT id , name FROM users . t WHERE id IN ( 1 , 2 )');
  assert.equal(out, 'SELECT id, name FROM users.t WHERE id IN (1, 2)');
});

test('minify: uppercases keywords the same way beautify does', () => {
  assert.equal(minify('select id from users'), 'SELECT id FROM users');
});

test('minify: a function call gets no space before its paren, matching beautify\'s own documented "none at all around ( ) , ." rule', () => {
  const out = minify('SELECT COUNT(id), SUM(amount) FROM orders');
  assert.equal(out, 'SELECT COUNT(id), SUM(amount) FROM orders');
});

test('minify: a table name still keeps its space before a column-list paren', () => {
  const out = minify("INSERT INTO users (name, email) VALUES ('Ada', 'ada@example.com')");
  assert.equal(out, "INSERT INTO users (name, email) VALUES ('Ada', 'ada@example.com')");
});

test('minify: empty input returns an empty string, not a throw', () => {
  assert.equal(minify(''), '');
});

// -- round-trip sanity -------------------------------------------------------------

test('beautify then minify then beautify again is stable (idempotent up to whitespace)', () => {
  const original = 'select id, name from users where active = true';
  const once = beautify(original);
  const twice = beautify(minify(once));
  assert.equal(once, twice);
});
