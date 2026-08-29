import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stringToUtf8Bytes, escapeWifiField, buildWifiPayload, validateEncodableText, MAX_INPUT_LENGTH,
} from '../src/pure/qrCodeGenerator.mjs';

test('stringToUtf8Bytes: plain ASCII encodes as single bytes', () => {
  assert.deepEqual(stringToUtf8Bytes('A'), [0x41]);
  assert.deepEqual(stringToUtf8Bytes('Hi'), [0x48, 0x69]);
});

test('stringToUtf8Bytes: a 2-byte UTF-8 character (e-acute, U+00E9) encodes correctly', () => {
  assert.deepEqual(stringToUtf8Bytes('caf\u00e9'), [0x63, 0x61, 0x66, 0xc3, 0xa9]);
});

test('stringToUtf8Bytes: a 3-byte UTF-8 character (euro sign, U+20AC) encodes correctly', () => {
  assert.deepEqual(stringToUtf8Bytes('\u20ac'), [0xe2, 0x82, 0xac]);
});

test('stringToUtf8Bytes: a surrogate pair (emoji outside the BMP, U+1F600) encodes as one real 4-byte sequence', () => {
  assert.deepEqual(stringToUtf8Bytes('\u{1f600}'), [0xf0, 0x9f, 0x98, 0x80]);
});

test('stringToUtf8Bytes: an unpaired (lone) high surrogate at the end of the string does not crash or read past the end', () => {
  const lone = '\ud800';
  assert.doesNotThrow(() => stringToUtf8Bytes(lone));
  assert.equal(stringToUtf8Bytes(lone).length, 3); // encoded as its own 3-byte WTF-8-style code point, not merged
});

test('stringToUtf8Bytes: empty string returns no bytes', () => {
  assert.deepEqual(stringToUtf8Bytes(''), []);
});

test('escapeWifiField: escapes backslash, semicolon, comma, and colon, each with a preceding backslash', () => {
  assert.equal(escapeWifiField('a;b,c:d\\e'), 'a\\;b\\,c\\:d\\\\e');
});

test('escapeWifiField: a field with none of the special characters passes through unchanged', () => {
  assert.equal(escapeWifiField('MyHomeNetwork'), 'MyHomeNetwork');
});

test('escapeWifiField: does not escape double quotes -- they are not part of the reserved separator set', () => {
  assert.equal(escapeWifiField('pass"word'), 'pass"word');
});

test('buildWifiPayload: a WPA network with a semicolon in the password produces a correctly escaped payload', () => {
  const payload = buildWifiPayload({
    ssid: 'My;Net', password: 'pass;word', security: 'WPA', hidden: false,
  });
  assert.equal(payload, 'WIFI:T:WPA;S:My\\;Net;P:pass\\;word;H:false;;');
});

test('buildWifiPayload: an open (nopass) network omits the P: field entirely', () => {
  const payload = buildWifiPayload({
    ssid: 'Free Wifi', password: '', security: 'nopass', hidden: true,
  });
  assert.equal(payload, 'WIFI:T:nopass;S:Free Wifi;H:true;;');
  assert.doesNotMatch(payload, /P:/);
});

test('buildWifiPayload: WEP security is passed through as its own T: value', () => {
  const payload = buildWifiPayload({
    ssid: 'OldRouter', password: 'abc12', security: 'WEP', hidden: false,
  });
  assert.match(payload, /^WIFI:T:WEP;/);
});

test('validateEncodableText: empty or whitespace-only text is rejected with a friendly message', () => {
  assert.equal(validateEncodableText('').ok, false);
  assert.equal(validateEncodableText('   ').ok, false);
});

test('validateEncodableText: ordinary text passes', () => {
  assert.deepEqual(validateEncodableText('https://example.com'), { ok: true });
});

test('validateEncodableText: text over MAX_INPUT_LENGTH is rejected with a friendly message naming the real cap', () => {
  const result = validateEncodableText('x'.repeat(MAX_INPUT_LENGTH + 1));
  assert.equal(result.ok, false);
  assert.match(result.error, new RegExp(String(MAX_INPUT_LENGTH)));
});

test('validateEncodableText: text at exactly MAX_INPUT_LENGTH is accepted', () => {
  assert.deepEqual(validateEncodableText('x'.repeat(MAX_INPUT_LENGTH)), { ok: true });
});
