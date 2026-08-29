/**
 * The json-diff example panel. Renders the tool's OWN pure module
 * (jsonDiff.mjs) run on a tiny fixture, using the same classes/attributes
 * the real client (src/browser/jsonDiff.client.js) emits, so this panel
 * inherits the site's existing diff CSS with zero new rules and cannot
 * drift from what the live tool actually produces -- see
 * src/examples/index.mjs for the full rationale.
 *
 * Same fixture the client's own default textarea state uses
 * (src/browser/jsonDiff.client.js's DEFAULT_JSON_A/DEFAULT_JSON_B), so a
 * first-time visitor sees the identical example both here and live -- same
 * convention as src/examples/text-diff.mjs.
 *
 * Do not change the fixture without also updating test/examples.test.mjs's
 * literal stats assertion, which exists precisely so a change to the diff
 * algorithm breaks this test rather than silently shipping a wrong picture.
 */

import { diffJsonValues, diffStats } from '../pure/jsonDiff.mjs';

export const slug = 'json-diff';

export const ariaLabel = 'Example comparison of two JSON objects showing one changed key, one added array element, and unchanged siblings, with key order ignored';

export const note = 'One field changed, one array element added, one nested field unchanged - a small sample of every status this tool reports. The "meta" and "user" keys swap position between the fixture’s original and changed values and still compare as identical.';

export const FIXTURE_JSON_A = {
  user: {
    id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer'],
  },
  meta: { page: 1 },
};
export const FIXTURE_JSON_B = {
  meta: { page: 2 },
  user: {
    id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer', 'reviewer'],
  },
};

/**
 * @returns {ReturnType<typeof diffJsonValues>} the real diff of the
 *   fixture above -- exported separately from render() so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders, not a re-derived copy.
 */
export function diffFixture() {
  return diffJsonValues(FIXTURE_JSON_A, FIXTURE_JSON_B);
}

/** Mirrors src/browser/jsonDiff.client.js's own literalText() exactly,
 * including the try/catch -- see that function's own comment for why a
 * pathologically deep depthLimited/type-mismatch node's raw value can
 * still overflow JSON.stringify's own (higher, but finite) recursion
 * limit even past this module's own diff-time depth cap. */
function literalText(value) {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch (err) {
    return '"(too deeply nested to display)"';
  }
}

/**
 * Mirrors src/browser/jsonDiff.client.js's flattenNode() exactly, but
 * appends to an HTML-string accumulator instead of a DOM tree.
 */
function flattenNodeHtml(keyLabel, node, depth, isLast, escapeHtml, out) {
  const comma = isLast ? '' : ',';
  const indent = '  '.repeat(depth);
  if (node.kind === 'primitive') {
    if (node.status === 'changed') {
      out.push(`<span class="json-diff-line" data-status="removed">${indent}${escapeHtml(keyLabel + literalText(node.a) + comma)}</span>`);
      out.push(`<span class="json-diff-line" data-status="added">${indent}${escapeHtml(keyLabel + literalText(node.b) + comma)}</span>`);
    } else {
      const value = node.status === 'removed' ? node.a : node.b;
      out.push(`<span class="json-diff-line" data-status="${node.status}">${indent}${escapeHtml(keyLabel + literalText(value) + comma)}</span>`);
    }
    return;
  }
  const openChar = node.kind === 'array' ? '[' : '{';
  const closeChar = node.kind === 'array' ? ']' : '}';
  const ownLineStatus = node.status === 'added' || node.status === 'removed' ? node.status : 'unchanged';
  out.push(`<span class="json-diff-line" data-status="${ownLineStatus}">${indent}${escapeHtml(keyLabel + openChar)}</span>`);
  node.children.forEach(({ key, node: child }, i) => {
    const childKeyLabel = node.kind === 'array' ? '' : `${JSON.stringify(String(key))}: `;
    flattenNodeHtml(childKeyLabel, child, depth + 1, i === node.children.length - 1, escapeHtml, out);
  });
  out.push(`<span class="json-diff-line" data-status="${ownLineStatus}">${indent}${escapeHtml(closeChar + comma)}</span>`);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} a <pre class="json-diff-tree"> matching
 *   jsonDiff.client.js's renderTree() markup line for line.
 */
export function render(escapeHtml) {
  const node = diffFixture();
  const stats = diffStats(node);
  const lines = [];
  flattenNodeHtml('', node, 0, true, escapeHtml, lines);
  // No separator between lines -- .json-diff-line is display:block
  // (src/css.js), which already forces one line per span; see
  // jsonDiff.client.js's own renderTree() comment for why a literal "\n"
  // between them (preserved verbatim by this <pre>'s white-space:pre)
  // would double every line gap.
  return `<p class="page-badge">${stats.changed} changed &middot; ${stats.added} added &middot; ${stats.removed} removed &middot; ${stats.unchanged} unchanged</p>`
    + `<pre class="json-diff-tree">${lines.join('')}</pre>`;
}
