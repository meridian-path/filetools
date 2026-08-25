/**
 * The jpg-png-to-pdf example panel -- Pattern D ("page-strip"). Image-to-
 * PDF embedding produces no textual result a pure module can compute at
 * build time (the output is page bytes, not data), so this stays an
 * abstract before/after SVG rather than a real computed table -- see
 * src/examples/merge-pdf.mjs's header comment for the same reasoning, and
 * src/pageStripDiagrams.mjs for the shared drawing primitives (including
 * photo(), added alongside this file for the three new image<->PDF tools
 * in this same batch).
 */

import { photo, page, arrow, svg, STROKE } from '../pageStripDiagrams.mjs';

export const slug = 'jpg-png-to-pdf';

export const ariaLabel = 'Two separate JPG/PNG images becoming pages of one PDF';

export const note = 'Two or more images become the pages of one PDF, in the order you set. Nothing is re-compressed.';

export function render() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${photo(30, 34)}${photo(70, 34, { extraClass: 'td-accent' })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    ${page(300, 34, { extraClass: 'td-accent' })}
    <path d="M334 34v46" ${STROKE} stroke-dasharray="2 3" opacity="0.5"/>
    ${page(336, 34, { extraClass: 'td-accent' })}
  `;
  return svg(inner, ariaLabel);
}
