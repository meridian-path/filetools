'use strict';

module.exports = {
  slug: 'regex-tester',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-24',
  navLabel: 'Regex Tester',
  h1: 'Test Regular Expressions',
  title: 'Regex Tester and Debugger - Live Matches | filetools',
  metaDescription: 'Test JavaScript regular expressions with live match highlighting and a capture-group breakdown, updated as you type, free and in your browser.',
  deck: 'Type a pattern and a test string, and see every match highlighted live, with each capture group broken out.',
  clientEntry: 'regexTester',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  // Craft-audit fix (item 7): was 'text', which made this genuine
  // developer-utility tool indistinguishable (identical icon + "Text" Kind
  // chip) from an actual plain-text tool like sort-lines.js in the
  // file-browser listing -- 'dev' is its own family now (src/icons.js's
  // devMotif(), folders.js's pre-existing 'dev' folder-color axis).
  family: 'dev',
  folder: 'developer',
  mark: { verb: 'convert' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): this tool's pattern + test string should
  // update on every keystroke, not wait for a "Convert" click, so it has
  // no FILE input and builds its own entire live panel client-side.
  // maxBytes/accepts/multiple below are unused placeholders for the same
  // reason uuid-generator.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'regex-tester',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Type or paste a regular expression pattern, and choose which flags apply (g for every match, i for case-insensitive, and so on).',
    'Paste the text you want to test it against. Every match highlights immediately as you type either field - no button to click.',
    'If your pattern has capture groups, each match’s groups are broken out into their own table below, by number or name.',
  ],
  faqs: [
    {
      q: 'Is my pattern or text sent anywhere?',
      answerHtml: 'No. Matching runs entirely on your device - in a background thread inside your own browser - and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Why does matching run in a background thread instead of instantly?',
      answerHtml: 'A regular expression can be written (often by accident) in a way that makes a single match attempt take an extremely long time against certain text - this is called catastrophic backtracking, and a pattern like <code>(a+)+b</code> against a long run of "a"s with no trailing "b" is a classic example. That single match call can’t be interrupted from JavaScript once it starts. Running it in a background thread means this tool can forcibly stop a stuck match after a few seconds and tell you what happened, instead of freezing the whole page.',
    },
    {
      q: 'What regex flavor does this use?',
      answerHtml: 'Your browser’s own native JavaScript RegExp engine - the exact same engine that runs a regex literal like <code>/foo/gi</code> in any JavaScript code, so a pattern that works here will behave identically in your own JavaScript.',
    },
    {
      q: 'What do the flag checkboxes do?',
      answerHtml: '<code>g</code> (global) finds every match instead of stopping at the first. <code>i</code> ignores case. <code>m</code> (multiline) makes <code>^</code> and <code>$</code> match at the start/end of each line, not just the whole string. <code>s</code> (dotAll) makes <code>.</code> match newline characters too, which it otherwise doesn’t. <code>u</code> enables full Unicode handling (correct matching of characters outside the Basic Multilingual Plane, and stricter pattern validation).',
    },
    {
      q: 'How are capture groups shown?',
      answerHtml: 'Every match that has capture groups gets its own rows in the table below the highlighted text - one row per group, showing the group’s number (or name, for a named group like <code>(?&lt;year&gt;\\d{4})</code>) and the exact text it captured. A group inside an alternative that didn’t match (like the "a" branch of <code>(a)|(b)</code> when "b" is what matched) shows as "no match" rather than a blank or misleading value.',
    },
  ],
  relatedSlugs: ['unix-timestamp-converter', 'text-case-converter', 'word-frequency-counter', 'url-encode-decode'],
};
