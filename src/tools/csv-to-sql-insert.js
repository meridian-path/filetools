'use strict';

module.exports = {
  slug: 'csv-to-sql-insert',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'CSV to SQL INSERT',
  h1: 'Convert CSV to SQL INSERT Statements',
  title: 'CSV to SQL INSERT Generator | filetools',
  metaDescription: 'Paste CSV or drop a .csv file and get ready-to-run SQL INSERT statements for MySQL, PostgreSQL, SQL Server, or Oracle, free and in your browser.',
  deck: 'Paste CSV data, or drop a .csv file, and get ready-to-run SQL INSERT statements for the database of your choice. Nothing is sent anywhere.',
  clientEntry: 'csvToSqlInsert',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'csv',
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.csv', type: 'text/csv' },
  mode: 'csv-to-sql-insert',
  fileTypeLabel: 'CSV file',
  accepts: '.csv,text/csv',
  multiple: false,
  pasteInput: {
    label: 'Or paste CSV',
    placeholder: 'id,name,price\n1,Widget,9.99\n2,Gadget,14.50',
    buttonLabel: 'Convert pasted CSV',
  },
  howSteps: [
    'Drop or choose a .csv file, or paste CSV data directly into the text box. The first row is treated as column names.',
    'A ready-to-run INSERT statement renders immediately, with each column typed automatically: a column where every value looks like a plain number is inserted unquoted, everything else is a quoted, properly escaped string.',
    'Set the table name, pick MySQL, PostgreSQL, SQL Server, or Oracle for correct identifier quoting, and choose one batched statement or one INSERT per row. Copy or download the SQL you need.',
  ],
  faqs: [
    {
      q: 'Is my CSV sent anywhere?',
      answerHtml: 'No. Pasted CSV and uploaded files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How does this decide whether a column should be quoted as text or left as a number?',
      answerHtml: 'Every value in a column is checked: only if <em>every</em> value in that column looks like a plain integer or decimal number (an optional minus sign, digits, an optional decimal point and more digits) is the whole column treated as numeric and left unquoted. A single non-numeric-looking value anywhere in the column - even a leading-zero code like <code>0042</code> that some systems use for IDs - keeps the entire column quoted as text, since a wrongly-unquoted value would produce invalid or silently wrong SQL.',
    },
    {
      q: 'What happens to an empty cell?',
      answerHtml: 'It becomes <code>NULL</code> (unquoted, the standard SQL way to represent a missing value) regardless of what type the rest of that column is.',
    },
    {
      q: 'What does the dialect selector actually change?',
      answerHtml: 'Only how table and column names are quoted: backticks for MySQL, double quotes for PostgreSQL and Oracle, square brackets for SQL Server. Value literals - strings, numbers, and <code>NULL</code> - are formatted identically across all four, since that part of SQL syntax is shared by every one of them.',
    },
    {
      q: 'What’s the difference between one batched statement and one INSERT per row?',
      answerHtml: 'A single batched statement (<code>INSERT INTO t (...) VALUES (...), (...), (...);</code>) is faster for a database to execute and is the default. One INSERT per row generates a separate statement for every row instead - useful if you need to run them individually, log each one, or paste them into a tool that only accepts one statement at a time.',
    },
  ],
  relatedSlugs: ['json-to-csv', 'merge-csv', 'html-table-to-csv'],
};
