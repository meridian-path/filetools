'use strict';

module.exports = {
  slug: 'text-diff',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'Text Diff / Compare',
  h1: 'Compare Two Texts',
  title: 'Text Diff / Compare Two Texts Online | filetools',
  metaDescription: 'Paste two texts and see every line and word that changed, highlighted instantly, free and in your browser. No upload, no sign-up.',
  deck: 'Paste two texts and see exactly what changed, line by line and word by word, the moment you stop typing. No upload step, no sign-up, no ads - paste and see.',
  clientEntry: 'textDiff',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  folder: 'text',
  mark: { verb: 'compare' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): the whole differentiator here (see the FAQ
  // below) is paste-and-see with no upload step at all, so this tool has
  // no FILE input and builds its own entire live two-pane panel
  // client-side. maxBytes/accepts/multiple below are unused placeholders
  // for the same reason uuid-generator.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'text-diff',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Paste the original text into the left box and the changed version into the right box (or start from the pre-filled example).',
    'The comparison updates as you type - no button to click. Lines that were added, removed, or changed are highlighted, with the exact words that changed underlined within a changed line.',
    'Toggle "Ignore whitespace" or "Ignore case" if the comparison should treat those differences as unimportant, then copy the result as plain diff text.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Both texts are compared entirely on your device, and nothing is sent to a server - there’s no upload step at all, unlike a tool that makes you choose a file first. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Why paste-and-see instead of uploading two files?',
      answerHtml: 'Comparing text is almost always a copy-paste task (two versions of a paragraph, two config snippets, two emails) rather than a compare-two-files task - a file-upload step would add friction for the common case. This tool skips it entirely: paste into both boxes and the comparison is already there, with no “Compare” button, no ads, and no account.',
    },
    {
      q: 'Does word order matter?',
      answerHtml: 'Yes. The comparison is order-sensitive at both the line and word level, the same way a code diff tool works - "the cat sat" and "sat the cat" are reported as a real change, not treated as a match just because they share the same words. This also means a paragraph that got reordered will show as removed-and-re-added lines rather than "unchanged," which is the honest read.',
    },
    {
      q: 'Can it diff code?',
      answerHtml: 'Yes - code is just text with meaningful line breaks and indentation, and this tool compares both. Leave "Ignore whitespace" off to catch indentation-only changes (the kind that break some languages), or turn it on to compare logic while ignoring formatting differences.',
    },
    {
      q: 'Is there a size limit?',
      answerHtml: 'The line-by-line comparison uses an algorithm whose work grows with both texts’ line counts multiplied together, so an extremely large pair of texts (each in the low thousands of lines or more) may be refused with a message asking for shorter input, rather than freezing the tab. Ordinary pastes - anything from a sentence to a long document - have no practical limit.',
    },
    {
      q: 'What do "Ignore whitespace" and "Ignore case" actually change?',
      answerHtml: 'Both only change which lines COUNT as different - the highlighted text always shows exactly what you pasted, unchanged. "Ignore whitespace" treats two lines as equal if they only differ by leading, trailing, or repeated spacing (so re-indented code doesn’t show as changed). "Ignore case" treats "Hello" and "hello" as equal.',
    },
    {
      q: 'How is a changed line different from a removed line plus an added line?',
      answerHtml: 'A removed-and-inserted line pair is only shown as one "changed" line (with the specific words that differ underlined) when the two lines are similar enough that highlighting a word-level difference is more useful than showing them as unrelated - the same threshold ../pure/csvDiff.mjs’s cell-level diff uses for CSV rows. Two lines that share almost nothing in common are shown as a plain removed line and a plain added line instead.',
    },
  ],
  relatedSlugs: ['compare-csv', 'remove-duplicate-lines', 'word-frequency-counter'],
};
