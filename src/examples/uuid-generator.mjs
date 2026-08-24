/**
 * The uuid-generator example panel -- Pattern C ("code-to-code": an input
 * code block plus the real result rendered as a second code block), same
 * shape as src/examples/hash-generator.mjs. Uses v5 specifically (not v4/
 * v1/v7) because it's the one deterministic version -- the same namespace
 * and name always hash to the exact same UUID, so this is the only version
 * where "the real generated output" can be a fixed, checkable string
 * instead of a fresh random value on every build.
 *
 * Async at the module level (top-level await) for the same reason
 * src/examples/hash-generator.mjs is: generateV5() awaits
 * crypto.subtle.digest.
 */

import { NAMESPACES, generateV5 } from '../pure/uuidGenerator.mjs';

export const slug = 'uuid-generator';

export const ariaLabel = 'Example of a domain name hashed into a deterministic v5 UUID using the DNS namespace';

export const note = 'A v5 UUID: the DNS namespace plus this exact name always hashes to this exact UUID, on any machine.';

export const FIXTURE_NAMESPACE = NAMESPACES.dns;
export const FIXTURE_NAME = 'example.com';

const FIXTURE_UUID = await generateV5(FIXTURE_NAMESPACE, FIXTURE_NAME);

/**
 * @returns {string} the real computed v5 UUID for the fixture -- exported
 *   separately so test/examples.test.mjs can assert against the exact
 *   same computed result the page renders.
 */
export function generateFixture() {
  return FIXTURE_UUID;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the namespace + name, then an
 *   "Output" <pre><code> of the real generated v5 UUID.
 */
export function render(escapeHtml) {
  const inputText = `namespace: ${FIXTURE_NAMESPACE} (DNS)\nname: ${FIXTURE_NAME}`;

  return `<p class="caption">Input (v5)</p>
<pre class="json-preview"><code>${escapeHtml(inputText)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_UUID)}</code></pre>`;
}
