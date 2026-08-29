/**
 * The Image Resize/Compress example panel -- Pattern D ("page-strip"), the
 * same abstract before/after diagram jpg-png-to-pdf.mjs uses: resizing a
 * real decoded photo produces pixel bytes, not textual data a pure module
 * can render as a table at build time, so this stays a drawn photo() glyph
 * (src/pageStripDiagrams.mjs -- the same "standard image-placeholder"
 * sun-and-mountains shape src/icons.js's own `image` family plate motif
 * draws) rather than a real rendered photo. The DIMENSIONS captioned below
 * the diagram are real, though -- computed by the same pure aspect-ratio
 * math the live tool uses (../pure/imageResizeCompress.mjs's
 * lockedCounterpart), not hand-typed, so a future change to that math
 * would make this caption wrong in a way test/examples.test.mjs can catch.
 */

import {
  photo, arrow, svg,
} from '../pageStripDiagrams.mjs';
import { lockedCounterpart } from '../pure/imageResizeCompress.mjs';

export const slug = 'image-resize-compress';

export const ariaLabel = 'A 4000 by 3000 photo resized down to 1200 by 900, keeping the same proportions';

export const FIXTURE_SRC_WIDTH = 4000;
export const FIXTURE_SRC_HEIGHT = 3000;
export const FIXTURE_TARGET_WIDTH = 1200;

/**
 * @returns {number} the real computed height for FIXTURE_TARGET_WIDTH at
 *   the source's own aspect ratio -- exported so
 *   test/examples.test.mjs can assert the caption below matches this exact
 *   value, not a copy of it.
 */
export function fixtureTargetHeight() {
  return lockedCounterpart(FIXTURE_SRC_WIDTH, FIXTURE_SRC_HEIGHT, FIXTURE_TARGET_WIDTH, 'width');
}

export const note = `A ${FIXTURE_SRC_WIDTH.toLocaleString()}×${FIXTURE_SRC_HEIGHT.toLocaleString()} photo resized to ${FIXTURE_TARGET_WIDTH.toLocaleString()}×${fixtureTargetHeight().toLocaleString()} - the same 4:3 proportions, computed live from your own image.`;

export function render() {
  // Before glyph drawn at the source's own real aspect ratio (68 wide);
  // after glyph's own height is derived from the SAME real
  // lockedCounterpart() computation the live tool uses, at a smaller width
  // (40), not a hand-typed number -- the shrink shown is the real ratio,
  // not an arbitrary decoration.
  const beforeW = 68;
  const beforeH = Math.round(beforeW * (FIXTURE_SRC_HEIGHT / FIXTURE_SRC_WIDTH));
  const afterW = 40;
  const afterH = Math.round(afterW * (fixtureTargetHeight() / FIXTURE_TARGET_WIDTH));
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${photo(30, 30, { w: beforeW, h: beforeH })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    ${photo(300, 40, { w: afterW, h: afterH, extraClass: 'td-accent' })}
  `;
  return svg(inner, ariaLabel);
}
