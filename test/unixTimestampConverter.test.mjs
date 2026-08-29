import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectUnit, epochToDate, dateInputToEpoch, nowSnapshot,
} from '../src/pure/unixTimestampConverter.mjs';

test('detectUnit: a real-world seconds value (10 digits) detects as seconds', () => {
  assert.equal(detectUnit(1735689600), 'seconds');
});

test('detectUnit: a real-world milliseconds value (13 digits) detects as milliseconds', () => {
  assert.equal(detectUnit(1735689600000), 'milliseconds');
});

test('detectUnit: 0 detects as seconds (the epoch itself, below the threshold)', () => {
  assert.equal(detectUnit(0), 'seconds');
});

test('detectUnit: a negative pre-1970 seconds value still detects as seconds', () => {
  assert.equal(detectUnit(-100000), 'seconds');
});

test('epochToDate: 0 seconds is the Unix epoch itself', () => {
  const result = epochToDate(0, 'seconds');
  assert.equal(result.ok, true);
  assert.equal(result.utcLabel, '1970-01-01 00:00:00 UTC');
  assert.equal(result.isoUtc, '1970-01-01T00:00:00.000Z');
  assert.equal(result.epochSeconds, 0);
  assert.equal(result.epochMilliseconds, 0);
});

test('epochToDate: a known real timestamp in seconds converts to the correct UTC date/time', () => {
  // 2025-01-01T00:00:00Z
  const result = epochToDate(1735689600, 'seconds');
  assert.equal(result.ok, true);
  assert.equal(result.utcLabel, '2025-01-01 00:00:00 UTC');
  assert.equal(result.epochMilliseconds, 1735689600000);
});

test('epochToDate: the same instant in milliseconds produces the identical UTC label', () => {
  const seconds = epochToDate(1735689600, 'seconds');
  const millis = epochToDate(1735689600000, 'milliseconds');
  assert.equal(seconds.utcLabel, millis.utcLabel);
  assert.equal(seconds.isoUtc, millis.isoUtc);
});

test('epochToDate: rejects non-finite input', () => {
  assert.equal(epochToDate(NaN, 'seconds').ok, false);
  assert.equal(epochToDate(Infinity, 'seconds').ok, false);
  assert.equal(epochToDate('not a number', 'seconds').ok, false);
});

test('epochToDate: reports the runtime local time zone name alongside the local label', () => {
  const result = epochToDate(0, 'seconds');
  assert.equal(typeof result.localTimeZone, 'string');
  assert.ok(result.localTimeZone.length > 0);
});

test('dateInputToEpoch: interpreting a naive datetime-local value as UTC matches the known epoch', () => {
  const result = dateInputToEpoch('2025-01-01T00:00', 'utc');
  assert.equal(result.ok, true);
  assert.equal(result.epochSeconds, 1735689600);
});

test('dateInputToEpoch: interpreting the same value as local time differs from the UTC interpretation whenever the runtime is not UTC itself (or matches when it is)', () => {
  const utcResult = dateInputToEpoch('2025-01-01T00:00', 'utc');
  const localResult = dateInputToEpoch('2025-01-01T00:00', 'local');
  const offsetMinutes = new Date('2025-01-01T00:00').getTimezoneOffset();
  if (offsetMinutes === 0) {
    assert.equal(localResult.epochSeconds, utcResult.epochSeconds);
  } else {
    assert.notEqual(localResult.epochSeconds, utcResult.epochSeconds);
  }
});

test('dateInputToEpoch: round-trips seconds and milliseconds consistently', () => {
  const result = dateInputToEpoch('2025-01-01T00:00', 'utc');
  assert.equal(result.epochMilliseconds, result.epochSeconds * 1000);
});

test('dateInputToEpoch: rejects an empty value', () => {
  assert.equal(dateInputToEpoch('', 'utc').ok, false);
  assert.equal(dateInputToEpoch(null, 'utc').ok, false);
});

test('dateInputToEpoch: rejects an unparseable string', () => {
  assert.equal(dateInputToEpoch('not-a-date', 'utc').ok, false);
});

test('nowSnapshot: returns a real, current, well-formed snapshot', () => {
  const before = Date.now();
  const snap = nowSnapshot();
  const after = Date.now();
  assert.equal(snap.ok, true);
  assert.ok(snap.epochMilliseconds >= before && snap.epochMilliseconds <= after);
  assert.match(snap.utcLabel, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
});
