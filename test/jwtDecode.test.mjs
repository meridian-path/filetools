import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt, interpretTimeClaims } from '../src/pure/jwtDecode.mjs';

/**
 * @param {object} header
 * @param {object} payload
 * @param {string} [signature] raw bytes for the signature segment -- a
 *   real signature is verified with a key this module never has access
 *   to, so any bytes are equally "valid" as far as decoding goes; the
 *   fixture uses a plausible-looking placeholder rather than real HMAC
 *   output, since decodeJwt() never checks it.
 * @returns {string} a real, well-formed JWT string, using Node's own
 *   built-in `base64url` encoding (not this module's own decoder) so the
 *   fixture is independent of the code under test.
 */
function makeJwt(header, payload, signature = 'sig') {
  const enc = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const sig = Buffer.from(signature, 'utf8').toString('base64url');
  return `${enc(header)}.${enc(payload)}.${sig}`;
}

test('decodeJwt: a real, well-formed JWT decodes its header and payload correctly', () => {
  const token = makeJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '1234567890', name: 'Ada Lovelace' });
  const result = decodeJwt(token);
  assert.equal(result.ok, true);
  assert.deepEqual(result.header, { alg: 'HS256', typ: 'JWT' });
  assert.deepEqual(result.payload, { sub: '1234567890', name: 'Ada Lovelace' });
});

test('decodeJwt: the signature segment is returned as-is, not decoded as JSON', () => {
  const token = makeJwt({ alg: 'HS256' }, { a: 1 }, 'not-json-at-all');
  const result = decodeJwt(token);
  assert.equal(result.ok, true);
  assert.equal(result.signature, Buffer.from('not-json-at-all', 'utf8').toString('base64url'));
});

test('decodeJwt: a payload with non-ASCII text (accented characters) decodes correctly as real UTF-8, not mangled', () => {
  const token = makeJwt({ alg: 'HS256' }, { name: 'Grâce Hopper', city: 'Üsküdar' });
  const result = decodeJwt(token);
  assert.equal(result.ok, true);
  assert.equal(result.payload.name, 'Grâce Hopper');
  assert.equal(result.payload.city, 'Üsküdar');
});

test('decodeJwt: trims leading/trailing whitespace (a common copy-paste artifact) but not internal structure', () => {
  const token = makeJwt({ alg: 'HS256' }, { a: 1 });
  const result = decodeJwt(`  \n${token}\t  `);
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, { a: 1 });
});

test('decodeJwt: empty input is reported distinctly, not as a generic parse failure', () => {
  assert.deepEqual(decodeJwt(''), { ok: false, error: 'empty' });
  assert.deepEqual(decodeJwt('   '), { ok: false, error: 'empty' });
});

test('decodeJwt: a token with the wrong number of dot-separated parts names the real count', () => {
  const twoPartsResult = decodeJwt('onlyonepart.here');
  assert.equal(twoPartsResult.ok, false);
  assert.match(twoPartsResult.error, /has 2/);

  const fourPartsResult = decodeJwt('a.b.c.d');
  assert.equal(fourPartsResult.ok, false);
  assert.match(fourPartsResult.error, /has 4/);
});

test('decodeJwt: an invalid base64url character in the header is a specific, named error', () => {
  const result = decodeJwt('not!valid@base64.eyJhIjoxfQ.sig');
  assert.equal(result.ok, false);
  assert.match(result.error, /header segment/);
});

test('decodeJwt: an invalid base64url character in the payload is a specific, named error', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' }), 'utf8').toString('base64url');
  const result = decodeJwt(`${header}.not!valid@base64.sig`);
  assert.equal(result.ok, false);
  assert.match(result.error, /payload segment/);
});

test('decodeJwt: a header segment that decodes to valid base64url but not valid JSON is a specific error', () => {
  const notJson = Buffer.from('not actually json', 'utf8').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ a: 1 }), 'utf8').toString('base64url');
  const result = decodeJwt(`${notJson}.${payload}.sig`);
  assert.equal(result.ok, false);
  assert.match(result.error, /header segment.*valid JSON/);
});

test('decodeJwt: an invalid signature segment is its own specific error, checked after both JSON segments succeed', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' }), 'utf8').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ a: 1 }), 'utf8').toString('base64url');
  const result = decodeJwt(`${header}.${payload}.not!valid@base64`);
  assert.equal(result.ok, false);
  assert.match(result.error, /signature segment/);
});

test('interpretTimeClaims: reports exp, nbf, and iat when present, in that fixed order, each as a real ISO date', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const oneHourAgo = Math.floor(now / 1000) - 3600;
  const oneHourFromNow = Math.floor(now / 1000) + 3600;
  const claims = interpretTimeClaims({ exp: oneHourFromNow, nbf: oneHourAgo, iat: oneHourAgo }, now);
  assert.deepEqual(claims.map((c) => c.key), ['exp', 'nbf', 'iat']);
  assert.equal(claims[0].isPast, false);
  assert.equal(claims[1].isPast, true);
  assert.equal(claims[2].isPast, true);
  assert.equal(claims[0].iso, new Date(oneHourFromNow * 1000).toISOString());
});

test('interpretTimeClaims: an expired exp claim is correctly flagged isPast, the real motivating case for this feature', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const claims = interpretTimeClaims({ exp: Math.floor(now / 1000) - 1 }, now);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].key, 'exp');
  assert.equal(claims[0].isPast, true);
});

test('interpretTimeClaims: only includes claims that are actually present and finite numbers, ignores strings/missing/NaN', () => {
  assert.deepEqual(interpretTimeClaims({}), []);
  assert.deepEqual(interpretTimeClaims({ exp: 'not a number' }), []);
  assert.deepEqual(interpretTimeClaims({ exp: NaN }), []);
  assert.equal(interpretTimeClaims({ exp: 123 }).length, 1);
});

test('interpretTimeClaims: a non-object payload (or null/array) yields no time claims rather than throwing', () => {
  assert.deepEqual(interpretTimeClaims(null), []);
  assert.deepEqual(interpretTimeClaims('a string payload'), []);
  assert.deepEqual(interpretTimeClaims([1, 2, 3]), []);
  assert.deepEqual(interpretTimeClaims(42), []);
});

test('decodeJwt: a full realistic token surfaces its own time claims via the top-level result', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const exp = Math.floor(now / 1000) - 10; // already expired
  const token = makeJwt({ alg: 'HS256', typ: 'JWT' }, { sub: 'user-42', exp });
  const result = decodeJwt(token, now);
  assert.equal(result.ok, true);
  assert.equal(result.timeClaims.length, 1);
  assert.equal(result.timeClaims[0].key, 'exp');
  assert.equal(result.timeClaims[0].isPast, true);
});

test('decodeJwt: a payload that is a JSON array (unusual but not forbidden by the spec) decodes without throwing, with no time claims', () => {
  const token = makeJwt({ alg: 'HS256' }, [1, 2, 3]);
  const result = decodeJwt(token);
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, [1, 2, 3]);
  assert.deepEqual(result.timeClaims, []);
});
