/**
 * The text-diff example panel. Renders the tool's OWN pure module
 * (textDiff.mjs) run on a tiny fixture, using the exact classes/attributes
 * the real client (src/browser/textDiff.client.js) emits, so this panel
 * inherits the site's existing diff CSS with zero new rules and is provably
 * identical in appearance to the live result -- see src/examples/index.mjs
 * for why this beats a hand-drawn mock (it cannot drift from reality).
 *
 * Same fixture the client's own default textarea state uses
 * (src/browser/textDiff.client.js's DEFAULT_TEXT_A/DEFAULT_TEXT_B), so a
 * first-time visitor sees the identical example both here and live -- same
 * convention as src/examples/regex-tester.mjs.
 *
 * Do not change the fixture without also updating test/examples.test.mjs's
 * literal status assertions, which exist precisely so a change to the diff
 * algorithm breaks this test rather than silently shipping a wrong picture.
 */

import { diffText } from '../pure/textDiff.mjs';

export const slug = 'text-diff';

export const ariaLabel = 'Example comparison of two short paragraphs showing a changed word, an unchanged line, a removed line, and an added line';

export const note = 'One word changed, one line removed and replaced, two lines unchanged - a small sample of every status this tool reports.';

export const FIXTURE_TEXT_A = 'The quick brown fox jumps over the lazy dog.\nThis line stays the same.\nThis line will be removed.\nA shared line at the end.';
export const FIXTURE_TEXT_B = 'The quick brown fox leaps over the lazy dog.\nThis line stays the same.\nA brand new line goes here.\nA shared line at the end.';

/**
 * @returns {ReturnType<typeof diffText>} the real diff of the fixture above
 *   -- exported separately from render() so test/examples.test.mjs can
 *   assert against the exact same computed result the page renders, not a
 *   re-derived copy.
 */
export function diffFixture() {
  return diffText(FIXTURE_TEXT_A, FIXTURE_TEXT_B);
}

/**
 * Mirrors src/browser/textDiff.client.js's buildWordDiffFragment(), but
 * emits an HTML string instead of DOM nodes.
 */
function wordDiffHtml(wordOps, side, escapeHtml) {
  const keepType = side === 'a' ? 'delete' : 'insert';
  const markClass = side === 'a' ? 'text-diff-del' : 'text-diff-ins';
  return wordOps
    .filter((op) => op.type === 'equal' || op.type === keepType)
    .map((op) => (op.type === 'equal' ? escapeHtml(op.text) : `<mark class="${markClass}">${escapeHtml(op.text)}</mark>`))
    .join('');
}

/** Mirrors src/browser/textDiff.client.js's buildCell() exactly. */
function cellHtml(text, lineNo, status, wordOps, side, escapeHtml) {
  const lineNumHtml = lineNo !== null ? `<span class="text-diff-linenum">${lineNo}</span>` : '';
  let contentHtml;
  if (status === 'changed' && wordOps) contentHtml = wordDiffHtml(wordOps, side, escapeHtml);
  else if (text !== null) contentHtml = escapeHtml(text.length ? text : ' ');
  else contentHtml = '';
  return `<div class="text-diff-cell text-diff-cell--${side}" data-diff-status="${status}">${lineNumHtml}<span class="text-diff-text">${contentHtml}</span></div>`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} a <div class="text-diff-grid"> matching
 *   textDiff.client.js's render() markup cell for cell (Original/Changed
 *   header cells, then one row-pair per diff row with the same
 *   data-diff-status/word-diff-mark treatment).
 */
export function render(escapeHtml) {
  const outcome = diffFixture();

  const headerCells = `<div class="text-diff-cell text-diff-cell--a text-diff-header">Original</div><div class="text-diff-cell text-diff-cell--b text-diff-header">Changed</div>`;

  const rowCells = outcome.rows.map((r) => {
    if (r.status === 'unchanged') {
      return cellHtml(r.a, r.aLine, 'unchanged', undefined, 'a', escapeHtml)
        + cellHtml(r.b, r.bLine, 'unchanged', undefined, 'b', escapeHtml);
    }
    if (r.status === 'removed') {
      return cellHtml(r.a, r.aLine, 'removed', undefined, 'a', escapeHtml)
        + cellHtml(null, null, 'empty', undefined, 'b', escapeHtml);
    }
    if (r.status === 'added') {
      return cellHtml(null, null, 'empty', undefined, 'a', escapeHtml)
        + cellHtml(r.b, r.bLine, 'added', undefined, 'b', escapeHtml);
    }
    return cellHtml(r.a, r.aLine, 'changed', r.wordOps, 'a', escapeHtml)
      + cellHtml(r.b, r.bLine, 'changed', r.wordOps, 'b', escapeHtml);
  }).join('');

  return `<div class="text-diff-grid">${headerCells}${rowCells}</div>`;
}
