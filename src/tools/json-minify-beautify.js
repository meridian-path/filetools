'use strict';

module.exports = {
  slug: 'json-minify-beautify',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'JSON Minify/Beautify',
  h1: 'Minify and Beautify JSON',
  title: 'Minify and Beautify JSON Online | filetools',
  metaDescription: 'Paste JSON or drop a .json file and get both the minified and beautified (pretty-printed) versions instantly, free and in your browser. No upload, no sign-up.',
  deck: 'Paste any JSON, or drop a .json file, and see the minified and beautified versions side by side, updated instantly. Nothing is sent anywhere.',
  clientEntry: 'jsonMinifyBeautify',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'json',
  folder: 'data-formats',
  mark: { verb: 'convert', ink: 'json' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.json', type: 'application/json' },
  mode: 'json-minify-beautify',
  fileTypeLabel: 'JSON file',
  accepts: '.json,application/json,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste JSON',
    placeholder: '{\n  "name": "Ada",\n  "roles": ["admin", "editor"]\n}',
    buttonLabel: 'Minify and beautify pasted JSON',
  },
  howSteps: [
    'Drop or choose a .json file, or paste JSON directly into the text box.',
    'Both the minified (no whitespace) and beautified (indented, one field per line) versions render immediately.',
    'Pick 2 spaces, 4 spaces, or a tab for the beautified indent if you need it to match your codebase. Copy or download whichever result you need.',
  ],
  faqs: [
    {
      q: 'Is my JSON sent anywhere?',
      answerHtml: 'No. Pasted JSON and uploaded files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What’s the difference between minify and beautify?',
      answerHtml: 'Minifying strips every character that isn’t part of the data itself - spaces, newlines, indentation - producing the smallest valid JSON text, which is what you want before shipping a config file or API response. Beautifying does the opposite: it adds consistent indentation and line breaks so a human can read the structure at a glance. Both are the exact same data, just formatted differently - this tool computes both from whatever you paste, so you never have to choose one and lose the other.',
    },
    {
      q: 'Why does it say my JSON isn’t valid?',
      answerHtml: 'JSON has stricter rules than JavaScript object literals: keys and string values need double quotes (not single quotes), there’s no trailing comma after the last item, and comments aren’t allowed. The error message names the exact problem your browser’s own JSON parser found, in the same words it would give a developer, so you can jump straight to the spot instead of scanning the whole file.',
    },
    {
      q: 'Does this change the order of my object’s keys, or the type of any value?',
      answerHtml: 'No. Both the minified and beautified output preserve key order exactly as written, and every value keeps its original type - a number stays a number, a string stays a string, <code>true</code>/<code>false</code>/<code>null</code> stay exactly as they were. Only whitespace changes.',
    },
    {
      q: 'Can I choose 4 spaces or tabs instead of 2 spaces for the beautified version?',
      answerHtml: 'Yes - the indent dropdown above the beautified panel switches between 2 spaces, 4 spaces, and a tab, and the result updates immediately with no need to re-paste or re-upload.',
    },
    {
      q: 'What happens with a very large JSON file?',
      answerHtml: 'Files up to 20MB are accepted. Both panels show a preview of very large results (with a note that it’s been shortened) so the page itself stays responsive - download or copy the result to get the complete, untruncated text either way.',
    },
  ],
  relatedSlugs: ['json-to-csv', 'flatten-json', 'sql-formatter'],
};
