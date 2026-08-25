import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBatchStatus } from '../src/pure/batchProgress.mjs';

test('formatBatchStatus: "Converting" + "image" shape', () => {
  assert.equal(formatBatchStatus('Converting', 3, 12, 'image'), 'Converting image 3 of 12…');
});

test('formatBatchStatus: "Rendering" + "page" shape', () => {
  assert.equal(formatBatchStatus('Rendering', 47, 150, 'page'), 'Rendering page 47 of 150…');
});

test('formatBatchStatus: "Scanning" + "page" shape (extract-images-from-pdf\'s own verb)', () => {
  assert.equal(formatBatchStatus('Scanning', 1, 1, 'page'), 'Scanning page 1 of 1…');
});

test('formatBatchStatus: done can equal total (the final iteration, before the caller\'s own success message replaces it)', () => {
  assert.equal(formatBatchStatus('Converting', 12, 12, 'image'), 'Converting image 12 of 12…');
});
