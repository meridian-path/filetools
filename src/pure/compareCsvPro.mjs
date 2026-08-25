/**
 * Pure logic behind "Compare-CSV Pro", the paid batch/Excel-report add-on: batch
 * file-pairing by filename, and interpreting a Gumroad license-verify API
 * response. No DOM, no fetch -- directly unit-testable in Node
 * (test/compareCsvPro.test.mjs). The actual diff for each paired file still
 * runs through the existing ../pure/csvDiff.mjs (imported by the browser
 * client, not duplicated here) -- this module only owns what's new for the
 * Pro feature: pairing and license-response interpretation.
 */

/**
 * @param {string} filename
 * @returns {string} the filename with its extension stripped and
 *   surrounding whitespace trimmed, lowercased for matching purposes only
 *   (the original filename is always what's shown to the visitor). Only
 *   the LAST extension is stripped ("report.2024.csv" -> "report.2024"),
 *   matching how a real file manager shows "hide extension" -- a
 *   double-extension file is still paired by its meaningful stem, not
 *   mangled further.
 */
export function stemOf(filename) {
  const trimmed = String(filename == null ? '' : filename).trim();
  const lastDot = trimmed.lastIndexOf('.');
  const stem = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return stem.toLowerCase();
}

/**
 * Pairs two batches of filenames by matching stem (see stemOf) -- the
 * simplest, most predictable rule a visitor can reason about themselves
 * ("name your files to match and it just works"), deliberately not a
 * fuzzy/similarity match. A stem appearing more than once within the SAME
 * batch is not specially handled here -- the caller passes real File
 * objects alongside these names and is responsible for deciding which one
 * wins if duplicates exist; this function only reports the pairing by name.
 *
 * @param {string[]} namesA filenames from the "Batch A" (original) selection.
 * @param {string[]} namesB filenames from the "Batch B" (changed) selection.
 * @returns {{
 *   pairs: Array<{stem: string, nameA: string, nameB: string}>,
 *   unmatchedA: string[],
 *   unmatchedB: string[],
 * }} pairs in namesA's own order; unmatched lists preserve each batch's
 *   own original order too, so an honest "these N files had no match" list
 *   reads predictably.
 */
export function pairFilesByStem(namesA, namesB) {
  // Keyed by stem -> the INDEX (not just the name) of the first unused
  // namesB entry with that stem, so a literal duplicate name in the same
  // batch is tracked precisely -- a second B file sharing a stem with an
  // already-paired one is correctly reported as unmatched, never silently
  // dropped from both the pairs list and the unmatched list at once.
  const bIndexByStem = new Map();
  namesB.forEach((nameB, i) => {
    const s = stemOf(nameB);
    if (!bIndexByStem.has(s)) bIndexByStem.set(s, []);
    bIndexByStem.get(s).push(i);
  });
  const nextBIndexForStem = new Map();

  const pairs = [];
  const usedBIndices = new Set();
  const unmatchedA = [];
  for (const nameA of namesA) {
    const s = stemOf(nameA);
    const candidates = bIndexByStem.get(s);
    const cursor = nextBIndexForStem.get(s) || 0;
    if (candidates && cursor < candidates.length) {
      const bIndex = candidates[cursor];
      nextBIndexForStem.set(s, cursor + 1);
      usedBIndices.add(bIndex);
      pairs.push({ stem: s, nameA, nameB: namesB[bIndex] });
    } else {
      unmatchedA.push(nameA);
    }
  }

  const unmatchedB = namesB.filter((_, i) => !usedBIndices.has(i));

  return { pairs, unmatchedA, unmatchedB };
}

/**
 * Excel worksheet names forbid `: \ / ? * [ ]` and are capped at 31
 * characters -- this produces a safe, still-recognizable sheet name from a
 * matched pair's stem.
 *
 * @param {string} stem
 * @param {Set<string>} usedNames sheet names already assigned in this
 *   workbook -- a collision (two different stems sanitizing to the same 31
 *   characters) gets a numeric suffix rather than silently overwriting the
 *   earlier sheet.
 * @returns {string}
 */
export function sheetNameFor(stem, usedNames) {
  let base = String(stem == null ? '' : stem).replace(/[:\\/?*[\]]/g, '_').trim();
  if (!base) base = 'Sheet';
  base = base.slice(0, 31);
  if (!usedNames.has(base)) return base;
  let n = 2;
  let candidate = `${base.slice(0, 28)}~${n}`;
  while (usedNames.has(candidate)) {
    n += 1;
    candidate = `${base.slice(0, 28)}~${n}`;
  }
  return candidate;
}

/**
 * A leading '=', '+', '@', TAB, or CR makes Excel/Sheets/LibreOffice
 * interpret a cell as a formula when the file is opened -- the OWASP "CSV
 * Injection" class, which applies just as much to a real .xlsx cell value as
 * to CSV text. Duplicated from ../pure/csv.mjs's own (unexported)
 * neutralizeFormulaInjection() rather than imported -- this directory's
 * established "no pure module imports another" convention (see
 * ../pure/csvToXlsx.mjs's own header comment for the same reasoning applied
 * to its NUMBER_RE/parseCsv duplication). Every cell this module's own
 * Excel-report builder writes comes straight from an uploaded CSV file
 * (untrusted input) and is never run back through csv.mjs's CSV-specific
 * escaping, so it needs this same neutralization applied directly.
 */
const DANGEROUS_LEADING_CHAR_RE = /^[=+@\t\r]/;

/**
 * Bank-statement-style negative amounts ('-42.50') are common in real CSV
 * data and must not be corrupted by blanket-prefixing every leading '-' --
 * same carve-out and reasoning as ../pure/csv.mjs's own NEGATIVE_NUMBER_RE.
 */
const NEGATIVE_NUMBER_RE = /^-(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$/;

/**
 * @param {string} value a single cell's text, straight from an uploaded
 *   file (or an "old → new" changed-cell string built from two such
 *   values) -- untrusted either way.
 * @returns {string} value, or value prefixed with a single quote if its
 *   first character would make a spreadsheet application treat the cell as
 *   a formula on open. The single-quote prefix is Excel's own
 *   force-text-not-formula convention, the same fix csv.mjs applies to CSV
 *   output -- it is visible if the cell is later re-exported as plain text,
 *   but never executes as a formula.
 */
export function neutralizeFormulaInjection(value) {
  const str = String(value == null ? '' : value);
  if (str.length === 0) return str;
  if (DANGEROUS_LEADING_CHAR_RE.test(str)) return `'${str}`;
  if (str[0] === '-' && !NEGATIVE_NUMBER_RE.test(str)) return `'${str}`;
  return str;
}

/**
 * @param {object} json the parsed JSON body from Gumroad's
 *   POST https://api.gumroad.com/v2/licenses/verify response -- either
 *   `{success: true, uses: number, purchase: {...}}` or
 *   `{success: false, message: string}` per Gumroad's own documented shape.
 * @returns {{ok: true} | {ok: false, error: string}} never throws on a
 *   malformed/unexpected shape -- treated as a failed verification with a
 *   generic honest message, not a crash.
 */
export function interpretLicenseResponse(json) {
  if (json && json.success === true) return { ok: true };
  if (json && json.success === false && typeof json.message === 'string' && json.message.trim()) {
    return { ok: false, error: json.message.trim() };
  }
  return { ok: false, error: 'That didn’t look like a valid response from the license server - try again in a moment.' };
}
