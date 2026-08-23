/**
 * Cryptographic hash generation -- the shared logic behind the "Hash
 * Generator" tool. Pure data in, pure data out -- no DOM -- directly
 * unit-testable in Node (test/hashGenerator.test.mjs, against Node's own
 * global Web Crypto -- available as globalThis.crypto since Node 19) and
 * loaded client-side the same way every other src/pure/*.mjs module is.
 *
 * SHA-1/256/384/512 are computed via the browser's own SubtleCrypto
 * (crypto.subtle.digest) -- a native, audited implementation, so this tool
 * ships zero vendor bytes for those four algorithms, the same "use the
 * platform" reasoning ../pure/urlEncode.mjs's header explains for
 * encodeURIComponent/decodeURIComponent. MD5 has no SubtleCrypto entry (it
 * was never part of that spec), so it's hand-implemented here from RFC
 * 1321 -- verified in test/hashGenerator.test.mjs against every test
 * vector in that RFC's own Appendix A.5, not just one or two spot checks,
 * since a hash function has to be exactly right or it's useless.
 *
 * SHA3 is a disclosed, deliberate scope cut, not a silent omission (see
 * the tool page's own FAQ copy): Keccak's sponge construction is
 * meaningfully more complex to hand-implement correctly than MD5's
 * straightforward block cipher, there is no vetted vendor library already
 * in this repo for it, and SubtleCrypto doesn't cover it either. Same
 * "explicitly acceptable fallback, not a shortcut taken silently" shape
 * TESTING.md's "Known simplifications" section already documents for
 * other tools on this site.
 */

/**
 * @param {ArrayBuffer} bytes
 * @returns {string} lowercase hex, two characters per byte.
 */
export function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// -- MD5 (RFC 1321) -------------------------------------------------------------

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(2^32 * abs(sin(i + 1))), the standard RFC 1321 constant table.
const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

function rotl32(x, n) {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {string} the MD5 digest of `data`, as lowercase hex.
 */
export function md5(data) {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bitLenLow = (input.length * 8) >>> 0;
  const bitLenHigh = Math.floor((input.length * 8) / 4294967296) >>> 0;

  // Pad: 0x80, then zeros until length (bytes) === 56 mod 64, then the
  // original bit-length as two little-endian 32-bit words.
  const paddedLen = (((input.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLenLow, true);
  view.setUint32(paddedLen - 4, bitLenHigh, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const M = new Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(chunkStart + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl32(F, MD5_S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return bytesToHex(out);
}

// -- SHA family, via the platform's own SubtleCrypto ----------------------------

/** @type {Array<{key:string, label:string}>} the four SubtleCrypto-backed
 *  algorithms this tool offers, alongside MD5. One place both the pure
 *  computeHashes() and the browser client's render order share, so a
 *  future algorithm addition can't update one and forget the other. */
export const SUBTLE_ALGORITHMS = [
  { key: 'sha1', label: 'SHA-1', subtleName: 'SHA-1' },
  { key: 'sha256', label: 'SHA-256', subtleName: 'SHA-256' },
  { key: 'sha384', label: 'SHA-384', subtleName: 'SHA-384' },
  { key: 'sha512', label: 'SHA-512', subtleName: 'SHA-512' },
];

/**
 * @param {ArrayBuffer} bytes
 * @returns {Promise<Array<{key:string, label:string, hash:string}>>} MD5
 *   first (hand-computed, synchronous under the hood), then the four
 *   SubtleCrypto algorithms in the fixed order the tool page presents
 *   them in.
 */
export async function computeHashes(bytes) {
  const results = [{ key: 'md5', label: 'MD5', hash: md5(bytes) }];
  for (const algo of SUBTLE_ALGORITHMS) {
    const digest = await crypto.subtle.digest(algo.subtleName, bytes);
    results.push({ key: algo.key, label: algo.label, hash: bytesToHex(digest) });
  }
  return results;
}
