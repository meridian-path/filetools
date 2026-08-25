'use strict';

module.exports = {
  slug: 'csv-to-json',
  category: 'data',
  launchDate: '2026-08-25',
  navLabel: 'CSV to JSON',
  h1: 'Convert CSV to JSON',
  title: 'Convert CSV to JSON - In Your Browser | filetools',
  metaDescription: 'Paste a CSV or drop a .csv file and get a JSON array back - one object per row, keyed by the header row, free and in your browser.',
  deck: 'Paste CSV data, or drop a .csv file, and download it as a JSON array. Every value stays a string, matching the CSV’s own text - nothing is guessed at.',
  clientEntry: 'csvToJson',
  family: 'csv',
  folder: 'spreadsheets',
  // json-to-csv's own reverse direction is plate:'json', ink:'csv'; this
  // tool is the mirror (plate:'csv', ink:'json') - a combo no other
  // csv-family tool currently uses.
  mark: { verb: 'convert', ink: 'json' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.csv', type: 'text/csv' },
  mode: 'csv-to-json',
  fileTypeLabel: 'CSV file',
  accepts: '.csv,text/csv,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste CSV',
    placeholder: 'name,price\nCoffee,4.50\nTea,3.25',
    buttonLabel: 'Convert pasted CSV',
  },
  howSteps: [
    'Drop or choose a .csv file, or paste CSV text directly into the text box.',
    'Review the preview - every row becomes one JSON object, keyed by the header row.',
    'Download the result as a JSON file.',
  ],
  faqs: [
    {
      q: 'Is my CSV sent anywhere?',
      answerHtml: 'No. Pasted CSV and uploaded files are both read and converted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What CSV shape does this expect?',
      answerHtml: 'A header row followed by one or more data rows, comma-separated, with double-quoted fields for any value containing a comma, quote, or line break (standard RFC 4180 CSV) - the same shape every spreadsheet program exports by default.',
    },
    {
      q: 'Are numbers and true/false converted to real JSON types?',
      answerHtml: 'No, deliberately - every value stays a JSON string, exactly as it appeared in the CSV. CSV itself carries no type information, so guessing at a "real" type risks silently corrupting a value that only looks numeric, like a leading-zero code (<code>0042</code> becoming <code>42</code>) or a phone number. If you need typed values, use <a href="/data/xlsx-to-json/">Excel to JSON</a> instead, which reads real cell types from a genuine spreadsheet file.',
    },
    {
      q: 'What happens to a blank or repeated column header?',
      answerHtml: 'A blank header cell becomes <code>column_N</code> (its 1-indexed position); a repeated header name gets a trailing <code>_2</code>, <code>_3</code>, and so on - so every JSON key is always unique and non-empty, and no column silently overwrites another.',
    },
    {
      q: 'What if a row has more or fewer fields than the header?',
      answerHtml: 'A short row gets an empty string for its missing trailing fields; a long row has its extra trailing fields dropped. No column ever shifts out of place because of a ragged row.',
    },
  ],
  relatedSlugs: ['csv-to-xlsx', 'json-to-csv', 'csv-to-sql-insert', 'flatten-json'],
};
