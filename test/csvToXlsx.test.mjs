import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvInput, isNumericColumn, detectNumericColumns } from '../src/pure/csvToXlsx.mjs';

// -- parseCsv / parseCsvInput --------------------------------------------------

test('parseCsv: a simple header + rows', () => {
  assert.deepEqual(parseCsv('name,price\nCoffee,4.5\n'), [['name', 'price'], ['Coffee', '4.5']]);
});

test('parseCsvInput: empty input is a friendly error', () => {
  assert.equal(parseCsvInput('').ok, false);
  assert.equal(parseCsvInput('   ').ok, false);
});

test('parseCsvInput: a valid CSV returns ok:true and the parsed rows', () => {
  const result = parseCsvInput('a,b\n1,2\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows, [['a', 'b'], ['1', '2']]);
});

// -- isNumericColumn ------------------------------------------------------------

test('isNumericColumn: true when every value is a plain integer or decimal', () => {
  assert.equal(isNumericColumn(['1', '2', '3.5', '-4']), true);
});

test('isNumericColumn: false when a single value is a leading-zero code, not a real number', () => {
  assert.equal(isNumericColumn(['1', '0042', '3']), false);
});

test('isNumericColumn: false when a single value is free text', () => {
  assert.equal(isNumericColumn(['1', 'N/A', '3']), false);
});

test('isNumericColumn: empty values are skipped, not counted against numeric-ness', () => {
  assert.equal(isNumericColumn(['1', '', '3']), true);
});

test('isNumericColumn: an all-empty column is not numeric', () => {
  assert.equal(isNumericColumn(['', '', '']), false);
});

test('isNumericColumn: a bare "0" and a leading-zero decimal like "0.5" are both real numbers', () => {
  assert.equal(isNumericColumn(['0', '0.5']), true);
});

// -- detectNumericColumns --------------------------------------------------------

test('detectNumericColumns: flags each column independently by position', () => {
  const rows = [
    ['id', 'name', 'price'],
    ['0042', 'Widget', '9.5'],
    ['0099', 'Gadget', '14'],
  ];
  assert.deepEqual(detectNumericColumns(rows), [false, false, true]);
});
