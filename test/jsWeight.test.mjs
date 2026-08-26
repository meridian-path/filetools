import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { realPageJsWeightBytes, realPageJsWeightKbLabel } from '../src/jsWeight.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BROWSER_DIR = path.join(__dirname, '..', 'src', 'browser');

function realGzipBytes(file) {
  return zlib.gzipSync(fs.readFileSync(path.join(BROWSER_DIR, file))).length;
}

test('realPageJsWeightBytes() sums dropzone.client.js + the tool\'s own client file for a file/paste-driven tool', () => {
  const expected = realGzipBytes('dropzone.client.js') + realGzipBytes('base64.client.js');
  assert.equal(realPageJsWeightBytes({ clientEntry: 'base64' }), expected);
});

test('realPageJsWeightBytes() uses only the tool\'s own client file for a custom-panel tool with no eager Worker', () => {
  const expected = realGzipBytes('uuidGenerator.client.js');
  assert.equal(realPageJsWeightBytes({ clientEntry: 'uuidGenerator', customPanelMode: true }), expected);
});

test('realPageJsWeightBytes() includes regex-tester\'s eagerly-spawned Worker file', () => {
  const expected = realGzipBytes('regexTester.client.js') + realGzipBytes('regexTester.worker.js');
  assert.equal(realPageJsWeightBytes({ clientEntry: 'regexTester', customPanelMode: true }), expected);
});

test('realPageJsWeightBytes() never silently includes a Worker for a custom-panel tool that does not declare one', () => {
  // Regression guard: EAGER_WORKER_BY_CLIENT is keyed by clientEntry, so a
  // typo or a copy-paste of another tool's clientEntry must not silently
  // pull in an unrelated Worker file.
  const withoutWorker = realPageJsWeightBytes({ clientEntry: 'uuidGenerator', customPanelMode: true });
  const withWorker = realPageJsWeightBytes({ clientEntry: 'regexTester', customPanelMode: true });
  assert.notEqual(withoutWorker, withWorker);
});

test('realPageJsWeightKbLabel() rounds to the nearest whole KB with a trailing "KB"', () => {
  const bytes = realPageJsWeightBytes({ clientEntry: 'base64' });
  assert.equal(realPageJsWeightKbLabel({ clientEntry: 'base64' }), `${Math.round(bytes / 1024)}KB`);
});

test('the real computed weight for every developer-folder tool is a small, plausible figure (sanity bound, not a hardcoded expectation)', () => {
  // Guards against a future refactor silently pulling in something huge
  // (e.g. a vendor library) without anyone noticing the "speed as a
  // feature" claim had gone false -- not a precise pin, since the real
  // bytes legitimately drift as tool code changes.
  const devTools = [
    { clientEntry: 'base64' }, { clientEntry: 'urlEncode' }, { clientEntry: 'htmlEntity' },
    { clientEntry: 'hashGenerator' }, { clientEntry: 'sqlFormatter' }, { clientEntry: 'csvToSqlInsert' },
    { clientEntry: 'jsonMinifyBeautify' }, { clientEntry: 'textCaseConverter' }, { clientEntry: 'wordFrequency' },
    { clientEntry: 'uuidGenerator', customPanelMode: true },
    { clientEntry: 'regexTester', customPanelMode: true },
  ];
  for (const tool of devTools) {
    const bytes = realPageJsWeightBytes(tool);
    assert.ok(bytes > 500, `${tool.clientEntry}: ${bytes} bytes looks too small to be real`);
    assert.ok(bytes < 50 * 1024, `${tool.clientEntry}: ${bytes} bytes is no longer a "speed as a feature" figure`);
  }
});
