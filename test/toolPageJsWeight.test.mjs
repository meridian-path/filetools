import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToolPage } from '../src/pages/toolPage.js';
import { toolBySlug } from '../src/tools/index.js';
import { realPageJsWeightKbLabel } from '../src/jsWeight.js';

/**
 * Regression test for the craft-retrofit Phase 3(a) "speed as a feature"
 * addition (src/jsWeight.js, wired into src/pages/toolPage.js): a
 * developer-folder tool's rendered page must state its real computed JS
 * weight, and that same figure must appear identically in both the visible
 * HTML and the FAQPage JSON-LD (the two are built from one `faqs` array
 * specifically so they can never drift apart -- this test would catch a
 * future edit that reintroduces a `tool.faqs` reference bypassing it).
 */

test('a developer-folder tool\'s rendered page states its real JS weight, identically in the visible FAQ and the JSON-LD', () => {
  const tool = toolBySlug('base64-encode-decode');
  const html = renderToolPage(tool);
  const label = realPageJsWeightKbLabel(tool);
  const expected = `This page loads ${label} of JavaScript, gzipped`;
  const visibleCount = html.split(expected).length - 1;
  assert.equal(visibleCount, 2, 'expected the sentence exactly twice: once in the rendered <p>, once in the FAQPage JSON-LD');
});

test('a custom-panel developer tool (no dropzone) still gets the real JS weight, using only its own client file(s)', () => {
  const tool = toolBySlug('uuid-generator');
  const html = renderToolPage(tool);
  const label = realPageJsWeightKbLabel(tool);
  assert.ok(html.includes(`This page loads ${label} of JavaScript, gzipped`));
});

test('a non-developer-folder tool\'s page is unchanged -- no JS-weight sentence at all', () => {
  const tool = toolBySlug('merge-pdf');
  const html = renderToolPage(tool);
  assert.ok(!html.includes('This page loads'), 'the JS-weight sentence should only render for folder === "developer"');
});
