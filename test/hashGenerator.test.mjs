import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { md5, bytesToHex, computeHashes, SUBTLE_ALGORITHMS } from '../src/pure/hashGenerator.mjs';

const enc = (s) => new TextEncoder().encode(s);

// -- md5 -- every RFC 1321 Appendix A.5 test vector, not a spot check -------------------------------------------------------------

test('md5: RFC 1321 test vector - empty string', () => {
  assert.equal(md5(enc('')), 'd41d8cd98f00b204e9800998ecf8427e');
});

test('md5: RFC 1321 test vector - "a"', () => {
  assert.equal(md5(enc('a')), '0cc175b9c0f1b6a831c399e269772661');
});

test('md5: RFC 1321 test vector - "abc"', () => {
  assert.equal(md5(enc('abc')), '900150983cd24fb0d6963f7d28e17f72');
});

test('md5: RFC 1321 test vector - "message digest"', () => {
  assert.equal(md5(enc('message digest')), 'f96b697d7cb7938d525a2f31aaf161d0');
});

test('md5: RFC 1321 test vector - lowercase alphabet', () => {
  assert.equal(md5(enc('abcdefghijklmnopqrstuvwxyz')), 'c3fcd3d76192e4007dfb496cca67e13b');
});

test('md5: RFC 1321 test vector - mixed-case alphanumeric', () => {
  assert.equal(md5(enc('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')), 'd174ab98d277d9f5a5611c2c9f419d9f');
});

test('md5: RFC 1321 test vector - 80-digit repeating numeral string', () => {
  assert.equal(md5(enc('12345678901234567890123456789012345678901234567890123456789012345678901234567890')), '57edf4a22be3c955ac49da2e2107b67a');
});

// -- md5 -- cross-checked against Node's own native crypto.createHash('md5'),
// not just memorized literals -- covers the padding-boundary edge cases
// (55/56/63/64/65 bytes, where the "append 0x80 then pad to 56 mod 64"
// logic is most likely to have an off-by-one) plus a spread of random
// lengths and byte content a hand-picked ASCII vector wouldn't exercise.

test('md5: matches node:crypto\'s own MD5 at every byte length from 0 to 130 (spans every padding-boundary case at least twice)', () => {
  for (let len = 0; len <= 130; len++) {
    const input = randomBytes(len);
    assert.equal(md5(input), createHash('md5').update(input).digest('hex'), `mismatch at length ${len}`);
  }
});

test('md5: matches node:crypto\'s own MD5 for several longer, multi-block random inputs', () => {
  for (const len of [500, 1000, 5000, 65536]) {
    const input = randomBytes(len);
    assert.equal(md5(input), createHash('md5').update(input).digest('hex'), `mismatch at length ${len}`);
  }
});

test('md5: always returns exactly 32 lowercase hex characters', () => {
  for (const s of ['', 'x', 'a longer piece of text to hash']) {
    assert.match(md5(enc(s)), /^[0-9a-f]{32}$/);
  }
});

test('md5: accepts an ArrayBuffer as well as a Uint8Array', () => {
  const buf = enc('abc').buffer;
  assert.equal(md5(buf), '900150983cd24fb0d6963f7d28e17f72');
});

// -- bytesToHex -------------------------------------------------------------

test('bytesToHex: encodes each byte as two lowercase hex digits', () => {
  assert.equal(bytesToHex(new Uint8Array([0, 1, 15, 16, 255])), '00010f10ff');
});

test('bytesToHex: empty input produces an empty string', () => {
  assert.equal(bytesToHex(new Uint8Array(0)), '');
});

// -- computeHashes -- against known values for the SHA family too -------------------------------------------------------------

test('computeHashes: "abc" matches every algorithm\'s well-known published test vector', async () => {
  const results = await computeHashes(enc('abc'));
  const byKey = Object.fromEntries(results.map((r) => [r.key, r.hash]));
  assert.equal(byKey.md5, '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(byKey.sha1, 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(byKey.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(byKey.sha384, 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7');
  assert.equal(byKey.sha512, 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
});

test('computeHashes: returns MD5 first, then the four SUBTLE_ALGORITHMS in their declared order', async () => {
  const results = await computeHashes(enc('x'));
  assert.deepEqual(results.map((r) => r.key), ['md5', ...SUBTLE_ALGORITHMS.map((a) => a.key)]);
});

test('computeHashes: the empty input produces the well-known empty-string hash for every algorithm', async () => {
  const results = await computeHashes(new Uint8Array(0));
  const byKey = Object.fromEntries(results.map((r) => [r.key, r.hash]));
  assert.equal(byKey.md5, 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(byKey.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
