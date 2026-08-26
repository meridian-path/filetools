import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToolPage } from '../src/pages/toolPage.js';
import { toolBySlug } from '../src/tools/index.js';
import { realPageJsWeightKbLabel } from '../src/jsWeight.js';

/**
 * Regression test for the craft-retrofit "speed as a feature" addition
 * (src/jsWeight.js, wired into src/pages/toolPage.js): a tool page in a
 * folder that has had its own Phase-3 pass must state its real computed JS
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

test('a tool in a folder with no Phase-3 pass yet is unchanged -- no JS-weight sentence at all', () => {
  const tool = toolBySlug('merge-pdf');
  const html = renderToolPage(tool);
  assert.ok(!html.includes('This page loads'), 'the JS-weight sentence should only render for a folder that has had its own Phase-3 pass');
});
