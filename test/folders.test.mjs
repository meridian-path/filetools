import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, CATEGORY_LABELS } from '../src/tools/index.js';
import {
  FOLDERS, FOLDER_BY_KEY, DEFAULT_FOLDER, folderOf, toolsInFolder,
} from '../src/folders.js';

/**
 * Regression coverage for the display-taxonomy layer the site-wide
 * navigation/IA redesign introduces -- mirrors
 * test/families.test.mjs's own shape and reasoning for the same class of
 * bug: a tool merging with no explicit folder row would otherwise fall
 * back silently to DEFAULT_FOLDER forever, which is correct as a
 * never-breaks-the-build safety net but must never be quietly relied on
 * for a real, shipped tool.
 */

test('every tool in the TOOLS registry has an explicit, non-empty folder field', () => {
  // Checked against each tool's own raw `folder` field directly (not via
  // folderOf()), since folderOf()'s fallback to DEFAULT_FOLDER would
  // otherwise make a genuinely-missing field indistinguishable from a
  // tool explicitly assigned to 'developer' (DEFAULT_FOLDER's own value).
  const missing = TOOLS.filter((t) => typeof t.folder !== 'string' || t.folder === '').map((t) => t.slug);
  assert.deepEqual(missing, [], `slugs missing an explicit folder field: ${missing.join(', ')}`);
});

test('every tool\'s folder value is a real key in FOLDERS', () => {
  const validKeys = new Set(FOLDERS.map((f) => f.key));
  const invalid = TOOLS.filter((t) => !validKeys.has(t.folder)).map((t) => `${t.slug} -> "${t.folder}"`);
  assert.deepEqual(invalid, [], `slugs with an unknown folder key: ${invalid.join(', ')}`);
});

test('folder slugs are unique, and "data" is forbidden as a folder slug (it is the overloaded URL category this taxonomy replaces for display)', () => {
  const slugs = FOLDERS.map((f) => f.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate folder slugs found');
  assert.ok(!slugs.includes('data'), '"data" must never be a folder slug -- it is reserved for the noindex /data/ helper page');
});

test('a folder slug equal to an existing URL category prefix is allowed (folder "pdf" intentionally reuses the "pdf" category prefix as its own index page)', () => {
  const pdfFolder = FOLDERS.find((f) => f.key === 'pdf');
  assert.equal(pdfFolder.slug, 'pdf');
  assert.ok(Object.keys(CATEGORY_LABELS).includes('pdf'));
});

test('every FOLDERS entry has at least one tool assigned to it', () => {
  const empty = FOLDERS.filter((f) => toolsInFolder(f.key).length === 0).map((f) => f.key);
  assert.deepEqual(empty, [], `folders with zero tools: ${empty.join(', ')}`);
});

test('folderOf() falls back to DEFAULT_FOLDER for an unrecognized slug, never throws', () => {
  assert.equal(folderOf('not-a-real-tool'), DEFAULT_FOLDER);
  assert.equal(folderOf(''), DEFAULT_FOLDER);
  assert.equal(folderOf(undefined), DEFAULT_FOLDER);
});

test('FOLDER_BY_KEY resolves every FOLDERS entry by its own key', () => {
  for (const f of FOLDERS) {
    assert.equal(FOLDER_BY_KEY[f.key], f);
  }
});

test('the taxonomy is exactly the spec\'s 6-folder, 42-slug assignment (folder taxonomy/nav spec section 1.1, extended by the 2026-08-29 image family/folder addition)', () => {
  const byFolder = {};
  for (const f of FOLDERS) byFolder[f.key] = toolsInFolder(f.key).map((t) => t.slug).sort();
  assert.deepEqual(byFolder, {
    pdf: ['bank-statement-to-csv', 'extract-images-from-pdf', 'jpg-png-to-pdf', 'merge-pdf', 'pdf-to-csv', 'pdf-to-jpg-png', 'rotate-pdf', 'split-pdf'].sort(),
    spreadsheets: ['compare-csv', 'csv-to-json', 'csv-to-sql-insert', 'csv-to-xlsx', 'html-table-to-csv', 'merge-csv', 'split-csv', 'transpose-csv', 'xlsx-to-csv', 'xlsx-to-json'].sort(),
    'data-formats': ['flatten-json', 'json-diff', 'json-minify-beautify', 'json-to-csv', 'json-to-yaml', 'xml-to-json', 'yaml-to-json'].sort(),
    text: ['remove-duplicate-lines', 'sort-lines', 'text-case-converter', 'text-diff', 'word-frequency-counter', 'word-character-counter'].sort(),
    developer: ['base64-encode-decode', 'hash-generator', 'heic-to-jpg-png', 'html-entity-encode-decode', 'regex-tester', 'sql-formatter', 'url-encode-decode', 'uuid-generator', 'unix-timestamp-converter', 'qr-code-generator'].sort(),
    image: ['image-resize-compress'],
  });
});

test('FOLDERS is exactly the spec\'s ordered 6-folder registry, no more, no fewer', () => {
  assert.deepEqual(FOLDERS.map((f) => f.key), ['pdf', 'spreadsheets', 'data-formats', 'text', 'developer', 'image']);
  for (const f of FOLDERS) {
    assert.equal(typeof f.slug, 'string');
    assert.equal(typeof f.label, 'string');
    assert.equal(typeof f.familyKey, 'string');
    assert.equal(typeof f.description, 'string');
  }
});
