import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stemOf, pairFilesByStem, sheetNameFor, interpretLicenseResponse, neutralizeFormulaInjection } from '../src/pure/compareCsvPro.mjs';

test('stemOf: strips the last extension and lowercases for matching', () => {
  assert.equal(stemOf('Report.csv'), 'report');
  assert.equal(stemOf('report'), 'report');
  assert.equal(stemOf('report.2024.csv'), 'report.2024');
  assert.equal(stemOf('  Report.csv  '), 'report');
});

test('stemOf: a leading-dot dotfile with no other extension keeps its own name, not emptied', () => {
  assert.equal(stemOf('.gitignore'), '.gitignore');
});

test('pairFilesByStem: matches files with the same stem regardless of case/extension casing', () => {
  const { pairs, unmatchedA, unmatchedB } = pairFilesByStem(['Report.csv', 'other.csv'], ['report.CSV', 'unrelated.csv']);
  assert.deepEqual(pairs, [{ stem: 'report', nameA: 'Report.csv', nameB: 'report.CSV' }]);
  assert.deepEqual(unmatchedA, ['other.csv']);
  assert.deepEqual(unmatchedB, ['unrelated.csv']);
});

test('pairFilesByStem: preserves each batch\'s own original order in the unmatched lists', () => {
  const { unmatchedA, unmatchedB } = pairFilesByStem(['z.csv', 'a.csv'], ['y.csv', 'b.csv']);
  assert.deepEqual(unmatchedA, ['z.csv', 'a.csv']);
  assert.deepEqual(unmatchedB, ['y.csv', 'b.csv']);
});

test('pairFilesByStem: a duplicate stem within Batch B is matched only once, the rest stay unmatched', () => {
  const { pairs, unmatchedB } = pairFilesByStem(['report.csv'], ['report.csv', 'REPORT.CSV']);
  assert.equal(pairs.length, 1);
  assert.equal(unmatchedB.length, 1);
});

test('pairFilesByStem: no overlap at all reports everything unmatched, zero pairs', () => {
  const { pairs, unmatchedA, unmatchedB } = pairFilesByStem(['a.csv'], ['b.csv']);
  assert.deepEqual(pairs, []);
  assert.deepEqual(unmatchedA, ['a.csv']);
  assert.deepEqual(unmatchedB, ['b.csv']);
});

test('sheetNameFor: strips Excel-forbidden characters and caps at 31 characters', () => {
  const used = new Set();
  const name = sheetNameFor('report:jan/feb*2024?[final]', used);
  assert.ok(!/[:\\/?*[\]]/.test(name));
  assert.ok(name.length <= 31);
});

test('sheetNameFor: an empty/blank stem falls back to a real, non-empty sheet name', () => {
  const used = new Set();
  assert.equal(sheetNameFor('', used), 'Sheet');
  assert.equal(sheetNameFor('   ', used), 'Sheet');
});

test('sheetNameFor: two different stems that sanitize to the same 31-char prefix get distinct names, not a silent collision', () => {
  const used = new Set();
  const longStemA = `${'x'.repeat(40)}A`;
  const longStemB = `${'x'.repeat(40)}B`;
  const nameA = sheetNameFor(longStemA, used);
  used.add(nameA);
  const nameB = sheetNameFor(longStemB, used);
  assert.notEqual(nameA, nameB);
});

test('sheetNameFor: reusing the same stem twice produces two distinct sheet names', () => {
  const used = new Set();
  const first = sheetNameFor('report', used);
  used.add(first);
  const second = sheetNameFor('report', used);
  assert.notEqual(first, second);
});

test('interpretLicenseResponse: a real Gumroad success response is accepted', () => {
  assert.deepEqual(interpretLicenseResponse({ success: true, uses: 1, purchase: {} }), { ok: true });
});

test('interpretLicenseResponse: a real Gumroad failure response surfaces Gumroad\'s own message', () => {
  const result = interpretLicenseResponse({ success: false, message: 'That license does not exist for the provided product.' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'That license does not exist for the provided product.');
});

test('interpretLicenseResponse: a failure with no message string still gets an honest, non-crashing error', () => {
  const result = interpretLicenseResponse({ success: false });
  assert.equal(result.ok, false);
  assert.ok(result.error.length > 0);
});

test('interpretLicenseResponse: null/malformed input never throws, treated as a failed verification', () => {
  assert.equal(interpretLicenseResponse(null).ok, false);
  assert.equal(interpretLicenseResponse(undefined).ok, false);
  assert.equal(interpretLicenseResponse({}).ok, false);
  assert.equal(interpretLicenseResponse('not an object').ok, false);
});

test('neutralizeFormulaInjection: a real formula-injection payload gets a single-quote prefix, for every dangerous leading character', () => {
  assert.equal(neutralizeFormulaInjection('=1+1'), "'=1+1");
  assert.equal(neutralizeFormulaInjection('=cmd|\'/c calc\'!A1'), "'=cmd|'/c calc'!A1");
  assert.equal(neutralizeFormulaInjection('+1+1'), "'+1+1");
  assert.equal(neutralizeFormulaInjection('@SUM(1,1)'), "'@SUM(1,1)");
  assert.equal(neutralizeFormulaInjection('\tHYPERLINK'), "'\tHYPERLINK");
  assert.equal(neutralizeFormulaInjection('\rHYPERLINK'), "'\rHYPERLINK");
});

test('neutralizeFormulaInjection: ordinary values, including a real negative number, pass through unchanged', () => {
  assert.equal(neutralizeFormulaInjection('Rent'), 'Rent');
  assert.equal(neutralizeFormulaInjection('-42.50'), '-42.50');
  assert.equal(neutralizeFormulaInjection('-1,234.50'), '-1,234.50');
  assert.equal(neutralizeFormulaInjection(''), '');
  assert.equal(neutralizeFormulaInjection(null), '');
});

test('neutralizeFormulaInjection: a leading minus that is NOT a plain negative number is still neutralized', () => {
  assert.equal(neutralizeFormulaInjection('-cmd.exe'), "'-cmd.exe");
});
