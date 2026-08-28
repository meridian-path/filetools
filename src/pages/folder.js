'use strict';

/**
 * Folder index pages (site-wide navigation/IA redesign, see the folder
 * taxonomy/nav spec sections 1.6, 3.2, 3.4) -- five new, additive, indexable pages
 * (/pdf/, /spreadsheets/, /data-formats/, /text/, /developer/), one per
 * src/folders.js entry. Zero existing tool URLs change; these are purely
 * new destinations.
 *
 * B2 update: now renders the real explorer window (chrome strip, column
 * ruler, tool rows with Kind chips, status bar), same shared component the
 * homepage uses minus the sidebar -- see src/pages/explorerWindow.js.
 *
 * Reference-library grounding: Cobalt -- the tool/content is the landing
 * surface, no marketing block above it; this page follows that shape
 * (path bar, one intro paragraph, straight into the tool list). Squoosh --
 * a number attached to every claim; this page's intro names real tools
 * rather than adjectives.
 *
 * Verb-subsection scale note (spec section 1.6/1.12): a folder with more
 * than FOLDER_VERB_SUBSECTION_THRESHOLD tools is specified to render its
 * rows grouped under verb h3 subsections instead of one flat list. No
 * folder exceeds that threshold today (max is spreadsheets at 8), so
 * that grouping is not implemented as executable code in this pass --
 * building and shipping untested, never-triggered grouping logic against
 * data that doesn't exist yet is the kind of speculative complexity this
 * codebase's own conventions avoid. The threshold constant and this note
 * are the trigger for whoever adds the folder that crosses it.
 */

const { renderPage, escapeHtml, HOME_CRUMB } = require('../shell.js');
const { breadcrumbJsonLd, collectionPageJsonLd } = require('../structuredData.js');
const { url, absoluteUrl } = require('../site.js');
const { TOOLS } = require('../tools/index.js');
const { FOLDERS, toolsInFolder } = require('../folders.js');
const {
  renderToolRow, renderWindowChrome, renderWindowRuler, renderWindowStatusBar, renderExplorerWindow,
} = require('./explorerWindow.js');

const FOLDER_VERB_SUBSECTION_THRESHOLD = 12;

/**
 * Per-folder page copy -- written per page, not templated (spec 3.3), one
 * entry per src/folders.js key. `intro` is the on-page paragraph;
 * `metaDescription` is the <=155-char meta tag naming 3-4 member tools by
 * query name plus the no-upload mechanism.
 */
const FOLDER_PAGE_CONTENT = {
  pdf: {
    title: 'PDF Tools - Free, In Your Browser | filetools',
    h1: 'PDF tools',
    metaDescription: 'Merge, split, rotate, or pull tables from PDF files - free, runs in your browser, nothing uploaded.',
    intro: 'Five tools for working with PDF files: merge multiple PDFs into one, split a PDF into separate files, rotate pages, and pull tables out of a PDF into a CSV (including bank statements). Every one of them runs entirely in your browser - nothing is uploaded, and turning off your Wi-Fi after the page loads doesn’t stop them from working.',
  },
  spreadsheets: {
    title: 'CSV & Spreadsheet Tools - Free, In Your Browser | filetools',
    h1: 'CSV & spreadsheet tools',
    metaDescription: 'Merge, compare, transpose, or convert CSV and Excel files - free, runs in your browser, nothing uploaded.',
    intro: 'Eight tools for CSV and spreadsheet files: merge, split, compare, and transpose CSV files, convert an Excel workbook to CSV or JSON, convert an HTML table to CSV, and turn CSV rows into ready-to-run SQL INSERT statements. All of it runs on your own device - your spreadsheet data is never sent anywhere.',
  },
  'data-formats': {
    title: 'JSON & Data Format Tools - Free, In Your Browser | filetools',
    h1: 'JSON & data format tools',
    metaDescription: 'Convert JSON to CSV, minify JSON, or convert XML and YAML to JSON - free, runs in your browser, nothing uploaded.',
    intro: 'Five tools for JSON and other structured data formats: convert JSON to CSV, minify or beautify JSON, flatten nested JSON into flat rows, and convert XML or YAML into JSON. Everything runs locally in your browser, so nothing you paste or drop here ever reaches a server.',
  },
  text: {
    title: 'Text Tools - Free, In Your Browser | filetools',
    h1: 'Text tools',
    metaDescription: 'Convert text case, remove duplicate lines, sort lines, or count word frequency - free, runs in your browser, nothing uploaded.',
    intro: 'Four tools for working with plain text: convert between text cases, remove duplicate lines, sort lines alphabetically or numerically, and count word frequency across a block of text. All processing happens in your browser - your text is never uploaded.',
  },
  developer: {
    title: 'Developer Tools - Free, In Your Browser | filetools',
    h1: 'Developer tools',
    metaDescription: 'Generate hashes and UUIDs, test regex, or format SQL - free, runs in your browser, nothing uploaded.',
    intro: 'Seven developer utilities: encode or decode Base64, URLs, and HTML entities, generate cryptographic hashes or UUIDs, test a regular expression with live match highlighting, and format or minify SQL queries. Every one of these runs entirely client-side, with nothing sent to a server.',
  },
};

/**
 * @param {object} folder one FOLDERS entry.
 * @returns {string} the complete standalone HTML document for that
 *   folder's index page.
 */
function renderFolderPage(folder) {
  const content = FOLDER_PAGE_CONTENT[folder.key];
  const tools = toolsInFolder(folder.key);
  const canonical = absoluteUrl(`${folder.slug}/`);

  const rows = tools.map(renderToolRow).join('\n        ');

  const siblingLinks = FOLDERS
    .filter((f) => f.key !== folder.key)
    .map((f) => `<a href="${escapeHtml(url(`${f.slug}/`))}">${escapeHtml(f.label)}</a>`)
    .join(', ');

  const window = renderExplorerWindow({
    chrome: renderWindowChrome(`~ / ${folder.slug}`, tools.length, 'items'),
    ruler: renderWindowRuler(),
    body: `<div class="tool-list" data-window-rows>
        ${rows}
      </div>`,
    statusBar: renderWindowStatusBar(`${tools.length} files · 0 uploads · works offline`),
  });

  // A visually-hidden h2 (not a visible "All N tools" heading -- the
  // window's own chrome strip already shows that count) keeps the real
  // heading order h1 -> h2 -> (footer's h3s) intact. Without it, this
  // page's own body has no h2 at all and skips straight to h3, the exact
  // Lighthouse-caught heading-order regression the B1 build already fixed
  // once -- see .sr-only in src/css.js.
  const mainHtml = `    <h1>${escapeHtml(content.h1)}</h1>
    <p class="deck">${escapeHtml(content.intro)}</p>
    <h2 id="folder-tools-h" class="sr-only">${escapeHtml(content.h1)}</h2>
    <div aria-labelledby="folder-tools-h">
    ${window}
    </div>
    <p class="caption">Other folders: ${siblingLinks}</p>
`;

  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', url: absoluteUrl() },
      { name: content.h1, url: canonical },
    ]),
    collectionPageJsonLd({
      name: content.h1,
      description: content.metaDescription,
      url: canonical,
      items: tools.map((t) => ({ name: t.navLabel, url: absoluteUrl(`${t.category}/${t.slug}/`) })),
    }),
  ];

  return renderPage({
    slug: folder.slug,
    title: content.title,
    metaDescription: content.metaDescription,
    breadcrumb: [
      HOME_CRUMB,
      { name: folder.slug },
    ],
    mainHtml,
    jsonLd,
    canonical,
    wide: true,
  });
}

/**
 * The noindex /data/ helper page (spec 1.2/3.2): today's overloaded
 * "data" URL category has no real index page of its own -- this is a
 * courtesy landing spot for anyone who guesses/visits that bare path
 * directly, not a real part of the IA (it links OUT to the real folder
 * pages and the full tool list, and is never linked TO from anywhere in
 * the site's own nav/footer/sitemap). noindex, same as the 404 page.
 */
function renderDataIndexPage() {
  const folderLinks = FOLDERS
    .map((f) => `<li><a href="${escapeHtml(url(`${f.slug}/`))}">${escapeHtml(f.label)}</a></li>`)
    .join('\n        ');
  const toolLinks = TOOLS
    .filter((t) => t.category === 'data')
    .map((t) => `<li><a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${escapeHtml(t.navLabel)}</a></li>`)
    .join('\n        ');

  const mainHtml = `    <h1>Index of /data</h1>
    <p class="deck">This isn’t a real page - it’s a landing spot for a guessed URL. Here’s where everything under /data/ actually lives:</p>
    <h2>Folders</h2>
    <ul>
        ${folderLinks}
    </ul>
    <h2>All tools under /data/</h2>
    <ul>
        ${toolLinks}
    </ul>
`;

  return renderPage({
    slug: null,
    title: 'Index of /data | filetools',
    metaDescription: 'A list of every folder and tool page under /data/ on filetools.',
    mainHtml,
    canonical: absoluteUrl('data/'),
    noindex: true,
  });
}

module.exports = {
  renderFolderPage, FOLDER_PAGE_CONTENT, FOLDER_VERB_SUBSECTION_THRESHOLD, renderDataIndexPage,
};
