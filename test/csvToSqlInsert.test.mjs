import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, detectColumnType, escapeStringLiteral, formatValue,
  sanitizeIdentifier, generateInsertStatements, DIALECTS,
} from '../src/pure/csvToSqlInsert.mjs';

// -- parseCsv -------------------------------------------------------------

test('parseCsv: a simple comma-separated CSV', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,2,3'), [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('parseCsv: a quoted field containing a comma is one field, not split', () => {
  assert.deepEqual(parseCsv('name,note\nAda,"hello, world"'), [['name', 'note'], ['Ada', 'hello, world']]);
});

test('parseCsv: a doubled quote inside a quoted field becomes one literal quote', () => {
  assert.deepEqual(parseCsv('a\n"say ""hi"""'), [['a'], ['say "hi"']]);
});

test('parseCsv: a quoted field containing an embedded newline is one field, not a row break', () => {
  assert.deepEqual(parseCsv('a\n"line one\nline two"'), [['a'], ['line one\nline two']]);
});

test('parseCsv: empty input returns no rows', () => {
  assert.deepEqual(parseCsv(''), []);
});

// -- detectColumnType -------------------------------------------------------------

test('detectColumnType: all-integer values are "number"', () => {
  assert.equal(detectColumnType(['1', '2', '300']), 'number');
});

test('detectColumnType: decimal values are "number"', () => {
  assert.equal(detectColumnType(['1.5', '-2.25', '0']), 'number');
});

test('detectColumnType: one non-numeric value makes the whole column "text"', () => {
  assert.equal(detectColumnType(['1', '2', 'three']), 'text');
});

test('detectColumnType: empty cells are ignored when deciding the type', () => {
  assert.equal(detectColumnType(['1', '', '3']), 'number');
});

test('detectColumnType: an all-empty column defaults to "text"', () => {
  assert.equal(detectColumnType(['', '', '']), 'text');
});

// -- escapeStringLiteral / formatValue -------------------------------------------------------------

test('escapeStringLiteral: doubles a single embedded quote', () => {
  assert.equal(escapeStringLiteral("O'Brien"), "'O''Brien'");
});

test('escapeStringLiteral: a value with no quote is just wrapped', () => {
  assert.equal(escapeStringLiteral('hello'), "'hello'");
});

test('formatValue: an empty cell is NULL regardless of column type', () => {
  assert.equal(formatValue('', 'number'), 'NULL');
  assert.equal(formatValue('', 'text'), 'NULL');
});

test('formatValue: a number-typed cell is emitted unquoted', () => {
  assert.equal(formatValue('42.5', 'number'), '42.5');
});

test('formatValue: a text-typed cell is quoted and escaped', () => {
  assert.equal(formatValue("O'Brien", 'text'), "'O''Brien'");
});

// -- sanitizeIdentifier -------------------------------------------------------------

test('sanitizeIdentifier: a normal name passes through unchanged', () => {
  assert.equal(sanitizeIdentifier('users'), 'users');
});

test('sanitizeIdentifier: spaces and punctuation become underscores, trailing ones stripped', () => {
  assert.equal(sanitizeIdentifier('My Table!'), 'My_Table');
});

test('sanitizeIdentifier: a leading digit gets a t_ prefix', () => {
  assert.equal(sanitizeIdentifier('2024_sales'), 't_2024_sales');
});

test('sanitizeIdentifier: empty or all-punctuation input falls back to the default', () => {
  assert.equal(sanitizeIdentifier(''), 'table_name');
  assert.equal(sanitizeIdentifier('!!!'), 'table_name');
  assert.equal(sanitizeIdentifier('', 'column_1'), 'column_1');
});

// -- generateInsertStatements -------------------------------------------------------------

test('generateInsertStatements: a batched multi-row INSERT, mysql dialect, mixed number/text/NULL', () => {
  const rows = [
    ['id', 'name', 'price', 'notes'],
    ['1', 'Widget', '9.99', ''],
    ['2', "O'Brien Gadget", '14.5', 'on sale'],
  ];
  const result = generateInsertStatements(rows, { tableName: 'products', dialect: 'mysql' });
  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.equal(result.sql, [
    'INSERT INTO `products` (`id`, `name`, `price`, `notes`) VALUES',
    "  (1, 'Widget', 9.99, NULL),",
    "  (2, 'O''Brien Gadget', 14.5, 'on sale');",
  ].join('\n'));
});

test('generateInsertStatements: one statement per row when oneStatementPerRow is set', () => {
  const rows = [['id', 'name'], ['1', 'Ada'], ['2', 'Bob']];
  const result = generateInsertStatements(rows, { tableName: 't', dialect: 'postgres', oneStatementPerRow: true });
  assert.equal(result.sql, [
    'INSERT INTO "t" ("id", "name") VALUES (1, \'Ada\');',
    'INSERT INTO "t" ("id", "name") VALUES (2, \'Bob\');',
  ].join('\n'));
});

test('generateInsertStatements: every dialect quotes identifiers its own way', () => {
  const rows = [['col'], ['1']];
  assert.match(generateInsertStatements(rows, { tableName: 't', dialect: 'mysql' }).sql, /`t`/);
  assert.match(generateInsertStatements(rows, { tableName: 't', dialect: 'postgres' }).sql, /"t"/);
  assert.match(generateInsertStatements(rows, { tableName: 't', dialect: 'sqlserver' }).sql, /\[t\]/);
  assert.match(generateInsertStatements(rows, { tableName: 't', dialect: 'oracle' }).sql, /"t"/);
});

test('generateInsertStatements: an unsafe table name is sanitized into a valid identifier', () => {
  const rows = [['id'], ['1']];
  const result = generateInsertStatements(rows, { tableName: 'My Table!', dialect: 'mysql' });
  assert.match(result.sql, /`My_Table`/);
});

test('generateInsertStatements: empty input is a friendly error, not a throw', () => {
  const result = generateInsertStatements([]);
  assert.equal(result.ok, false);
  assert.match(result.error, /empty/i);
});

test('generateInsertStatements: a header row with no real data rows is a friendly error', () => {
  const result = generateInsertStatements([['id', 'name']]);
  assert.equal(result.ok, false);
  assert.match(result.error, /no data rows/i);
});

test('generateInsertStatements: a row of all-empty cells is not counted as real data', () => {
  const rows = [['id', 'name'], ['', ''], ['1', 'Ada']];
  const result = generateInsertStatements(rows, { tableName: 't' });
  assert.equal(result.rowCount, 1);
});

test('generateInsertStatements: defaults to the mysql dialect and "my_table" when unspecified', () => {
  const result = generateInsertStatements([['id'], ['1']]);
  assert.match(result.sql, /`my_table`/);
});

test('DIALECTS: has exactly the four named dialects', () => {
  assert.deepEqual(Object.keys(DIALECTS).sort(), ['mysql', 'oracle', 'postgres', 'sqlserver']);
});
