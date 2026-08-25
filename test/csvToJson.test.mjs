import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvInput, csvRowsToJsonRecords } from '../src/pure/csvToJson.mjs';

// -- parseCsv -----------------------------------------------------------------

test('parseCsv: a simple header + rows', () => {
  assert.deepEqual(parseCsv('name,price\nCoffee,4.5\nTea,3.25\n'), [
    ['name', 'price'],
    ['Coffee', '4.5'],
    ['Tea', '3.25'],
  ]);
});

test('parseCsv: a quoted field containing a comma and an escaped quote', () => {
  assert.deepEqual(parseCsv('name,note\n"Widget, Deluxe","She said ""hi"""\n'), [
    ['name', 'note'],
    ['Widget, Deluxe', 'She said "hi"'],
  ]);
});

test('parseCsv: handles CRLF, bare LF, and a final line with no trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\n3,4'), [
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('parseCsv: empty input returns an empty array', () => {
  assert.deepEqual(parseCsv(''), []);
});

// -- parseCsvInput --------------------------------------------------------------

test('parseCsvInput: empty/whitespace-only input is a friendly error', () => {
  assert.equal(parseCsvInput('').ok, false);
  assert.equal(parseCsvInput('   \n  ').ok, false);
});

test('parseCsvInput: a header-only CSV (no data rows) is a friendly error', () => {
  const result = parseCsvInput('name,price\n');
  assert.equal(result.ok, false);
  assert.match(result.error, /header row plus at least one data row/);
});

test('parseCsvInput: a valid CSV with header + data returns ok:true and the parsed rows', () => {
  const result = parseCsvInput('name,price\nCoffee,4.5\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows, [['name', 'price'], ['Coffee', '4.5']]);
});

// -- csvRowsToJsonRecords -------------------------------------------------------

test('csvRowsToJsonRecords: converts each data row into an object keyed by the header row', () => {
  const rows = [
    ['name', 'price'],
    ['Coffee', '4.50'],
    ['Tea', '3.25'],
  ];
  assert.deepEqual(csvRowsToJsonRecords(rows), [
    { name: 'Coffee', price: '4.50' },
    { name: 'Tea', price: '3.25' },
  ]);
});

test('csvRowsToJsonRecords: every value stays a string, never coerced to a number or boolean (leading-zero codes and phone numbers must survive intact)', () => {
  const rows = [
    ['id', 'active'],
    ['0042', 'true'],
  ];
  const [record] = csvRowsToJsonRecords(rows);
  assert.equal(record.id, '0042');
  assert.equal(typeof record.id, 'string');
  assert.equal(record.active, 'true');
  assert.equal(typeof record.active, 'string');
});

test('csvRowsToJsonRecords: a blank header cell becomes "column_N" by position', () => {
  const rows = [
    ['name', '', 'price'],
    ['Coffee', 'note', '4.5'],
  ];
  const [record] = csvRowsToJsonRecords(rows);
  assert.deepEqual(Object.keys(record), ['name', 'column_2', 'price']);
});

test('csvRowsToJsonRecords: a repeated header name gets de-duplicated with a trailing _2, _3', () => {
  const rows = [
    ['name', 'name', 'name'],
    ['a', 'b', 'c'],
  ];
  const [record] = csvRowsToJsonRecords(rows);
  assert.deepEqual(record, { name: 'a', name_2: 'b', name_3: 'c' });
});

test('csvRowsToJsonRecords: a literal header value colliding with a generated dedup suffix does not silently clobber the earlier duplicate\'s column', () => {
  // ["a", "a", "a_2"]: a naive per-base counter assigns "a" then "a_2" for
  // the first duplicate, then independently starts counting "a_2"
  // occurrences from scratch for the third column -- also landing on
  // "a_2" -- so the second column's data is silently overwritten by the
  // third. Every key must be checked against the full set of
  // already-assigned output keys, not just its own base's counter.
  const rows = [
    ['a', 'a', 'a_2'],
    ['first', 'second', 'third'],
  ];
  const [record] = csvRowsToJsonRecords(rows);
  assert.deepEqual(Object.keys(record), ['a', 'a_2', 'a_2_2']);
  assert.deepEqual(record, { a: 'first', a_2: 'second', a_2_2: 'third' });
});

test('csvRowsToJsonRecords: a row shorter than the header fills missing trailing fields with an empty string', () => {
  const rows = [
    ['name', 'price', 'category'],
    ['Coffee', '4.5'],
  ];
  assert.deepEqual(csvRowsToJsonRecords(rows), [
    { name: 'Coffee', price: '4.5', category: '' },
  ]);
});

test('csvRowsToJsonRecords: a row longer than the header drops the extra trailing fields', () => {
  const rows = [
    ['name', 'price'],
    ['Coffee', '4.5', 'unexpected-extra'],
  ];
  assert.deepEqual(csvRowsToJsonRecords(rows), [
    { name: 'Coffee', price: '4.5' },
  ]);
});
