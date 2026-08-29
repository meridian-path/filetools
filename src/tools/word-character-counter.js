'use strict';

module.exports = {
  slug: 'word-character-counter',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'Word & Character Counter',
  h1: 'Count Words & Characters',
  title: 'Word & Character Counter - Free Text Counter | filetools',
  metaDescription: 'Paste any text and watch word count, character count, sentence count, and reading time update live as you type, free and in your browser. No upload, no sign-up.',
  deck: 'Paste or type any text and watch the word count, character count, sentence count, and reading time update on every keystroke. Nothing is sent anywhere.',
  clientEntry: 'wordCharacterCounter',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  folder: 'text',
  mark: { verb: 'count' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): this tool's stats should update on every
  // keystroke, not wait for a "Convert" click or a file, so it has no
  // FILE input and builds its own entire live panel client-side, the same
  // shape regex-tester.js uses for its own live pattern/text pair.
  // maxBytes/accepts/multiple below are unused placeholders for the same
  // reason regex-tester.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'word-character-counter',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Paste or type any text into the box - there is no file to drop or button to click.',
    'Word count, character count (with and without spaces), sentence count, and estimated reading time all update immediately as you type.',
    'Come back anytime - nothing you type is saved or sent anywhere, so there is nothing to clear or delete.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Everything you type is counted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does the character count include spaces?',
      answerHtml: 'Both counts are shown - one including every space, tab, and line break, and one counting only non-whitespace characters - so you can use whichever number a platform’s own limit (a tweet, a meta description, a form field) actually counts by.',
    },
    {
      q: 'What counts as a "word"?',
      answerHtml: 'Any run of non-space characters, split on whitespace. That keeps the count correct for languages that don’t primarily use spaces between letters the way English does, and for text with no ASCII letters at all - a letter-pattern tuned for English would undercount or zero out that kind of text entirely.',
    },
    {
      q: 'How is the sentence count calculated?',
      answerHtml: 'By counting runs of <code>.</code>, <code>!</code>, or <code>?</code> that end a chunk of text, so an ellipsis (<code>...</code>) or a double punctuation mark (<code>?!</code>) counts as one sentence boundary, not two or three. This is a mechanical estimate, not real grammar parsing - an abbreviation like "Mr. Smith" still reads as a sentence break, the same limitation every simple sentence counter has.',
    },
    {
      q: 'How is reading time estimated?',
      answerHtml: 'From the word count, at 200 words per minute - a commonly cited average adult silent-reading speed. It’s an estimate for typical prose, not a measurement of your own reading speed, and rounds up (never down) so "1 min read" always means genuinely under two minutes.',
    },
    {
      q: 'Does this handle non-English text correctly?',
      answerHtml: 'Character and sentence counts work for any language. Word counts are most meaningful for languages that separate words with spaces (English, Spanish, Russian, and many others) - for a language that doesn’t use spaces between words at all (Chinese, Japanese), the character count is the more useful number.',
    },
  ],
  relatedSlugs: ['word-frequency-counter', 'text-case-converter', 'remove-duplicate-lines'],
};
