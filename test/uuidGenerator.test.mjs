import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAMESPACES, generateV1, generateV4, generateV5, generateV7, generateBatch, bytesToUuid,
} from '../src/pure/uuidGenerator.mjs';

const UUID_SHAPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function versionNibble(uuid) {
  return uuid[14];
}
function variantNibble(uuid) {
  return uuid[19];
}

test('bytesToUuid formats 16 bytes with the standard 8-4-4-4-12 dash layout', () => {
  const bytes = Uint8Array.from([0x88, 0x63, 0x13, 0xe1, 0x3b, 0x8a, 0x53, 0x72, 0x9b, 0x90, 0x0c, 0x9a, 0xee, 0x19, 0x9e, 0x5d]);
  assert.equal(bytesToUuid(bytes), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
});

test('generateV4 produces the correct shape, version nibble 4, and variant nibble in [89ab]', () => {
  for (let i = 0; i < 200; i += 1) {
    const id = generateV4();
    assert.match(id, UUID_SHAPE_RE);
    assert.equal(versionNibble(id), '4');
    assert.match(variantNibble(id), /[89ab]/);
  }
});

test('generateV4 produces distinct values across repeated calls', () => {
  const seen = new Set(Array.from({ length: 500 }, () => generateV4()));
  assert.equal(seen.size, 500);
});

test('generateV1 produces the correct shape, version nibble 1, variant nibble in [89ab], and a node ID with the multicast bit set', () => {
  for (let i = 0; i < 50; i += 1) {
    const id = generateV1();
    assert.match(id, UUID_SHAPE_RE);
    assert.equal(versionNibble(id), '1');
    assert.match(variantNibble(id), /[89ab]/);
    const nodeFirstByte = parseInt(id.slice(24, 26), 16);
    assert.equal(nodeFirstByte & 0x01, 0x01, 'node ID must carry the multicast bit (RFC 4122 4.5) since it is not a real MAC address');
  }
});

test('generateV1 embeds a non-decreasing 60-bit timestamp across sequential calls', () => {
  const a = generateV1();
  const b = generateV1();
  const timeOf = (id) => {
    const timeLow = id.slice(0, 8);
    const timeMid = id.slice(9, 13);
    const timeHi = id.slice(14, 18).replace(/^1/, '');
    return BigInt(`0x${timeHi}${timeMid}${timeLow}`);
  };
  assert.ok(timeOf(b) >= timeOf(a));
});

test('generateV7 produces the correct shape, version nibble 7, and variant nibble in [89ab]', () => {
  for (let i = 0; i < 200; i += 1) {
    const id = generateV7();
    assert.match(id, UUID_SHAPE_RE);
    assert.equal(versionNibble(id), '7');
    assert.match(variantNibble(id), /[89ab]/);
  }
});

test('generateV7 embeds a non-decreasing millisecond timestamp in its first 48 bits across sequential calls', () => {
  const a = generateV7();
  const b = generateV7();
  const msOf = (id) => BigInt(`0x${id.slice(0, 8)}${id.slice(9, 13)}`);
  assert.ok(msOf(b) >= msOf(a));
});

test('generateV5 matches known RFC 4122 test vectors (cross-checked against node:crypto SHA-1 independently)', async () => {
  assert.equal(await generateV5(NAMESPACES.dns, 'python.org'), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
  assert.equal(await generateV5(NAMESPACES.url, 'python.org'), '7af94e2b-4dd9-50f0-9c9a-8a48519bdef0');
  assert.equal(await generateV5(NAMESPACES.dns, 'example.com'), 'cfbff0d1-9375-5685-968c-48ce8b15ae17');
});

test('generateV5 is deterministic for the same namespace + name, and differs for a different name', async () => {
  const a = await generateV5(NAMESPACES.dns, 'example.com');
  const b = await generateV5(NAMESPACES.dns, 'example.com');
  const c = await generateV5(NAMESPACES.dns, 'example.org');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('generateV5 has version nibble 5 and variant nibble in [89ab]', async () => {
  const id = await generateV5(NAMESPACES.dns, 'anything');
  assert.equal(versionNibble(id), '5');
  assert.match(variantNibble(id), /[89ab]/);
});

test('generateBatch rejects an unknown version', async () => {
  const result = await generateBatch({ version: 'v9', count: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown uuid version/i);
});

test('generateBatch rejects a count of 0, a negative count, a non-integer count, and a count over 1000', async () => {
  for (const count of [0, -1, 1.5, 1001, NaN]) {
    const result = await generateBatch({ version: 'v4', count });
    assert.equal(result.ok, false, `count ${count} should be rejected`);
    assert.match(result.error, /between 1 and 1000/);
  }
});

test('generateBatch accepts the boundary counts 1 and 1000', async () => {
  const one = await generateBatch({ version: 'v4', count: 1 });
  assert.equal(one.ok, true);
  assert.equal(one.uuids.length, 1);
  const thousand = await generateBatch({ version: 'v4', count: 1000 });
  assert.equal(thousand.ok, true);
  assert.equal(thousand.uuids.length, 1000);
  assert.equal(new Set(thousand.uuids).size, 1000);
});

test('generateBatch v5 rejects a missing/invalid namespace', async () => {
  const missing = await generateBatch({ version: 'v5', count: 1, name: 'example.com' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /namespace/i);
  const invalid = await generateBatch({ version: 'v5', count: 1, namespace: 'not-a-uuid', name: 'example.com' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /namespace/i);
});

test('generateBatch v5 rejects a missing/blank name', async () => {
  const missing = await generateBatch({ version: 'v5', count: 1, namespace: NAMESPACES.dns });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /name/i);
  const blank = await generateBatch({ version: 'v5', count: 1, namespace: NAMESPACES.dns, name: '   ' });
  assert.equal(blank.ok, false);
  assert.match(blank.error, /name/i);
});

test('generateBatch v5 with a valid namespace + name returns the deterministic UUID repeated count times', async () => {
  const result = await generateBatch({ version: 'v5', count: 3, namespace: NAMESPACES.dns, name: 'python.org' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.uuids, [
    '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    '886313e1-3b8a-5372-9b90-0c9aee199e5d',
  ]);
});

test('generateBatch v1 and v7 each return `count` distinct, correctly versioned UUIDs', async () => {
  for (const version of ['v1', 'v7']) {
    const result = await generateBatch({ version, count: 25 });
    assert.equal(result.ok, true);
    assert.equal(result.uuids.length, 25);
    assert.equal(new Set(result.uuids).size, 25);
    for (const id of result.uuids) {
      assert.match(id, UUID_SHAPE_RE);
      assert.equal(versionNibble(id), version === 'v1' ? '1' : '7');
    }
  }
});

test('NAMESPACES exposes the four standard RFC 4122 predefined namespace UUIDs', () => {
  assert.equal(NAMESPACES.dns, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  assert.equal(NAMESPACES.url, '6ba7b811-9dad-11d1-80b4-00c04fd430c8');
  assert.equal(NAMESPACES.oid, '6ba7b812-9dad-11d1-80b4-00c04fd430c8');
  assert.equal(NAMESPACES.x500, '6ba7b814-9dad-11d1-80b4-00c04fd430c8');
});
