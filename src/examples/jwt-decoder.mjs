/**
 * The jwt-decoder example panel -- Pattern C ("code-to-code": an input code
 * block plus the real result rendered as a second code block), same shape
 * as src/examples/unix-timestamp-converter.mjs. Runs the tool's own pure
 * module (jwtDecode.mjs) on a fixed, already-expired sample token at build
 * time and renders the real result, so this panel can never drift from what
 * the live tool actually does, and honestly shows the expired-claim feature
 * (per this tool's own content-depth requirement) rather than a token with
 * nothing interesting to report.
 *
 * The fixture token is built by hand from its own three base64url segments
 * below (not generated via decodeJwt or any encoder), so nothing here
 * depends on the code under test to produce its own input.
 */

import { decodeJwt } from '../pure/jwtDecode.mjs';

export const slug = 'jwt-decoder';

export const ariaLabel = 'Example decoding of a JWT into its header, payload, and an expired "exp" claim';

export const note = 'The real decoded header and payload for this exact token, computed the same way the live tool decodes yours - including the "exp" claim, which this one has already passed.';

// header {"alg":"HS256","typ":"JWT"}, payload {"sub":"user-42","name":"Ada
// Lovelace","exp":1704067200} (2024-01-01T00:00:00Z, long since expired
// relative to any real viewing of this page) - a placeholder signature
// segment, since decodeJwt() never checks it either way.
export const FIXTURE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQyIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImV4cCI6MTcwNDA2NzIwMH0.c2lnbmF0dXJlLW5vdC12ZXJpZmllZA';

/**
 * @returns {ReturnType<typeof decodeJwt>} the real decode of the fixture
 *   above -- exported separately from render() so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders.
 */
export function decodeFixture() {
  return decodeJwt(FIXTURE_JWT);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw token, then an
 *   "Output" <pre><code> with the real decoded header, payload, and time
 *   claim.
 */
export function render(escapeHtml) {
  const result = decodeFixture();
  const claimLines = result.timeClaims.map((c) => `${c.label} (${c.key}): ${c.iso} - ${c.isPast ? 'expired' : 'not yet expired'}`);
  const outputText = [
    `Header:  ${JSON.stringify(result.header)}`,
    `Payload: ${JSON.stringify(result.payload)}`,
    ...claimLines,
  ].join('\n');

  return `<p class="caption">Input (a JWT)</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_JWT)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(outputText)}</code></pre>`;
}
