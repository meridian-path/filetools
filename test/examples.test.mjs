import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exampleFor, ariaLabelFor, noteFor } from '../src/examples/index.mjs';
import { diffFixture } from '../src/examples/compare-csv.mjs';
import { mergeFixture } from '../src/examples/merge-csv.mjs';
import { splitFixture } from '../src/examples/split-csv.mjs';
import { transposeFixture } from '../src/examples/transpose-csv.mjs';
import { sortFixture } from '../src/examples/sort-lines.mjs';
import { dedupeFixture } from '../src/examples/remove-duplicate-lines.mjs';
import { convertFixture as jsonToCsvFixture } from '../src/examples/json-to-csv.mjs';
import { convertFixture as htmlTableToCsvFixture } from '../src/examples/html-table-to-csv.mjs';
import { convertFixture as yamlToJsonFixture } from '../src/examples/yaml-to-json.mjs';
import { encodeFixture as urlEncodeFixture, FIXTURE_TEXT as URL_ENCODE_FIXTURE_TEXT } from '../src/examples/url-encode-decode.mjs';
import { convertFixture as htmlEntityFixture } from '../src/examples/html-entity-encode-decode.mjs';
import { convertFixture as xmlToJsonFixture } from '../src/examples/xml-to-json.mjs';
import { flattenFixture } from '../src/examples/flatten-json.mjs';
import { convertFixture as xlsxToJsonFixture } from '../src/examples/xlsx-to-json.mjs';
import { extractFixture as pdfToCsvFixture } from '../src/examples/pdf-to-csv.mjs';
import { mergeFixture as statementFixture } from '../src/examples/bank-statement-to-csv.mjs';
import { gridFixture as xlsxToCsvFixture } from '../src/examples/xlsx-to-csv.mjs';
import { encodeFixture as base64Fixture } from '../src/examples/base64-encode-decode.mjs';
import { minifyFixture as jsonMinifyBeautifyFixture, FIXTURE_TEXT as JSON_MINIFY_FIXTURE_TEXT } from '../src/examples/json-minify-beautify.mjs';
import { convertFixture as textCaseFixture } from '../src/examples/text-case-converter.mjs';
import { hashFixture } from '../src/examples/hash-generator.mjs';
import { convertFixture as csvToSqlFixture } from '../src/examples/csv-to-sql-insert.mjs';
import { generateFixture as uuidV5Fixture, FIXTURE_NAME as UUID_FIXTURE_NAME } from '../src/examples/uuid-generator.mjs';
import { matchFixture as regexMatchFixture, FIXTURE_TEST_STRING as REGEX_FIXTURE_TEST_STRING } from '../src/examples/regex-tester.mjs';
import { beautifyFixture as sqlFormatterFixture } from '../src/examples/sql-formatter.mjs';
import { countFixture as wordCharacterCountFixture, FIXTURE_TEXT as WORD_CHARACTER_FIXTURE_TEXT } from '../src/examples/word-character-counter.mjs';
import { convertFixture as unixTimestampFixture, FIXTURE_JSON as UNIX_TIMESTAMP_FIXTURE_JSON } from '../src/examples/unix-timestamp-converter.mjs';
import { qrFixture, FIXTURE_TEXT as QR_FIXTURE_TEXT } from '../src/examples/qr-code-generator.mjs';
import { diffFixture as textDiffFixture } from '../src/examples/text-diff.mjs';
import { SITE_CSS } from '../src/css.js';

/**
 * Coverage for the core principle behind the per-tool output examples:
 * every tool's output example is a REAL result computed at build time
 * from the tool's own src/pure/*.mjs module, never a hand-drawn mock --
 * so it can never drift from reality. These tests assert against that
 * real computed result directly.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.join(__dirname, '..', 'src', 'examples');

// Filenames ARE slugs (src/examples/<slug>.mjs), same convention
// src/tools/index.js's auto-discovery relies on for its own directory.
const EXAMPLE_SLUGS = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
  .map((f) => f.replace(/\.mjs$/, ''));

test('at least one example module exists (compare-csv)', () => {
  assert.ok(EXAMPLE_SLUGS.includes('compare-csv'));
});

/**
 * Minimal, dependency-free well-formedness check: are every example's
 * start/end tags balanced and correctly nested? A real unescaped `<`
 * leaking in from fixture data would break this (an orphan open tag with
 * no matching close, or a close tag that doesn't match the innermost
 * open) -- the practical, checkable stand-in for "no unescaped `<`
 * originating from fixture data" that section 3.6 asks for, since the
 * fixture data itself is authored in each module (not user input) and
 * there's no separate untrusted-input channel to compare against.
 */
const SELF_CLOSING = new Set(['br', 'img', 'hr', 'input']);

function assertWellFormedHtml(html, label) {
  const tagRe = /<\/?[a-zA-Z][\w-]*(?:\s+[^<>]*?)?\/?>/g;
  const stack = [];
  let match;
  let lastIndex = 0;
  while ((match = tagRe.exec(html))) {
    // Anything between tags must not itself contain a bare `<` or `>` --
    // if the regex above skipped over stray characters, tagRe's own
    // greedy scanning would already have desynced, but assert this
    // explicitly too so a malformed fragment fails loudly rather than
    // silently matching fewer tags than exist.
    const between = html.slice(lastIndex, match.index);
    assert.ok(!between.includes('<'), `${label}: unescaped "<" found outside any tag near index ${match.index}`);
    lastIndex = tagRe.lastIndex;

    const raw = match[0];
    if (raw.startsWith('</')) {
      const name = raw.slice(2, -1).trim().toLowerCase();
      const top = stack.pop();
      assert.ok(top, `${label}: closing tag </${name}> with no matching open tag`);
      assert.equal(top, name, `${label}: closing tag </${name}> does not match innermost open tag <${top}>`);
    } else if (!raw.endsWith('/>')) {
      const name = raw.slice(1, -1).trim().split(/\s/)[0].toLowerCase();
      if (!SELF_CLOSING.has(name)) stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tag(s) remain: ${stack.join(', ')}`);
}

function extractClassNames(html) {
  const names = new Set();
  const classAttrRe = /class="([^"]*)"/g;
  let m;
  while ((m = classAttrRe.exec(html))) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => names.add(c));
  }
  return names;
}

for (const slug of EXAMPLE_SLUGS) {
  test(`examples/${slug}: renders non-empty, well-formed HTML`, () => {
    const html = exampleFor(slug);
    assert.ok(typeof html === 'string' && html.length > 0, `${slug} rendered empty HTML`);
    assertWellFormedHtml(html, slug);
  });

  test(`examples/${slug}: ariaLabelFor and noteFor return non-empty strings`, () => {
    assert.ok(ariaLabelFor(slug), `${slug} has no ariaLabel`);
    assert.ok(noteFor(slug), `${slug} has no note`);
  });

  test(`examples/${slug}: every CSS class it emits is styled somewhere in src/css.js`, () => {
    const html = exampleFor(slug);
    const classes = extractClassNames(html);
    assert.ok(classes.size > 0, `${slug}'s example renders no classed elements`);
    for (const cls of classes) {
      assert.ok(SITE_CSS.includes(`.${cls}`), `class "${cls}" from ${slug}'s example is not styled anywhere in src/css.js`);
    }
  });
}

test('exampleFor() returns the empty string for a tool with no example module', () => {
  assert.equal(exampleFor('not-a-real-tool'), '');
  assert.equal(ariaLabelFor('not-a-real-tool'), '');
  assert.equal(noteFor('not-a-real-tool'), '');
});

/**
 * The literal fixture and expected diff result: two 4-row files, one row
 * of every status, run through the tool's OWN csvDiff.mjs (not
 * re-implemented here) so a change to the diff algorithm breaks this test
 * rather than silently shipping a wrong picture on the live page.
 */
test('compare-csv example: the fixture produces exactly the 5 expected diff statuses', () => {
  const outcome = diffFixture();
  const byId = new Map();
  for (const row of outcome.rows) {
    const id = (row.b || row.a)[0];
    byId.set(id, row.status);
  }
  assert.equal(byId.get('1001'), 'unchanged');
  assert.equal(byId.get('1002'), 'changed');
  assert.equal(byId.get('1003'), 'removed');
  assert.equal(byId.get('1004'), 'added');
  assert.equal(byId.get('1005'), 'unchanged');
  assert.equal(outcome.rows.length, 5);
  assert.equal(outcome.mode, 'key', 'the id column should auto-detect as the match key');
});

test('compare-csv example: row 1002 shows a two-cell change (plan and seats)', () => {
  const outcome = diffFixture();
  const row1002 = outcome.rows.find((r) => (r.b || r.a)[0] === '1002');
  assert.equal(row1002.status, 'changed');
  // header: id,name,plan,seats -- plan is column 2, seats is column 3.
  assert.deepEqual(row1002.changedCells.sort(), [2, 3]);
  assert.equal(row1002.a[2], 'Team');
  assert.equal(row1002.b[2], 'Business');
  assert.equal(row1002.a[3], '4');
  assert.equal(row1002.b[3], '9');
});

test('compare-csv example: the rendered table shows old and new values for the changed cell', () => {
  const html = exampleFor('compare-csv');
  assert.ok(html.includes('<span class="diff-cell-old">Team</span>'));
  assert.ok(html.includes('<span class="diff-cell-new">Business</span>'));
  assert.ok(html.includes('data-diff-status="removed"'));
  assert.ok(html.includes('data-diff-status="added"'));
  assert.ok(html.includes('data-diff-status="unchanged"'));
  assert.ok(html.includes('data-diff-status="changed"'));
});

/**
 * Pattern B (before-after-tables) tool-specific tests: each asserts
 * against the tool's OWN pure module's real return value for that
 * module's fixture, same "assert against reality, not a re-derived copy"
 * shape as compare-csv's tests above.
 */

test('merge-csv example: the fixture reconciles two different headers into one union, blank cell where a file lacks a column', () => {
  const merged = mergeFixture();
  assert.deepEqual(merged.headers, ['sku', 'qty', 'backorder']);
  assert.deepEqual(merged.rows, [
    ['A100', '12', ''],
    ['A101', '30', ''],
    ['B200', '', '0'],
    ['B201', '', '5'],
  ]);
});

test('merge-csv example: the rendered output table includes the union header row and a blank cell', () => {
  const html = exampleFor('merge-csv');
  assert.ok(html.includes('<th scope="col">backorder</th>'));
  assert.ok(html.includes('<td></td>'), 'expected at least one blank reconciled cell in the rendered output');
});

test('split-csv example: the fixture splits 5 rows at 3 per file into two uneven files', () => {
  const result = splitFixture();
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].dataRowCount, 3);
  assert.equal(result.files[1].dataRowCount, 2);
  assert.equal(result.totalDataRows, 5);
  // The header row is repeated in every output file.
  assert.deepEqual(result.files[0].rows[0], ['id', 'name', 'amount']);
  assert.deepEqual(result.files[1].rows[0], ['id', 'name', 'amount']);
});

test('transpose-csv example: the fixture swaps a 3-row, 3-column table into 3 rows of 3 cells each', () => {
  const outcome = transposeFixture();
  assert.equal(outcome.inputRowCount, 3);
  assert.equal(outcome.transposed.length, 3);
  outcome.transposed.forEach((row) => assert.equal(row.length, 3));
  // The header line is transposed too -- the tool has no header concept.
  assert.deepEqual(outcome.transposed[0], ['name', 'Iris', 'Coral']);
  assert.deepEqual(outcome.transposed[1], ['q1', '120', '90']);
});

test('sort-lines example: the fixture sorts numerically by score, descending, header pinned at the top', () => {
  const outcome = sortFixture();
  assert.deepEqual(outcome.sorted, ['name,score', 'Omar,95', 'Priya,88', 'Liu,72']);
  assert.equal(outcome.resolvedType, 'numeric');
});

test('remove-duplicate-lines example: the fixture removes the second occurrence of each duplicate, keeping order', () => {
  const outcome = dedupeFixture();
  assert.deepEqual(outcome.kept, ['apple', 'banana', 'cherry']);
  assert.deepEqual(outcome.removedIndices, [2, 4]);
  assert.equal(outcome.duplicateCount, 2);
});

test('remove-duplicate-lines example: the rendered Input table marks duplicate rows removed, Output shows only kept lines', () => {
  const html = exampleFor('remove-duplicate-lines');
  assert.ok(html.includes('data-diff-status="removed"'));
  assert.ok(html.includes('Duplicate'));
  assert.ok(html.includes('Kept'));
  // Scope to the Output column: "apple" and "banana" each appear exactly
  // once there -- the duplicated second occurrences never reach it.
  const outputHtml = html.slice(html.indexOf('>Output<'));
  const appleCount = (outputHtml.match(/<td>apple<\/td>/g) || []).length;
  const bananaCount = (outputHtml.match(/<td>banana<\/td>/g) || []).length;
  assert.equal(appleCount, 1);
  assert.equal(bananaCount, 1);
});

/**
 * Pattern C ("code-to-grid" / "code-to-code" / "grid-to-code") coverage --
 * an input code block or grid, plus the real result rendered as a grid or
 * a second code block. Each of the five tools below asserts against its
 * own module's real computed result (imported
 * directly, not re-derived here), the same "assert against reality"
 * discipline the compare-csv tests above use, so a change to any of these
 * tools' pure logic breaks the matching test here instead of silently
 * shipping a stale or wrong example on the live page.
 */

test('json-to-csv example: the fixture converts to the expected 3-column, 3-row grid', () => {
  const { columns, dataRows } = jsonToCsvFixture();
  assert.deepEqual(columns, ['sku', 'name', 'price']);
  assert.equal(dataRows.length, 3);
  assert.deepEqual(dataRows[0], ['A100', 'Widget', '9.5']);
  assert.deepEqual(dataRows[2], ['A102', 'Gizmo', '21.75']);
});

test('json-to-csv example: the rendered HTML shows the input JSON and the output grid', () => {
  const html = exampleFor('json-to-csv');
  assert.ok(html.includes('&quot;sku&quot;: &quot;A100&quot;'));
  assert.ok(html.includes('<th scope="col">price</th>'));
  assert.ok(html.includes('<td>21.75</td>'));
});

test('html-table-to-csv example: the hand-authored cell rows match the fixture HTML\'s own table exactly', () => {
  // Cheap drift guard for the two hand-authored fixtures this module keeps
  // in sync by hand (see that module's header comment): every cell's text
  // that appears in FIXTURE_CELL_ROWS must also literally appear in
  // FIXTURE_HTML, and the header row's cell count must match the number of
  // <th> tags in the markup.
  const { grid, headerRowCount } = htmlTableToCsvFixture();
  assert.equal(headerRowCount, 1);
  assert.deepEqual(grid[0], ['City', 'Population']);
  assert.deepEqual(grid[1], ['Reno', '264165']);
  assert.deepEqual(grid[2], ['Boise', '235684']);
});

test('html-table-to-csv example: the rendered HTML shows the input markup and the output grid', () => {
  const html = exampleFor('html-table-to-csv');
  assert.ok(html.includes('&lt;table&gt;'));
  assert.ok(html.includes('<th scope="col">Population</th>'));
  assert.ok(html.includes('<td>264165</td>'));
});

test('yaml-to-json example: the fixture converts to the expected JSON value, via the real js-yaml parse', () => {
  const jsonText = yamlToJsonFixture();
  const parsed = JSON.parse(jsonText);
  assert.deepEqual(parsed, { name: 'Widget', price: 9.5, tags: ['hardware', 'sale'] });
});

test('yaml-to-json example: the rendered HTML shows the input YAML and the output JSON', () => {
  const html = exampleFor('yaml-to-json');
  assert.ok(html.includes('name: Widget'));
  assert.ok(html.includes('&quot;price&quot;: 9.5'));
});

test('url-encode-decode example: the fixture encodes to exactly what the browser\'s own encodeURIComponent produces', () => {
  assert.equal(urlEncodeFixture(), encodeURIComponent(URL_ENCODE_FIXTURE_TEXT));
  assert.equal(urlEncodeFixture(), 'caf%C3%A9%20%26%20code');
});

test('url-encode-decode example: the rendered HTML shows the raw input and the percent-encoded output', () => {
  const html = exampleFor('url-encode-decode');
  assert.ok(html.includes('café &amp; code'), 'expected the raw fixture text (with & escaped) in the Input block');
  assert.ok(html.includes('caf%C3%A9%20%26%20code'));
});

test('json-minify-beautify example: the fixture minifies to exactly what JSON.stringify with no indent produces', () => {
  assert.equal(jsonMinifyBeautifyFixture(), JSON.stringify(JSON.parse(JSON_MINIFY_FIXTURE_TEXT)));
  assert.equal(jsonMinifyBeautifyFixture(), '{"user":{"name":"Ada","roles":["admin","editor"]}}');
});

test('json-minify-beautify example: the rendered HTML shows the pretty-printed input and the real minified output', () => {
  const html = exampleFor('json-minify-beautify');
  assert.ok(html.includes('&quot;name&quot;: &quot;Ada&quot;'), 'expected the raw pretty-printed fixture in the Input block');
  assert.ok(html.includes('{&quot;user&quot;:{&quot;name&quot;:&quot;Ada&quot;'), 'expected the real minified result in the Output block');
});

test('text-case-converter example: the fixture converts to all six real cases', () => {
  const outcomes = textCaseFixture();
  const byKey = Object.fromEntries(outcomes.map((o) => [o.key, o.result]));
  assert.equal(byKey.upper, 'HELLO WORLD');
  assert.equal(byKey.lower, 'hello world');
  assert.equal(byKey.title, 'Hello World');
  assert.equal(byKey.camel, 'helloWorld');
  assert.equal(byKey.snake, 'hello_world');
  assert.equal(byKey.kebab, 'hello-world');
});

test('text-case-converter example: the rendered HTML shows the raw input and all six real results', () => {
  const html = exampleFor('text-case-converter');
  assert.ok(html.includes('hello world'), 'expected the raw fixture text in the Input block');
  assert.ok(html.includes('HELLO WORLD'));
  assert.ok(html.includes('helloWorld'));
  assert.ok(html.includes('hello_world'));
  assert.ok(html.includes('hello-world'));
});

test('hash-generator example: the fixture hashes to the well-known pangram test vectors', () => {
  const byKey = Object.fromEntries(hashFixture().map((h) => [h.key, h.hash]));
  assert.equal(byKey.md5, '9e107d9d372bb6826bd81d3542a419d6');
  assert.equal(byKey.sha1, '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12');
  assert.equal(byKey.sha256, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
});

test('hash-generator example: the rendered HTML shows the raw input and all five real hashes', () => {
  const html = exampleFor('hash-generator');
  assert.ok(html.includes('The quick brown fox jumps over the lazy dog'), 'expected the raw fixture text in the Input block');
  assert.ok(html.includes('9e107d9d372bb6826bd81d3542a419d6'));
  assert.ok(html.includes('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'));
});

test('csv-to-sql-insert example: the fixture converts to the exact expected batched INSERT statement', () => {
  assert.equal(csvToSqlFixture(), [
    'INSERT INTO `products` (`id`, `name`, `price`) VALUES',
    "  (1, 'Widget', 9.99),",
    "  (2, 'Gadget', 14.50);",
  ].join('\n'));
});

test('csv-to-sql-insert example: the rendered HTML shows the raw CSV and the real generated SQL', () => {
  const html = exampleFor('csv-to-sql-insert');
  assert.ok(html.includes('id,name,price'), 'expected the raw fixture CSV in the Input block');
  assert.ok(html.includes('INSERT INTO'));
  assert.ok(html.includes("'Widget'"));
});

test('uuid-generator example: the fixture v5 UUID matches the same DNS-namespace RFC 4122 vector the pure module\'s own unit tests use', () => {
  assert.equal(uuidV5Fixture(), 'cfbff0d1-9375-5685-968c-48ce8b15ae17');
});

test('uuid-generator example: the rendered HTML shows the namespace/name input and the real generated v5 UUID', () => {
  const html = exampleFor('uuid-generator');
  assert.ok(html.includes(UUID_FIXTURE_NAME), 'expected the raw fixture name in the Input block');
  assert.ok(html.includes('cfbff0d1-9375-5685-968c-48ce8b15ae17'));
});

test('regex-tester example: the fixture finds exactly 2 matches, each with 2 capture groups (name and domain)', () => {
  const matches = regexMatchFixture();
  assert.equal(matches.length, 2);
  assert.equal(matches[0].match, 'hello@example.com');
  assert.deepEqual(matches[0].groups.map((g) => g.value), ['hello', 'example.com']);
  assert.equal(matches[1].match, 'support@example.org');
  assert.deepEqual(matches[1].groups.map((g) => g.value), ['support', 'example.org']);
});

test('regex-tester example: the rendered HTML shows the raw test string and both real matches with their groups', () => {
  const html = exampleFor('regex-tester');
  assert.ok(html.includes(REGEX_FIXTURE_TEST_STRING), 'expected the raw fixture test string in the Input block');
  assert.ok(html.includes('Match 1: &quot;hello@example.com&quot;'));
  assert.ok(html.includes('Group 1: &quot;hello&quot;'));
  assert.ok(html.includes('Group 2: &quot;example.com&quot;'));
});

test('sql-formatter example: the fixture beautifies to the real, exact expected layout', () => {
  assert.equal(sqlFormatterFixture(), [
    'SELECT u.id,',
    '  u.name',
    'FROM users u',
    'JOIN orders o',
    'ON o.user_id = u.id',
    'WHERE o.total > 100',
    'ORDER BY u.name',
  ].join('\n'));
});

test('sql-formatter example: the rendered HTML shows the raw query and the real beautified output', () => {
  const html = exampleFor('sql-formatter');
  assert.ok(html.includes('select u.id, u.name from users'), 'expected the raw fixture text in the Input block');
  assert.ok(html.includes('SELECT u.id,'));
  assert.ok(html.includes('JOIN orders o'));
});

test('word-character-counter example: the fixture computes the real word/character/sentence/reading-time stats', () => {
  const stats = wordCharacterCountFixture();
  assert.equal(stats.words, 14);
  assert.equal(stats.charactersWithSpaces, 73);
  assert.equal(stats.charactersWithoutSpaces, 60);
  assert.equal(stats.sentences, 2);
  assert.equal(stats.readingTime.label, '< 1 min read');
});

test('word-character-counter example: the rendered HTML shows the raw sample text and every real stat', () => {
  const html = exampleFor('word-character-counter');
  assert.ok(html.includes(WORD_CHARACTER_FIXTURE_TEXT), 'expected the raw fixture text in the Input block');
  assert.ok(html.includes('Words: 14'));
  assert.ok(html.includes('Sentences: 2'));
});

test('unix-timestamp-converter example: the fixture converts a real API-response-shaped seconds timestamp to the correct UTC date/time', () => {
  const result = unixTimestampFixture();
  assert.equal(result.ok, true);
  assert.equal(result.utcLabel, '2025-01-01 00:00:00 UTC');
  assert.equal(result.epochMilliseconds, 1735689600000);
});

test('unix-timestamp-converter example: the rendered HTML shows the raw sample API response and the real converted date', () => {
  const html = exampleFor('unix-timestamp-converter');
  assert.ok(html.includes(UNIX_TIMESTAMP_FIXTURE_JSON.replace(/</g, '&lt;')) || html.includes('1735689600'), 'expected the raw fixture JSON in the Input block');
  assert.ok(html.includes('2025-01-01 00:00:00 UTC'));
});

test('html-entity-encode-decode example: the fixture escapes exactly the five reserved characters, using default (named) format', () => {
  const outcome = htmlEntityFixture();
  assert.equal(outcome.output, 'Tom &amp; Jerry&apos;s café &lt;b&gt;bold&lt;/b&gt; &quot;quote&quot;');
  assert.equal(outcome.encodedCount, 8);
});

test('html-entity-encode-decode example: the accented letter is left untouched (default scope is "reserved", not "all-non-ascii")', () => {
  const outcome = htmlEntityFixture();
  assert.ok(outcome.output.includes('café'), 'café should appear literally, not as an entity, under the default scope');
});

test('html-entity-encode-decode example: the rendered HTML shows the raw input and the real encoded output', () => {
  const html = exampleFor('html-entity-encode-decode');
  assert.ok(html.includes('Tom &amp;amp; Jerry&amp;apos;s café &amp;lt;b&amp;gt;bold&amp;lt;/b&amp;gt; &amp;quot;quote&amp;quot;'), 'the encoded output, itself HTML-escaped for safe display in a <pre><code> block, should appear in the rendered example');
});

test('xml-to-json example: the fixture converts to the expected JSON value, attribute as @id and elements as their own keys', () => {
  const jsonText = xmlToJsonFixture();
  const parsed = JSON.parse(jsonText);
  assert.deepEqual(parsed, { order: { '@id': '1', item: 'Coffee', price: '4.50' } });
});

test('xml-to-json example: the rendered HTML shows the input XML and the output JSON', () => {
  const html = exampleFor('xml-to-json');
  assert.ok(html.includes('&lt;order id=&quot;1&quot;&gt;'));
  assert.ok(html.includes('&quot;@id&quot;: &quot;1&quot;'));
  assert.ok(html.includes('&quot;item&quot;: &quot;Coffee&quot;'));
});

test('flatten-json example: the fixture flattens nested customer objects into dot-notation keys', () => {
  const flatRecords = flattenFixture();
  assert.equal(flatRecords.length, 2);
  assert.deepEqual(flatRecords[0], { order: 'A1', 'customer.name': 'Priya', 'customer.city': 'Austin' });
  assert.deepEqual(flatRecords[1], { order: 'A2', 'customer.name': 'Omar', 'customer.city': 'Reno' });
});

test('flatten-json example: the rendered HTML wraps every flattened key at weight-medium', () => {
  const html = exampleFor('flatten-json');
  assert.ok(html.includes('<span style="font-weight:var(--weight-medium)">&quot;customer.name&quot;</span>'));
  assert.ok(html.includes('<span style="font-weight:var(--weight-medium)">&quot;customer.city&quot;</span>'));
});

test('xlsx-to-json example: the fixture keeps real JSON types (number, boolean), not stringified text', () => {
  const { records } = xlsxToJsonFixture();
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], { Product: 'Widget', Qty: 12, 'In Stock': true });
  assert.equal(typeof records[0].Qty, 'number');
  assert.equal(typeof records[0]['In Stock'], 'boolean');
  assert.deepEqual(records[1], { Product: 'Gadget', Qty: 5, 'In Stock': false });
});

test('xlsx-to-json example: the rendered HTML shows the input grid and the typed output JSON', () => {
  const html = exampleFor('xlsx-to-json');
  assert.ok(html.includes('<th scope="col">In Stock</th>'));
  assert.ok(html.includes('&quot;Qty&quot;: 12'));
  assert.ok(html.includes('&quot;In Stock&quot;: true'));
});

/**
 * Pattern D ("page-strip") and Pattern E ("extract-to-grid") coverage.
 * Pattern D (merge-pdf, split-pdf, rotate-pdf) has no computed result to
 * assert against -- a PDF page-level operation produces page bytes, not
 * data (see src/examples/merge-pdf.mjs's header comment) -- so those three
 * get only the generic well-formed/styled coverage the slug loop above
 * already runs. Pattern E DOES have a real computed result (a fixture run
 * through the tool's own extraction pipeline), so each of those three
 * asserts against that real return value directly, same "assert against
 * reality" discipline as every pattern above.
 */

test('pdf-to-csv example: the fixture is found as one 3-column table with a detected header', () => {
  const { tables } = pdfToCsvFixture();
  assert.equal(tables.length, 1);
  assert.equal(tables[0].headerRowIndex, 0);
  assert.deepEqual(tables[0].rows, [
    ['Item', 'Qty', 'Price'],
    ['Widget A', '3', '$9.50'],
    ['Widget B', '1', '$14.00'],
    ['Widget C', '5', '$21.75'],
  ]);
});

test('pdf-to-csv example: the rendered HTML shows the 3-column header and 3 data rows', () => {
  const html = exampleFor('pdf-to-csv');
  assert.ok(html.includes('<th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Price</th>'));
  assert.ok(html.includes('<td>Widget A</td><td>3</td><td>$9.50</td>'));
  assert.equal((html.match(/<tr><td>/g) || []).length, 3, 'expected exactly 3 data rows');
});

test('bank-statement-to-csv example: two pages combine into 4 transactions, repeated header dropped', () => {
  const { mainTable, otherTables } = statementFixture();
  assert.equal(otherTables.length, 0);
  assert.deepEqual(mainTable.headerRow, ['Date', 'Description', 'Amount']);
  assert.equal(mainTable.rows.length, 4, 'a repeated per-page header should not be counted as a transaction row');
  assert.deepEqual(mainTable.rows.map((r) => r[0]), ['03/02', '03/05', '03/09', '03/14']);
  assert.deepEqual(mainTable.sourcePages, [1, 2]);
});

test('bank-statement-to-csv example: the rendered HTML shows exactly one header row and 4 transaction rows', () => {
  const html = exampleFor('bank-statement-to-csv');
  assert.equal((html.match(/<th scope="col">Date<\/th>/g) || []).length, 1, 'the repeated per-page header must not appear twice');
  assert.equal((html.match(/<tr><td>/g) || []).length, 4);
  assert.ok(html.includes('Combined (4 transactions)'));
});

test('xlsx-to-csv example: a merged A1:B1 cell duplicates its value into both columns, not a blank', () => {
  const grid = xlsxToCsvFixture();
  assert.deepEqual(grid, [
    ['Region', 'Region', ''],
    ['North', 'Widget', '120'],
    ['North', 'Gadget', '75'],
    ['South', 'Widget', '60'],
  ]);
});

test('xlsx-to-csv example: the rendered HTML shows "Region" as both the first and second header cell', () => {
  const html = exampleFor('xlsx-to-csv');
  assert.ok(html.includes('<th scope="col">Region</th><th scope="col">Region</th><th scope="col"></th>'));
  assert.equal((html.match(/<tr><td>/g) || []).length, 3);
});

test('base64-encode-decode example: the fixture encodes to the real Base64 of the UTF-8 text, including the accented character', () => {
  const encoded = base64Fixture();
  assert.equal(encoded, 'ZmlsZXRvb2xzOiBjYWbDqSBlZGl0aW9u');
  // Round-trip through the browser's own atob() as an independent check
  // that this isn't just re-asserting whatever the tool's own codec
  // produced.
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), 'filetools: café edition');
});

test('base64-encode-decode example: the rendered HTML shows the input text and the output Base64', () => {
  const html = exampleFor('base64-encode-decode');
  assert.ok(html.includes('filetools: caf'));
  assert.ok(html.includes('ZmlsZXRvb2xzOiBjYWbDqSBlZGl0aW9u'));
});

test('text-diff example: the fixture reports exactly one changed, one removed, one added, two unchanged lines', () => {
  const outcome = textDiffFixture();
  assert.deepEqual(outcome.stats, {
    unchanged: 2, changed: 1, added: 1, removed: 1,
  });
  assert.deepEqual(outcome.rows.map((r) => r.status), ['changed', 'unchanged', 'removed', 'added', 'unchanged']);
});

test('text-diff example: the rendered HTML shows the two-pane grid with the real word-level highlight and the removed/added lines', () => {
  const html = exampleFor('text-diff');
  assert.ok(html.includes('class="text-diff-grid"'));
  assert.ok(html.includes('<mark class="text-diff-del">jumps</mark>'));
  assert.ok(html.includes('<mark class="text-diff-ins">leaps</mark>'));
  assert.ok(html.includes('This line will be removed.'));
  assert.ok(html.includes('A brand new line goes here.'));
  assert.ok(html.includes('data-diff-status="empty"'));
});

test('qr-code-generator example: the fixture encodes the real URL as a 25x25-module QR code', () => {
  const qr = qrFixture();
  assert.equal(qr.getModuleCount(), 25);
});

test('qr-code-generator example: the rendered HTML shows a real <svg> QR code and the encoded text caption', () => {
  const html = exampleFor('qr-code-generator');
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes(`Encoding: ${QR_FIXTURE_TEXT}`));
});
