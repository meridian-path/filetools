'use strict';

const { renderPage, escapeHtml } = require('../shell.js');
const { websiteJsonLd } = require('../structuredData.js');
const { CATEGORY_LABELS, toolsByCategory, TOOLS, toolBySlug } = require('../tools/index.js');
const { url, absoluteUrl, SITE_TAGLINE } = require('../site.js');
const { markFor } = require('../icons.js');
const { familyOf } = require('../families.js');

function renderToolRow(t) {
  const iconWrap = `<div class="tool-row-icon-wrap mark--${escapeHtml(familyOf(t.slug))}">${markFor(t.slug, 'tool-row-icon')}</div>`;
  return `<a class="tool-row" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${iconWrap}<span class="tool-row-text"><span class="tool-row-name">${escapeHtml(t.navLabel)}</span><span class="tool-row-desc">${escapeHtml(t.deck)}</span></span></a>`;
}

// One representative tool per format family, for the hero's family index --
// a real jump-straight-there shortcut into the 22-tool list below, not a
// duplicate of it. Picked for being each family's clearest single-purpose
// example (see src/families.js for the family taxonomy this reads).
const FAMILY_INDEX_SLUGS = {
  pdf: 'merge-pdf',
  csv: 'merge-csv',
  json: 'json-to-csv',
  sheet: 'xlsx-to-csv',
  text: 'word-frequency-counter',
};
const FAMILY_INDEX_LABELS = {
  pdf: 'PDF',
  csv: 'CSV',
  json: 'JSON',
  sheet: 'Excel',
  text: 'Text',
};

function renderFamilyStripItem(family) {
  const slug = FAMILY_INDEX_SLUGS[family];
  const tool = toolBySlug(slug);
  const label = FAMILY_INDEX_LABELS[family];
  return `<a class="family-strip-item" href="${escapeHtml(url(`${tool.category}/${tool.slug}/`))}" aria-label="${escapeHtml(`${label} tools, starting with ${tool.navLabel}`)}"><span class="family-strip-icon-wrap mark--${family}">${markFor(slug, 'family-strip-icon')}</span><span class="family-strip-label">${escapeHtml(label)}</span></a>`;
}

function renderHomePage() {
  // Two category sections (a real h2 each -- an SEO/topical-structure gain
  // over the old flat single grid), each a dense hairline-separated list
  // rather than a card grid -- see design-standards.md's craft floor on
  // ragged final rows, which a list can't produce as the tool count grows.
  // Section background tints (.tool-group--pdf/--data) were removed: now
  // that each tool row's icon mark carries its own family hue, keeping a
  // second, coarser color layer on top of it (a whole-section wash) reads
  // as too much color at once. The <h2> and hairline border already carry
  // the grouping without it.
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([catKey, catLabel]) => {
      const rows = toolsByCategory(catKey).map(renderToolRow).join('\n        ');
      return `<section class="tool-group" aria-labelledby="group-${catKey}">
        <h2 id="group-${catKey}">${escapeHtml(catLabel)}</h2>
        <div class="tool-list">
        ${rows}
        </div>
      </section>`;
    })
    .join('\n    ');

  // Real count, not a hardcoded copy string that would go stale the next
  // time a tool merges (TOOLS is auto-discovered, src/tools/index.js).
  const toolCount = TOOLS.length;
  const familyStrip = ['pdf', 'csv', 'json', 'sheet', 'text'].map(renderFamilyStripItem).join('\n        ');
  const firstCategoryKey = Object.keys(CATEGORY_LABELS)[0];

  const mainHtml = `    <div class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <p class="hero-kicker">${toolCount} tools, zero uploads</p>
          <h1>File tools that never leave your browser</h1>
          <p class="deck">No account. No file uploads. No sign-up. Every tool below runs entirely on your device: turn off your Wi-Fi and they still work.</p>
          <a class="btn-primary hero-cta" href="#group-${escapeHtml(firstCategoryKey)}">Browse all ${toolCount} tools</a>
        </div>
        <nav class="hero-families" aria-label="Jump to a tool by format">
          <div class="family-strip">
        ${familyStrip}
          </div>
        </nav>
      </div>
    </div>
    ${groups}
    <p class="caption">Read more about how that’s possible on the <a href="${escapeHtml(url('how-this-works/'))}">how this works</a> page.</p>
`;

  return renderPage({
    slug: null,
    title: 'filetools - Free File Utilities, Right In Your Browser',
    metaDescription: SITE_TAGLINE,
    mainHtml,
    jsonLd: [websiteJsonLd()],
    canonical: absoluteUrl(),
    feedUrl: absoluteUrl('feed.xml'),
    wide: true,
  });
}

module.exports = { renderHomePage };
