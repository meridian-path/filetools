/**
 * The QR Code Generator example panel. Renders a REAL QR code -- computed
 * at build time by the same vendored `qrcode-generator` library the live
 * client uses (imported here from node_modules directly, the same way
 * src/examples/yaml-to-json.mjs imports js-yaml directly rather than via
 * the vendor/ copy that's only for the browser) -- as real inline SVG
 * markup, so this panel can never drift from what the live tool actually
 * produces. See src/examples/index.mjs for why a real computed result
 * beats a hand-drawn mock.
 *
 * Do not change the fixture without also updating test/examples.test.mjs's
 * literal module-count assertion, which exists precisely so a change to
 * the QR encoding breaks this test rather than silently shipping a wrong
 * picture.
 */

import qrcodeFactory from 'qrcode-generator';
import { stringToUtf8Bytes } from '../pure/qrCodeGenerator.mjs';

export const slug = 'qr-code-generator';

export const ariaLabel = 'Example QR code encoding the URL https://example.com';

export const note = 'A real QR code for a short URL, at Medium error correction - the same result this tool produces live.';

export const FIXTURE_TEXT = 'https://example.com';
export const FIXTURE_ERROR_CORRECTION_LEVEL = 'M';

/**
 * @returns {object} the real qrcode-generator instance for the fixture
 *   above, already made() -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function qrFixture() {
  qrcodeFactory.stringToBytes = stringToUtf8Bytes;
  const qr = qrcodeFactory(0, FIXTURE_ERROR_CORRECTION_LEVEL);
  qr.addData(FIXTURE_TEXT, 'Byte');
  qr.make();
  return qr;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} the real SVG markup for the fixture, plus a caption
 *   naming what it encodes.
 */
export function render(escapeHtml) {
  const qr = qrFixture();
  const svg = qr.createSvgTag({ scalable: true });
  return `<div class="qr-example-figure">${svg}</div>
<p class="caption qr-example-caption">Encoding: ${escapeHtml(FIXTURE_TEXT)}</p>`;
}
