/**
 * The extract-images-from-pdf example panel -- Pattern D ("page-strip").
 * Image extraction produces no textual result a pure module can compute
 * at build time (the output is image bytes, not data), so this stays an
 * abstract before/after SVG -- see src/examples/merge-pdf.mjs's header
 * comment for the same reasoning, and src/pageStripDiagrams.mjs for the
 * shared drawing primitives (page(), photo()).
 */

import { photo, page, arrow, svg } from '../pageStripDiagrams.mjs';

export const slug = 'extract-images-from-pdf';

export const ariaLabel = 'A photo embedded inside a PDF page becoming its own separate image file';

export const note = 'Every embedded image comes back as its own PNG file, zipped together in one download.';

export function render() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${page(40, 28, { w: 56, h: 62 })}
    ${photo(51, 42, { w: 34, h: 34, extraClass: 'td-accent' })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    ${photo(310, 34, { extraClass: 'td-accent' })}
  `;
  return svg(inner, ariaLabel);
}
