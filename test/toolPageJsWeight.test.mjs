import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToolPage } from '../src/pages/toolPage.js';
import { toolBySlug, TOOLS } from '../src/tools/index.js';
import { realPageJsWeightKbLabel, realPageJsWeightBytes } from '../src/jsWeight.js';

/**
 * Regression test for the craft-retrofit "speed as a feature" addition
 * (src/jsWeight.js, wired into src/pages/toolPage.js): a tool page in a
 * folder that has had its own speed-feature rollout pass must state its real computed JS
 * weight, and that same figure must appear identically in both the visible
 * HTML and the FAQPage JSON-LD (the two are built from one `faqs` array
 * specifically so they can never drift apart -- this test would catch a
 * future edit that reintroduces a `tool.faqs` reference bypassing it).
 * Deliberately checks real tool slugs against their real, live `folder`
 * field rather than assuming a folder's membership -- see toolPage.js's
 * own comment on Phase 3(a)'s PR description naming 11 tools by folder
 * when only 7 actually lived there.
 */

function assertHasWeightSentence(slug) {
  const tool = toolBySlug(slug);
  const html = renderToolPage(tool);
  const label = realPageJsWeightKbLabel(tool);
  const expected = `This page loads ${label} of JavaScript, gzipped`;
  const visibleCount = html.split(expected).length - 1;
  assert.equal(visibleCount, 2, `${slug}: expected the sentence exactly twice (rendered <p> + FAQPage JSON-LD), got ${visibleCount}`);
}

test('a developer-folder tool\'s rendered page states its real JS weight, identically in the visible FAQ and the JSON-LD', () => {
  assertHasWeightSentence('base64-encode-decode');
});

test('a custom-panel developer tool (no dropzone) still gets the real JS weight, using only its own client file(s)', () => {
  const tool = toolBySlug('uuid-generator');
  const html = renderToolPage(tool);
  const label = realPageJsWeightKbLabel(tool);
  assert.ok(html.includes(`This page loads ${label} of JavaScript, gzipped`));
});

test('every data-formats-folder tool (Phase 3(b)) also states its real JS weight', () => {
  for (const slug of ['flatten-json', 'json-minify-beautify', 'json-to-csv', 'json-to-yaml', 'xml-to-json', 'yaml-to-json']) {
    assertHasWeightSentence(slug);
  }
});

test('every spreadsheets-folder tool (Phase 3(c)) also states its real JS weight, on its own real privacy FAQ wherever it falls in the list', () => {
  for (const slug of ['compare-csv', 'csv-to-json', 'csv-to-sql-insert', 'csv-to-xlsx', 'html-table-to-csv', 'merge-csv', 'split-csv', 'transpose-csv', 'xlsx-to-csv', 'xlsx-to-json']) {
    assertHasWeightSentence(slug);
  }
});

test('every pdf-folder tool (Phase 3(d)) also states its real JS weight, on its own real privacy FAQ wherever it falls in the list', () => {
  for (const slug of ['extract-images-from-pdf', 'jpg-png-to-pdf', 'merge-pdf', 'rotate-pdf', 'split-pdf', 'pdf-to-csv', 'pdf-to-jpg-png', 'bank-statement-to-csv']) {
    assertHasWeightSentence(slug);
  }
});

test('compare-csv\'s stated weight includes its always-loaded Pro-feature script, not just the free-tier client', () => {
  const tool = toolBySlug('compare-csv');
  const html = renderToolPage(tool);
  const label = realPageJsWeightKbLabel(tool);
  // Regression guard: if a future edit reads only dropzone.client.js +
  // csvDiff.client.js and forgets compareCsvPro.client.js (always fetched
  // per toolPage.js's own proFeatureHtml), the stated figure would
  // understate the real page weight -- assert it's not that smaller wrong
  // number.
  assert.ok(html.includes(`This page loads ${label} of JavaScript, gzipped`));
  const withoutProFeature = Math.round(realPageJsWeightBytes({ clientEntry: tool.clientEntry }) / 1024);
  assert.notEqual(label, `${withoutProFeature}KB`, 'the stated weight must not silently drop back to the pro-feature-excluded figure');
});

test('the JS-weight sentence lands on compare-csv\'s real "Is my data sent anywhere?" FAQ, not its first (functional) FAQ', () => {
  const tool = toolBySlug('compare-csv');
  const html = renderToolPage(tool);
  const firstQMatch = html.match(/<h3>([^<]*)<\/h3>/);
  assert.ok(firstQMatch && !/sent anywhere|upload/i.test(firstQMatch[1]), 'sanity: compare-csv\'s first FAQ should still be a functional question, not the privacy one');
  assert.ok(!html.includes(`What happens if the rows are in a different order in each file? This page loads`), 'the sentence must not have landed on the first (wrong) FAQ');
});

test('every text-folder tool (Phase 3(e), the last folder) also states its real JS weight', () => {
  for (const slug of ['remove-duplicate-lines', 'sort-lines', 'text-case-converter', 'word-frequency-counter']) {
    assertHasWeightSentence(slug);
  }
});

test('with all 5 folders now rolled out, every single tool on the site states its real JS weight', () => {
  // Phase 3(e) (text) was the last folder in the taxonomy -- SPEED_FEATURE_FOLDERS
  // now covers developer/data-formats/spreadsheets/pdf/text, i.e. every real
  // folder. This is the strongest version of the earlier per-folder tests:
  // it iterates the live TOOLS registry directly rather than a hand-copied
  // slug list, so it can never itself go stale the way a hardcoded list
  // would. If a 6th folder is ever added without extending
  // SPEED_FEATURE_FOLDERS, this is the test that catches it.
  for (const tool of TOOLS) {
    assertHasWeightSentence(tool.slug);
  }
});
