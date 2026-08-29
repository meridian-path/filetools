// Unix timestamp <-> human-readable date conversion, both directions.
// Pure logic, imported both by the browser client and directly by
// test/unixTimestampConverter.test.mjs -- no DOM or Node built-ins beyond
// the standard Date/Intl objects, which exist identically in both
// environments, so the exact same file runs unmodified in the browser and
// under `node --test` (same convention src/pure/uuidGenerator.mjs's
// header comment states).

// Real-world epoch SECONDS values (1970-2286, the range Date can even
// represent as a 32-bit-friendly year) never reach 12 digits (the current
// epoch second, ~1.77 billion, is 10 digits; it does not reach 11 digits
// until 2286). Real-world epoch MILLISECONDS values have been 13 digits
// since 2001 and won't drop to 12 until the year analog of 1970 in
// milliseconds, i.e. never in practice. 1e11 sits cleanly between "the
// largest remotely plausible seconds value" and "the smallest remotely
// plausible milliseconds value" for any date within a few centuries of
// today, which is the entire realistic input range for this tool.
const AUTO_DETECT_THRESHOLD = 1e11;

/**
 * @param {number} numericValue
 * @returns {'seconds'|'milliseconds'} a best-guess unit by magnitude --
 *   see AUTO_DETECT_THRESHOLD's own comment for why this heuristic holds
 *   for any realistic input. Exposed separately (not just used internally
 *   by epochToDate) so the UI can show the visitor which guess it made.
 */
export function detectUnit(numericValue) {
  return Math.abs(numericValue) >= AUTO_DETECT_THRESHOLD ? 'milliseconds' : 'seconds';
}

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

/** @returns {string} "YYYY-MM-DD HH:mm:ss" in UTC, unambiguous and locale-independent. */
function formatUtc(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

/** @returns {string} "YYYY-MM-DD HH:mm:ss" in the runtime's own local time zone, same unambiguous shape as formatUtc. */
function formatLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function localTimeZoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'local time zone';
  }
}

/**
 * @param {number} value the raw epoch number as typed.
 * @param {'seconds'|'milliseconds'} unit
 * @returns {{ok: true, epochSeconds: number, epochMilliseconds: number, utcLabel: string, localLabel: string, localTimeZone: string, isoUtc: string} | {ok: false, error: string}}
 */
export function epochToDate(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: 'Enter a number.' };
  }
  const ms = unit === 'seconds' ? value * 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: 'That number is outside the range JavaScript can represent as a date.' };
  }
  return {
    ok: true,
    epochSeconds: Math.round(ms / 1000),
    epochMilliseconds: Math.round(ms),
    utcLabel: formatUtc(date),
    localLabel: formatLocal(date),
    localTimeZone: localTimeZoneName(),
    isoUtc: date.toISOString(),
  };
}

/**
 * @param {string} datetimeLocalValue the raw value from an
 *   `<input type="datetime-local">` -- always timezone-naive
 *   ("YYYY-MM-DDTHH:mm" or "...:ss"), per the HTML spec.
 * @param {'utc'|'local'} interpretAs how to interpret the naive value:
 *   'utc' treats it as already being UTC clock time; 'local' treats it as
 *   the runtime's own local clock time (the same thing a bare
 *   `new Date(datetimeLocalValue)` call already does, per the ECMAScript
 *   Date Time String Format spec -- a date-time string with no offset is
 *   local, only a date-ONLY string like "2026-08-29" is UTC by default).
 * @returns {{ok: true, epochSeconds: number, epochMilliseconds: number} | {ok: false, error: string}}
 */
export function dateInputToEpoch(datetimeLocalValue, interpretAs) {
  if (!datetimeLocalValue) return { ok: false, error: 'Pick a date and time.' };
  const ms = interpretAs === 'utc'
    ? Date.parse(`${datetimeLocalValue}Z`)
    : new Date(datetimeLocalValue).getTime();
  if (Number.isNaN(ms)) return { ok: false, error: 'That date/time could not be parsed.' };
  return { ok: true, epochSeconds: Math.round(ms / 1000), epochMilliseconds: Math.round(ms) };
}

/**
 * @returns {{epochSeconds: number, epochMilliseconds: number, utcLabel: string, localLabel: string, localTimeZone: string}}
 *   the current moment, for the live "right now" readout.
 */
export function nowSnapshot() {
  const result = epochToDate(Date.now(), 'milliseconds');
  return result;
}
