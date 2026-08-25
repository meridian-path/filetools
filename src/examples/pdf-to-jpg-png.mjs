/**
 * The pdf-to-jpg-png example panel -- Pattern D ("page-strip"). Page
 * rasterization produces no textual result a pure module can compute at
 * build time (the output is image bytes, not data), so this stays an
 * abstract before/after SVG -- see src/examples/merge-pdf.mjs's header
 * comment for the same reasoning, and src/pageStripDiagrams.mjs for the
 * shared drawing primitives (photo(), shared with the other two new
 * image<->PDF tools in this batch).
 */

import { photo, page, arrow, svg } from '../pageStripDiagrams.mjs';

export const slug = 'pdf-to-jpg-png';

export const ariaLabel = 'One PDF becoming a separate JPG or PNG image per page';

export const note = 'Every page renders as its own image, zipped together in one download.';

export function render() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${page(52, 34, { extraClass: 'td-accent' })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    ${photo(300, 34)}${photo(340, 34, { extraClass: 'td-accent' })}
  `;
  return svg(inner, ariaLabel);
}
