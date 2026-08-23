import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, INDEXNOW_ENDPOINT } from '../scripts/indexnow-ping.js';
import { INDEXNOW_KEY } from '../src/indexnow.js';
import { TOOLS } from '../src/tools/index.js';

test('INDEXNOW_ENDPOINT is the real IndexNow API URL', () => {
  assert.equal(INDEXNOW_ENDPOINT, 'https://api.indexnow.org/indexnow');
});

test('INDEXNOW_KEY is a hex string within IndexNow\'s required 8-128 char range', () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{8,128}$/);
});

test('buildPayload submits the real site host, the key, a matching keyLocation, and one URL per built page', () => {
  const payload = buildPayload();
  assert.equal(payload.host, 'usefiletools.com');
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.equal(payload.keyLocation, `https://usefiletools.com/${INDEXNOW_KEY}.txt`);
  // Root + how-this-works + privacy + one URL per tool.
  assert.equal(payload.urlList.length, TOOLS.length + 3);
  assert.ok(payload.urlList.includes('https://usefiletools.com/'));
  assert.ok(payload.urlList.every((u) => u.startsWith('https://usefiletools.com/')));
});
