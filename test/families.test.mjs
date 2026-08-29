import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../src/tools/index.js';
import { FAMILY_BY_SLUG, familyOf, DEFAULT_FAMILY } from '../src/families.js';

/**
 * Regression test for the pre-existing bug the design review found: 8 of
 * 17 tools silently fell back to a generic icon because no per-tool
 * family/color axis existed at all. familyOf() has a fallback so an
 * unrecognized slug can never break the build, but that fallback must
 * never be silently relied on for a real, shipped registry entry -- this
 * test is what makes a missing row loud instead of invisible.
 */

// 'dev' added by the craft-audit fix (site-audit task, item 7): genuine
// developer-utility tools (folders.js's 'developer' folder) get their own
// family now, distinct from plain-text tools -- see regex-tester.js's own
// comment on its `family` field for the full rationale.
const VALID_FAMILIES = new Set(['pdf', 'csv', 'json', 'sheet', 'text', 'dev']);

test('every tool in the TOOLS registry has an explicit FAMILY_BY_SLUG entry', () => {
  const missing = TOOLS.map((t) => t.slug).filter((slug) => !(slug in FAMILY_BY_SLUG));
  assert.deepEqual(missing, [], `slugs missing an explicit family: ${missing.join(', ')}`);
});

test('every FAMILY_BY_SLUG value is one of the six known families', () => {
  for (const [slug, family] of Object.entries(FAMILY_BY_SLUG)) {
    assert.ok(VALID_FAMILIES.has(family), `${slug} maps to unknown family "${family}"`);
  }
});

test('familyOf() returns the exact registered family for every real tool slug', () => {
  for (const tool of TOOLS) {
    assert.equal(familyOf(tool.slug), FAMILY_BY_SLUG[tool.slug]);
  }
});

test('familyOf() falls back to the default family for an unrecognized slug, never throws', () => {
  assert.equal(familyOf('not-a-real-tool'), DEFAULT_FAMILY);
  assert.equal(familyOf(''), DEFAULT_FAMILY);
  assert.equal(familyOf(undefined), DEFAULT_FAMILY);
});

test('the taxonomy is exactly the spec\'s 6-family (5 format families + \'dev\'), 39-slug assignment', () => {
  assert.deepEqual(FAMILY_BY_SLUG, {
    'merge-pdf': 'pdf',
    'split-pdf': 'pdf',
    'rotate-pdf': 'pdf',
    'pdf-to-csv': 'pdf',
    'bank-statement-to-csv': 'pdf',
    'jpg-png-to-pdf': 'pdf',
    'pdf-to-jpg-png': 'pdf',
    'extract-images-from-pdf': 'pdf',

    'merge-csv': 'csv',
    'compare-csv': 'csv',
    'split-csv': 'csv',
    'transpose-csv': 'csv',
    'html-table-to-csv': 'csv',
    'csv-to-sql-insert': 'csv',
    'csv-to-xlsx': 'csv',
    'csv-to-json': 'csv',

    'json-to-csv': 'json',
    'flatten-json': 'json',
    'json-minify-beautify': 'json',
    'yaml-to-json': 'json',
    'json-to-yaml': 'json',
    'xml-to-json': 'json',

    'xlsx-to-csv': 'sheet',
    'xlsx-to-json': 'sheet',

    'remove-duplicate-lines': 'text',
    'sort-lines': 'text',
    'word-frequency-counter': 'text',
    'text-case-converter': 'text',
    'word-character-counter': 'text',
    'text-diff': 'text',

    // 'dev' -- genuine developer-utility tools (folders.js's 'developer'
    // folder), craft-audit fix item 7. Distinct from the genuine
    // plain-text tools above.
    'url-encode-decode': 'dev',
    'base64-encode-decode': 'dev',
    'html-entity-encode-decode': 'dev',
    'hash-generator': 'dev',
    'uuid-generator': 'dev',
    'regex-tester': 'dev',
    'sql-formatter': 'dev',
    'heic-to-jpg-png': 'dev',
    'unix-timestamp-converter': 'dev',
  });
});
