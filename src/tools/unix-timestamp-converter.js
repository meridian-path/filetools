'use strict';

module.exports = {
  slug: 'unix-timestamp-converter',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'Unix Timestamp Converter',
  h1: 'Convert Unix Timestamps',
  title: 'Unix Timestamp / Epoch Converter | filetools',
  metaDescription: 'Convert a Unix timestamp to a human-readable date and back, in seconds or milliseconds, with explicit UTC and local time, free and in your browser.',
  deck: 'Convert a Unix/epoch timestamp to a readable date, or a date back to a timestamp, in seconds or milliseconds, with both UTC and your local time shown explicitly. Nothing is sent anywhere.',
  clientEntry: 'unixTimestampConverter',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  // 'dev' -- genuine developer-utility tool with no file-format input or
  // output of its own, same rationale as regex-tester.js/uuid-generator.js's
  // own comment on this field.
  family: 'dev',
  folder: 'developer',
  mark: { verb: 'convert' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): both conversion directions update live as you
  // type, so there is no FILE input and this builds its own entire panel
  // client-side. maxBytes/accepts/multiple below are unused placeholders
  // for the same reason regex-tester.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'unix-timestamp-converter',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Type a timestamp into "Timestamp to date" - the unit (seconds or milliseconds) is auto-detected from its length, or pick one explicitly.',
    'Read the result in both UTC and your browser’s own local time zone, shown side by side rather than guessed at silently.',
    'Or pick a date and time in "Date to timestamp", choose whether you typed it in UTC or local time, and get the matching timestamp in both seconds and milliseconds.',
  ],
  faqs: [
    {
      q: 'Is my input sent anywhere?',
      answerHtml: 'No. Every conversion runs entirely on your device using your browser’s own built-in date handling - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How does the tool know if I typed seconds or milliseconds?',
      answerHtml: 'By length: a real-world Unix timestamp in seconds is 10 digits today and won’t reach 11 until the year 2286, while a real-world timestamp in milliseconds has been 13 digits since 2001. The tool treats anything under 100 billion as seconds and anything at or above it as milliseconds - correct for any realistic date - but you can override the guess with the unit selector if you’re testing an edge case.',
    },
    {
      q: 'What is a Unix timestamp?',
      answerHtml: 'The number of seconds (or milliseconds, in JavaScript and many web APIs) that have passed since <code>1970-01-01 00:00:00 UTC</code>, the "Unix epoch." It’s how most databases, APIs, and log files store a point in time as a single number instead of a formatted date string.',
    },
    {
      q: 'Why does the result show both UTC and local time?',
      answerHtml: 'A timestamp itself has no time zone - it’s a count of seconds, the same number everywhere on Earth - but the date and time it represents look different depending on which time zone you read it in. Showing both explicitly (rather than only your browser’s local time, silently) avoids the classic off-by-several-hours bug that happens when a UTC timestamp gets displayed as if it were already local.',
    },
    {
      q: 'When I convert a date back to a timestamp, which time zone does it use?',
      answerHtml: 'Whichever you pick with the UTC/local toggle next to the date picker. If you choose local, the date and time you entered are treated as your browser’s own time zone; if you choose UTC, they’re treated as already being UTC clock time, regardless of where you are.',
    },
    {
      q: 'What is the "Right now" section for?',
      answerHtml: 'A live reference point - the current Unix timestamp in both seconds and milliseconds, and the current UTC/local date and time, updating every second. Useful for sanity-checking that a timestamp you’re debugging is actually close to "now," or copying the current timestamp directly.',
    },
  ],
  relatedSlugs: ['uuid-generator', 'hash-generator', 'regex-tester'],
};
