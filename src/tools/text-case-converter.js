'use strict';

module.exports = {
  slug: 'text-case-converter',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'Text Case Converter',
  h1: 'Convert Text Case',
  title: 'Text Case Converter Online | filetools',
  metaDescription: 'Paste text or drop a .txt file and get UPPERCASE, lowercase, Title Case, camelCase, snake_case, and kebab-case all at once, free and in your browser.',
  deck: 'Paste any text, or drop a .txt file, and get all six cases at once: UPPERCASE, lowercase, Title Case, camelCase, snake_case, and kebab-case. Nothing is sent anywhere.',
  clientEntry: 'textCaseConverter',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.txt', type: 'text/plain' },
  mode: 'text-case-converter',
  fileTypeLabel: 'text file',
  accepts: '.txt,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste text',
    placeholder: 'hello world\nsecond line here',
    buttonLabel: 'Convert pasted text',
  },
  howSteps: [
    'Drop or choose a .txt file, or paste text directly into the text box - one item per line works too.',
    'All six cases render immediately: UPPERCASE, lowercase, Title Case, camelCase, snake_case, and kebab-case.',
    'Copy or download whichever case you need. A multi-line paste converts one line at a time, so a pasted list keeps its line breaks in every case.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What’s the difference between Title Case, camelCase, snake_case, and kebab-case?',
      answerHtml: 'Title Case capitalizes each word and keeps spaces (<code>Hello World</code>) - the style used for headings and proper nouns. camelCase runs words together with no separator, lowercasing the first word and capitalizing the rest (<code>helloWorld</code>) - the common convention for variable and function names in JavaScript, Java, and similar languages. snake_case (<code>hello_world</code>) and kebab-case (<code>hello-world</code>) both lowercase every word and join them with an underscore or hyphen - snake_case is common in Python and database column names, kebab-case in URLs and CSS class names.',
    },
    {
      q: 'Does this understand text that’s already in one of these cases?',
      answerHtml: 'Yes. Pasting <code>helloWorld</code>, <code>hello_world</code>, or <code>hello-world</code> all produce the exact same six outputs, since this tool splits your input into words first (recognizing camelCase boundaries, underscores, hyphens, and spaces alike) before rebuilding each case from those words - it converts between any of the six, not just from plain sentences.',
    },
    {
      q: 'Can I convert a whole list at once, not just one word or phrase?',
      answerHtml: 'Yes. Paste (or upload a .txt file with) one item per line and every line converts independently, keeping its own line in every case’s output - a 50-line list of column names converts to 50 lines of snake_case just as easily as one phrase does.',
    },
    {
      q: 'What happens to numbers and punctuation?',
      answerHtml: 'UPPERCASE and lowercase only change letter case, so numbers and punctuation pass through completely untouched. The other four cases (Title Case, camelCase, snake_case, kebab-case) rebuild each line from its words, so punctuation between words (commas, extra spaces, existing hyphens or underscores) is normalized away in those four the same way it would be by any word-based case converter - a number stays attached to whichever word it was touching.',
    },
  ],
  relatedSlugs: ['remove-duplicate-lines', 'sort-lines', 'word-frequency-counter'],
};
