'use strict';

module.exports = {
  slug: 'sql-formatter',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'SQL Formatter',
  h1: 'Format and Minify SQL',
  title: 'SQL Formatter and Beautifier Online | filetools',
  metaDescription: 'Paste a SQL query or drop a .sql file and get both a beautified (indented, readable) and a minified version instantly, free and in your browser.',
  deck: 'Paste any SQL query, or drop a .sql file, and see the beautified and minified versions side by side, updated instantly. Nothing is sent anywhere.',
  clientEntry: 'sqlFormatter',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  folder: 'developer',
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.sql', type: 'text/plain' },
  mode: 'sql-formatter',
  fileTypeLabel: 'SQL file',
  accepts: '.sql,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste SQL',
    placeholder: 'select id, name, email from users where active = true order by name',
    buttonLabel: 'Format pasted SQL',
  },
  howSteps: [
    'Drop or choose a .sql file, or paste a query directly into the text box.',
    'The beautified (readable, indented) and minified (single-line) versions both render immediately.',
    'Pick a dialect if you need MySQL backticks, SQL Server brackets, or standard double-quoted identifiers recognized correctly. Copy or download whichever result you need.',
  ],
  faqs: [
    {
      q: 'Is my SQL sent anywhere?',
      answerHtml: 'No. Pasted SQL and uploaded files are both read and reformatted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does this fully understand every SQL dialect (MySQL, PostgreSQL, T-SQL, SQLite, BigQuery, Snowflake)?',
      answerHtml: 'Honestly, not as a full grammar - this tool reformats based on recognized keywords and structure rather than parsing SQL as a complete, dialect-specific language (writing a correct parser for even one of these dialects, let alone six, is a genuinely large undertaking, and a subtly wrong parser would be worse than an honest reformatter). What the dialect selector actually changes: which characters are recognized as a quoted identifier - backticks for MySQL/BigQuery, square brackets for SQL Server, double quotes for the rest - so <code>[Order Date]</code> or <code>`user id`</code> is never mistaken for stray punctuation. It does not validate that your SQL is correct, and it does not know about dialect-specific statement forms.',
    },
    {
      q: 'Does the beautified version change what my query does?',
      answerHtml: 'No. Every keyword, identifier, string, number, and comment is preserved exactly - only whitespace changes (line breaks, indentation, and spacing), plus keywords are uppercased for readability. A string literal like <code>\'Some, text (here)\'</code> is never touched even though it contains characters that look like SQL punctuation.',
    },
    {
      q: 'Why does a function call like COUNT(id) stay on one line instead of being indented like a subquery?',
      answerHtml: 'This tool tells the two apart by what immediately follows the opening parenthesis: a real subquery starts with <code>SELECT</code> or <code>WITH</code> and gets its own indented block, while anything else - a function call, a column list, a <code>VALUES</code> list - stays on the same line it started on. That matches how a person would actually want a query laid out: <code>COUNT(id)</code> reads better inline than broken across three lines.',
    },
    {
      q: 'What happens to comments in my query?',
      answerHtml: 'The beautified version keeps both <code>-- line</code> comments and <code>/* block */</code> comments exactly where they were. The minified version removes all comments, the same way any other code minifier does, since a minified query is meant for a machine to run, not a person to read.',
    },
  ],
  relatedSlugs: ['json-minify-beautify', 'csv-to-sql-insert', 'text-case-converter'],
};
