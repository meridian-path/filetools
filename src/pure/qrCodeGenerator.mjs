/**
 * Pure logic for the QR Code Generator tool
 * (src/browser/qrCodeGenerator.client.js). The actual QR encoding/rendering
 * runs directly against the vendored `qrcode-generator` library in that
 * client file (same pattern as yamlToJson.client.js importing js-yaml
 * directly) -- this module holds only the logic that library doesn't
 * provide and that stays unit-testable without a DOM: a real UTF-8 byte
 * encoder (the library's own built-in `stringToBytes` only masks each
 * UTF-16 code unit to its low byte, which corrupts any non-Latin1
 * character -- see this file's own stringToUtf8Bytes for the real
 * conversion), and the Wi-Fi QR payload builder.
 */

/**
 * A QR code's absolute maximum byte-mode capacity (version 40, error
 * correction level L) is 2953 bytes. Capped well below that with a
 * friendly message rather than letting a visitor hit the library's own
 * internal "code length overflow" exception, which varies by error
 * correction level and would otherwise surface as a raw, unexplained
 * error for input that was always going to be too long for ANY level.
 */
export const MAX_INPUT_LENGTH = 1500;

/**
 * Real UTF-8 encoder -- converts a JS string (UTF-16 code units) to an
 * array of UTF-8 bytes, correctly handling surrogate pairs (so an emoji or
 * any character outside the Basic Multilingual Plane encodes as its real
 * 4-byte UTF-8 sequence, not two separate corrupted 3-byte sequences).
 * Overrides `qrcode.stringToBytes` in the client so accented/non-Latin
 * text round-trips correctly through the QR code, instead of the
 * library's own default byte-masking behavior.
 *
 * @param {string} str
 * @returns {number[]}
 */
export function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/**
 * Escapes the four characters the Wi-Fi QR payload format (the de facto
 * standard Android/iOS camera apps both scan -- there is no single formal
 * spec, but every implementation agrees on this escape set) treats as
 * field separators: backslash, semicolon, comma, and colon. Any of these
 * appearing literally inside an SSID or password must be backslash-escaped
 * or a scanner will misparse the field boundaries.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeWifiField(value) {
  return String(value).replace(/([\\;,:])/g, '\\$1');
}

/**
 * @param {{ssid: string, password: string, security: 'WPA'|'WEP'|'nopass', hidden: boolean}} opts
 *   `security: 'WPA'` covers WPA/WPA2/WPA3 -- every scanner treats them
 *   identically at the QR-payload level, so there is no separate WPA2/WPA3
 *   value in this format.
 * @returns {string} the WIFI: payload string, e.g.
 *   "WIFI:T:WPA;S:mynetwork;P:mypassword;H:false;;"
 */
export function buildWifiPayload({
  ssid, password, security, hidden,
}) {
  const parts = [`T:${security}`, `S:${escapeWifiField(ssid)}`];
  if (security !== 'nopass') parts.push(`P:${escapeWifiField(password)}`);
  parts.push(`H:${hidden ? 'true' : 'false'}`);
  return `WIFI:${parts.join(';')};;`;
}

/**
 * @param {string} text the content that would be encoded (plain text/URL
 *   input, or an already-built WIFI: payload).
 * @returns {{ok: true}|{ok: false, error: string}}
 */
export function validateEncodableText(text) {
  if (!text || text.trim().length === 0) {
    return { ok: false, error: 'Enter some text, a URL, or fill in the Wi-Fi fields to generate a QR code.' };
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: `That’s ${text.length} characters - QR codes top out well below that (this tool’s own cap is ${MAX_INPUT_LENGTH}). Try shorter text, or a shortened URL.` };
  }
  return { ok: true };
}
