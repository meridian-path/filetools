// UUID/GUID generation per RFC 4122 (v1/v4/v5) and RFC 9562 (v7). Pure
// logic, imported both by the browser client and directly by
// test/uuidGenerator.test.mjs -- see src/pure/hashGenerator.mjs's header
// comment for why pure modules in this repo depend only on the Web Crypto
// API (crypto.getRandomValues/crypto.subtle), never Node built-ins, so the
// exact same file runs unmodified in the browser and under `node --test`.

export const NAMESPACES = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bytesToUuid(bytes) {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function randomBytes(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Random-only (no MAC address, no persisted clock state) v4 UUID: 122 random bits, version+variant set per RFC 4122 4.4. */
export function generateV4() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * Time-based v1 UUID per RFC 4122 4.2. Uses a freshly random 48-bit node ID
 * with the multicast bit set (4.5's documented alternative to a real MAC
 * address -- appropriate here since this tool has no hardware MAC to read
 * and no server-side state to persist a clock sequence across calls) and a
 * freshly random 14-bit clock sequence on every call. This means two
 * UUIDs generated in the same 100ns tick are not guaranteed distinguishable
 * by clock sequence the way a long-running, state-persisting v1 generator
 * would be -- timestamp + 122 bits of fresh randomness (node + clock seq)
 * still makes a collision astronomically unlikely, but this is not a
 * drop-in replacement for a stateful v1 generator's monotonicity
 * guarantees. Disclosed in the tool's FAQ.
 */
export function generateV1() {
  const GREGORIAN_OFFSET_100NS = 122192928000000000n;
  const timestamp100ns = BigInt(Date.now()) * 10000n + GREGORIAN_OFFSET_100NS;

  const timeLow = Number(timestamp100ns & 0xffffffffn);
  const timeMid = Number((timestamp100ns >> 32n) & 0xffffn);
  const timeHiAndVersion = Number((timestamp100ns >> 48n) & 0x0fffn) | 0x1000;

  const seqBytes = randomBytes(2);
  const clockSeq = ((seqBytes[0] << 8) | seqBytes[1]) & 0x3fff;
  const clockSeqHiAndReserved = ((clockSeq >> 8) & 0x3f) | 0x80;
  const clockSeqLow = clockSeq & 0xff;

  const node = randomBytes(6);
  node[0] |= 0x01;

  const bytes = new Uint8Array(16);
  bytes[0] = (timeLow >>> 24) & 0xff;
  bytes[1] = (timeLow >>> 16) & 0xff;
  bytes[2] = (timeLow >>> 8) & 0xff;
  bytes[3] = timeLow & 0xff;
  bytes[4] = (timeMid >>> 8) & 0xff;
  bytes[5] = timeMid & 0xff;
  bytes[6] = (timeHiAndVersion >>> 8) & 0xff;
  bytes[7] = timeHiAndVersion & 0xff;
  bytes[8] = clockSeqHiAndReserved;
  bytes[9] = clockSeqLow;
  bytes.set(node, 10);
  return bytesToUuid(bytes);
}

/** Unix-epoch-ms-based v7 UUID per RFC 9562 5.7: 48-bit big-endian ms timestamp, then version+74 random bits with the variant set. */
export function generateV7() {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/** Name-based v5 UUID per RFC 4122 4.3: SHA-1(namespace bytes + name bytes), truncated to 128 bits, version+variant set. */
export async function generateV5(namespaceUuid, name) {
  const nsBytes = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(nsBytes.length + nameBytes.length);
  input.set(nsBytes, 0);
  input.set(nameBytes, nsBytes.length);
  const digest = await crypto.subtle.digest('SHA-1', input);
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

const MAX_COUNT = 1000;

/**
 * @param {{version: 'v1'|'v4'|'v5'|'v7', count: number, namespace?: string, name?: string}} opts
 * @returns {Promise<{ok: true, uuids: string[]} | {ok: false, error: string}>}
 */
export async function generateBatch({ version, count, namespace, name }) {
  if (!['v1', 'v4', 'v5', 'v7'].includes(version)) {
    return { ok: false, error: `Unknown UUID version "${version}".` };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return { ok: false, error: `Count must be a whole number between 1 and ${MAX_COUNT}.` };
  }

  if (version === 'v5') {
    const ns = (namespace || '').trim().toLowerCase();
    if (!UUID_RE.test(ns)) {
      return { ok: false, error: 'Namespace must be a valid UUID, e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8.' };
    }
    if (!name || !name.trim()) {
      return { ok: false, error: 'Enter a name to hash for v5 (e.g. a domain name or URL).' };
    }
    const uuids = [];
    for (let i = 0; i < count; i += 1) uuids.push(await generateV5(ns, name));
    return { ok: true, uuids };
  }

  const generator = version === 'v1' ? generateV1 : version === 'v7' ? generateV7 : generateV4;
  const uuids = [];
  for (let i = 0; i < count; i += 1) uuids.push(generator());
  return { ok: true, uuids };
}
