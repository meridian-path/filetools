'use strict';

module.exports = {
  slug: 'csv-to-xlsx',
  category: 'data',
  launchDate: '2026-08-25',
  navLabel: 'CSV to Excel (XLSX)',
  h1: 'Convert CSV to Excel (XLSX)',
  title: 'Convert CSV to Excel (XLSX) - In Your Browser | filetools',
  metaDescription: 'Paste a CSV or drop a .csv file and download a real .xlsx workbook - numeric columns become real Excel numbers, free and in your browser.',
  deck: 'Paste CSV data, or drop a .csv file, and download it as a genuine .xlsx workbook that opens directly in Excel or Sheets.',
  clientEntry: 'csvToXlsx',
  family: 'csv',
  folder: 'spreadsheets',
  // xlsx-to-csv's own reverse direction is plate:'sheet', ink:'csv'; this
  // tool is the mirror (plate:'csv', ink:'sheet') - a combo no other
  // csv-family tool currently uses.
  mark: { verb: 'convert', ink: 'sheet' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.csv', type: 'text/csv' },
  mode: 'csv-to-xlsx',
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
    'Review the preview - every row and column carries over, with numeric columns detected automatically.',
    'Download the result as a genuine .xlsx workbook, ready to open in Excel or Sheets.',
  ],
  faqs: [
    {
      q: 'Is my CSV sent anywhere?',
      answerHtml: 'No. Pasted CSV and uploaded files are both read and converted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Which columns become real Excel numbers?',
      answerHtml: 'Only a column where every value looks like a plain integer or decimal - a single non-numeric-looking value anywhere in the column keeps the entire column as text, since guessing at a real type risks silently corrupting a value that only looks numeric, like a leading-zero code (<code>0042</code> becoming <code>42</code>).',
    },
    {
      q: 'Is this different from just renaming a .csv file to .xlsx?',
      answerHtml: 'Yes - a renamed .csv is still plain text and most spreadsheet programs will refuse to open it, or open it incorrectly. This tool builds a genuine binary .xlsx workbook (the real Office Open XML format) that opens correctly in Excel, Google Sheets, or LibreOffice.',
    },
    {
      q: 'Does the output have a header row?',
      answerHtml: 'Yes - the CSV’s own first row becomes the workbook’s first row, unstyled, exactly as it appeared in the source. This tool doesn’t add bold formatting or freeze panes.',
    },
    {
      q: 'Is there a limit on file size?',
      answerHtml: 'Uploads are capped at 20MB. Since everything runs in your browser rather than on a server, a very large CSV is more likely to be limited by your device’s own memory than by that cap.',
    },
  ],
  relatedSlugs: ['csv-to-json', 'xlsx-to-csv', 'csv-to-sql-insert', 'xlsx-to-json'],
};
