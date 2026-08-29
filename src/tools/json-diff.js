'use strict';

module.exports = {
  slug: 'json-diff',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'JSON Diff / Compare',
  h1: 'Compare Two JSON Values',
  title: 'JSON Diff / Compare Two JSON Files Online | filetools',
  metaDescription: 'Paste two JSON values and see every key that was added, removed, or changed, free and in your browser. Ignores key order. No upload.',
  deck: 'Paste two JSON values and see exactly what was added, removed, or changed, the moment you stop typing. Key order never matters - only real value differences do.',
  clientEntry: 'jsonDiff',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'json',
  folder: 'data-formats',
  mark: { verb: 'compare' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): same paste-and-see reasoning as text-diff.js's
  // own comment on this field - no file input, no upload step, this tool
  // builds its own entire live two-textarea panel client-side.
  // maxBytes/accepts/multiple below are unused placeholders for the same
  // reason uuid-generator.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'json-diff',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Paste the original JSON into the left box and the changed version into the right box (or start from the pre-filled example).',
    'The comparison updates as you type - no button to click. Every key that was added, removed, or changed is highlighted; keys that only moved position are not.',
    'Copy the result as plain diff text once you’re done.',
  ],
  faqs: [
    {
      q: 'Is my JSON sent anywhere?',
      answerHtml: 'No. Both values are compared entirely on your device, and nothing is sent to a server - there’s no upload step at all. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does key order matter?',
      answerHtml: 'No, and this is the main reason to use a JSON-aware diff instead of a plain text diff on the same content: two objects with identical keys and values in a different order compare as identical here. A plain-text diff (this site’s own <a href="/data/text-diff/">Text Diff / Compare</a> tool) would report every line as changed just because the keys moved - genuinely useful for comparing source code or prose, genuinely misleading for comparing two JSON documents that happen to serialize their keys in a different order.',
    },
    {
      q: 'How are elements added to or removed from an array shown?',
      answerHtml: 'An element inserted or removed anywhere in an array - not just at the end - is recognized as exactly that one insertion or removal, with every other element still reported unchanged. The one honest limitation: if an inserted or removed element sits next to OTHER elements that were independently modified around the same time, this tool may pair a modified element with the wrong neighbor instead of catching the insertion cleanly - rare in practice, and the same tradeoff this site’s own CSV-compare tool already accepts and discloses for the equivalent case.',
    },
    {
      q: 'What happens if I paste invalid JSON?',
      answerHtml: 'You’ll see a specific message naming which side (left or right, or both) failed to parse and why, rather than a blank result or a generic error - fix the JSON in that box and the comparison picks back up automatically.',
    },
    {
      q: 'Is there a limit on how deeply nested my JSON can be?',
      answerHtml: 'The comparison stops recursing past 500 levels of nesting - far beyond any realistic document (a typical API response or config file is well under 20 levels deep) - as a safety limit against freezing or crashing the tab on a pathologically deep input. Past that depth, the affected part is conservatively reported as “changed” even if it’s actually identical, rather than risk a crash trying to check - an honest tradeoff for a case this unlikely to matter in practice.',
    },
    {
      q: 'Does this show a nested change inside a modified array element, or just “this element changed”?',
      answerHtml: 'When two elements at the same array position share enough content to look like the same thing modified (not two unrelated values), this tool recursively diffs them and shows exactly which nested key changed - not just a blanket “this element is different.” Two genuinely unrelated values landing at the same position are shown as one removed and one added, not forced into a misleading nested comparison.',
    },
    {
      q: 'Can I diff two JSON files, not just pasted text?',
      answerHtml: 'This tool is paste-and-see by design (see the FAQ on this site’s own `json-minify-beautify` tool for the same reasoning) - open each file in a text editor, copy its contents, and paste. A file-upload step would add friction for the common case (comparing two API responses, two config snippets) without adding real capability, since the comparison itself only ever needs the text either way.',
    },
  ],
  relatedSlugs: ['json-minify-beautify', 'text-diff', 'compare-csv'],
};
