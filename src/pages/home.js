'use strict';

const { renderPage, escapeHtml } = require('../shell.js');
const { websiteJsonLd } = require('../structuredData.js');
const { TOOLS } = require('../tools/index.js');
const { url, absoluteUrl, SITE_TAGLINE } = require('../site.js');
const { FOLDERS, toolsInFolder } = require('../folders.js');
const {
  renderToolRow, renderFolderSidebarRow, renderWindowChrome, renderWindowRuler,
  renderWindowStatusBar, renderExplorerWindow,
} = require('./explorerWindow.js');

/**
 * One folder's main-pane section: an h2 (real heading, stable
 * id="folder-<key>" so #folder-pdf deep links keep working -- spec 3.6),
 * a link to that folder's own index page, and its tool rows.
 */
function renderFolderSection(folder) {
  const tools = toolsInFolder(folder.key);
  const rows = tools.map(renderToolRow).join('\n          ');
  return `<section class="window-section" aria-labelledby="folder-${escapeHtml(folder.key)}-h">
        <h2 id="folder-${escapeHtml(folder.key)}-h" class="window-section-heading">
          <a href="${escapeHtml(url(`${folder.slug}/`))}">${escapeHtml(folder.label)}</a>
          <span class="window-section-count">${tools.length}</span>
        </h2>
        <div class="tool-list" data-window-rows>
          ${rows}
        </div>
      </section>`;
}

/**
 * The homepage explorer window: chrome strip + column ruler + a two-pane
 * body (folder sidebar, five folder sections) + status bar (site-wide
 * navigation/IA redesign, see the folder taxonomy/nav spec section 1.5).
 * The two former homepage category sections (a flat CATEGORY_LABELS-driven
 * grid) are replaced entirely by this -- real per-folder h2s are kept
 * (still a topical-structure gain over one undivided list), just five of
 * them now instead of two.
 */
function renderExplorerHome() {
  const sidebarRows = FOLDERS.map((f) => renderFolderSidebarRow(f, toolsInFolder(f.key).length)).join('\n        ');
  const sections = FOLDERS.map(renderFolderSection).join('\n      ');
  const toolCount = TOOLS.length;

  const chrome = renderWindowChrome('~', toolCount, 'items');
  const statusBar = renderWindowStatusBar(`${toolCount} files · 0 uploads · works offline`);

  return renderExplorerWindow({
    chrome,
    ruler: renderWindowRuler(),
    sidebar: sidebarRows,
    body: sections,
    statusBar,
  });
}

function renderHomePage() {
  const toolCount = TOOLS.length;

  // Compressed hero (spec 1.5): kicker + h1 + one-line deck + the single
  // accent CTA, which now targets the window itself via
  // href="#explorer-window" -- the target's own tabindex="-1" (below)
  // means a plain fragment-link activation already moves real focus
  // there natively, no extra JS needed. The retired family-index strip
  // (2026-08-23 composition pass) is superseded by the window's own
  // sidebar + Kind chips, which carry the same "jump straight to a
  // format" scent with more precision (a real count per folder, not just
  // an icon). Deck shortened to one real sentence (was three) so it
  // genuinely fits on one line even at 360px width, per spec 1.5's
  // compressed-mobile-hero requirement -- not truncated via CSS, the
  // claim itself is just stated more directly.
  const mainHtml = `    <div class="hero">
      <p class="hero-kicker">${toolCount} tools, zero uploads</p>
      <h1>File tools that never leave your browser</h1>
      <p class="deck">No account, no uploads. Runs on your device.</p>
      <a class="btn-primary hero-cta" href="#explorer-window">Browse all ${toolCount} tools</a>
    </div>
    <div id="explorer-window" tabindex="-1">
    ${renderExplorerHome()}
    </div>
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

module.exports = { renderHomePage, renderExplorerHome, renderFolderSection };
