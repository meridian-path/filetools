/**
 * The shared paste-box's empty-input error message -- one function used by
 * every tool with a `pasteInput` field (src/browser/dropzone.client.js).
 * Used to be a single hardcoded string, "Paste some markup first, or
 * choose a file instead.", for every tool regardless of what it actually
 * accepts -- correct for html-table-to-csv, wrong for a CSV/JSON/SQL/plain-
 * text tool, which is not markup. Derived instead from the tool's own
 * visible paste-box label (`pasteInput.label`, e.g. "Or paste JSON") so the
 * error can never drift out of sync with what the label right above the box
 * already says -- the GOV.UK error-wording principle this fix is citing:
 * error text should match the field it describes.
 */

/**
 * @param {string} label the tool's own `pasteInput.label` (e.g. "Or paste
 *   CSV", "Or paste a list") -- read from the rendered DOM by the caller,
 *   never hardcoded, so this can never disagree with the visible label.
 * @returns {string} e.g. "Paste some JSON first, or choose a file instead."
 *   A noun that already carries its own article ("a list") skips the extra
 *   "some" ("Paste a list first...") so the sentence stays grammatical --
 *   "Paste some a list first" would not.
 */
export function pasteEmptyErrorMessage(label) {
  const noun = String(label || '').replace(/^Or paste /i, '').trim() || 'something';
  const hasOwnArticle = /^(a|an)\s/i.test(noun);
  return `Paste ${hasOwnArticle ? noun : `some ${noun}`} first, or choose a file instead.`;
}
