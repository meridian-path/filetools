/**
 * JWT (JSON Web Token) decoding -- pure logic for the "JWT decoder" tool.
 * DECODES, never VERIFIES: a JWT's header and payload segments are
 * base64url text with no secret involved at all (RFC 7519 section 3), so
 * reading them back needs no key - but the signature segment exists
 * specifically so a THIRD PARTY holding the right key can confirm the
 * token wasn't tampered with, which this tool has no way to do and does
 * not claim to. See this tool's own FAQ for why that distinction is
 * stated plainly rather than left implicit.
 *
 * Deliberately its own small base64url codec rather than importing
 * ../pure/base64.mjs's own (fuller, RFC-4648-general) one -- no pure
 * module in this directory imports another (see ../pure/csvDiff.mjs's own
 * header comment on this convention). A JWT segment is always UNPADDED
 * base64url per the spec itself (no trailing `=`), which is a strictly
 * simpler shape than base64.mjs's own general-purpose codec has to handle
 * (arbitrary padding, both alphabets) - reflecting that in a smaller,
 * JWT-specific decoder rather than pulling in machinery this format never
 * needs.
 */

const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REVERSE_MAP = new Map([...URL_SAFE_CHARS].map((c, i) => [c, i]));

/**
 * @param {string} segment
 * @returns {boolean} true if `segment` is non-empty, unpadded base64url
 *   text of a length base64 can actually produce (never 1 mod 4 - the one
 *   length no valid base64 grouping produces, since each group of up to 4
 *   characters encodes 1-3 whole bytes).
 */
function isValidBase64UrlSegment(segment) {
  if (segment.length === 0) return false;
  if (segment.length % 4 === 1) return false;
  return /^[A-Za-z0-9_-]+$/.test(segment);
}

/**
 * @param {string} segment already validated by isValidBase64UrlSegment.
 * @returns {Uint8Array}
 */
function base64UrlToBytes(segment) {
  const outLength = Math.floor((segment.length * 3) / 4);
  const bytes = new Uint8Array(outLength);
  let byteIndex = 0;
  let i = 0;
  for (; i + 4 <= segment.length; i += 4) {
    const a = REVERSE_MAP.get(segment[i]);
    const b = REVERSE_MAP.get(segment[i + 1]);
    const c = REVERSE_MAP.get(segment[i + 2]);
    const d = REVERSE_MAP.get(segment[i + 3]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
    bytes[byteIndex + 1] = ((b & 15) << 4) | (c >> 2);
    bytes[byteIndex + 2] = ((c & 3) << 6) | d;
    byteIndex += 3;
  }
  const remaining = segment.length - i;
  if (remaining === 2) {
    const a = REVERSE_MAP.get(segment[i]);
    const b = REVERSE_MAP.get(segment[i + 1]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
  } else if (remaining === 3) {
    const a = REVERSE_MAP.get(segment[i]);
    const b = REVERSE_MAP.get(segment[i + 1]);
    const c = REVERSE_MAP.get(segment[i + 2]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
    bytes[byteIndex + 1] = ((b & 15) << 4) | (c >> 2);
  }
  return bytes;
}

/**
 * @param {string} segment
 * @param {'header'|'payload'} label used only to name which segment failed
 *   in a friendly error message.
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
function decodeJsonSegment(segment, label) {
  if (!isValidBase64UrlSegment(segment)) {
    return { ok: false, error: `The ${label} segment isn’t valid base64url text.` };
  }
  const bytes = base64UrlToBytes(segment);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: `The ${label} segment doesn’t decode to valid UTF-8 text.` };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: `The ${label} segment decodes to text, but that text isn’t valid JSON.` };
  }
  return { ok: true, value };
}

/**
 * Standard NumericDate claims (RFC 7519 section 4.1) worth interpreting
 * for a visitor -- each is Unix SECONDS (not milliseconds), a common
 * source of off-by-1000x mistakes when hand-checking one.
 */
const TIME_CLAIMS = [
  { key: 'exp', label: 'Expires' },
  { key: 'nbf', label: 'Not valid before' },
  { key: 'iat', label: 'Issued at' },
];

/**
 * @param {*} payload the decoded payload value -- only inspected if it's a
 *   plain object; any other JSON value (a JWT payload is USUALLY an
 *   object, but the spec doesn't strictly forbid otherwise) simply yields
 *   no time claims, not an error.
 * @param {number} [now] Unix milliseconds to compare against -- defaults
 *   to the real current time; overridable so tests never depend on
 *   wall-clock timing.
 * @returns {Array<{key: string, label: string, raw: number, iso: string, isPast: boolean}>}
 *   one entry per standard time claim actually present as a finite number,
 *   in TIME_CLAIMS' own fixed order.
 */
export function interpretTimeClaims(payload, now = Date.now()) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const out = [];
  for (const { key, label } of TIME_CLAIMS) {
    const raw = payload[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const ms = raw * 1000;
    out.push({
      key, label, raw, iso: new Date(ms).toISOString(), isPast: ms <= now,
    });
  }
  return out;
}

/**
 * @param {string} token as pasted -- leading/trailing whitespace is
 *   trimmed (a common artifact of copy-pasting from a terminal or log
 *   line), internal whitespace is not (a real JWT never contains any, so
 *   internal whitespace is treated as part of the malformed input it is).
 * @param {number} [now] see interpretTimeClaims's own param.
 * @returns {{ok: true, header: object, payload: object, signature: string, timeClaims: Array} | {ok: false, error: string}}
 */
export function decodeJwt(token, now = Date.now()) {
  const trimmed = String(token == null ? '' : token).trim();
  if (!trimmed) return { ok: false, error: 'empty' };

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: `A JWT has exactly three dot-separated parts (header.payload.signature) - this has ${parts.length}.` };
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJsonSegment(headerPart, 'header');
  if (!header.ok) return header;
  const payload = decodeJsonSegment(payloadPart, 'payload');
  if (!payload.ok) return payload;
  if (!isValidBase64UrlSegment(signaturePart)) {
    return { ok: false, error: 'The signature segment isn’t valid base64url text.' };
  }

  return {
    ok: true,
    header: header.value,
    payload: payload.value,
    signature: signaturePart,
    timeClaims: interpretTimeClaims(payload.value, now),
  };
}
