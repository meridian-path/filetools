'use strict';

/**
 * The shared "explorer window" surface (site-wide navigation/IA redesign,
 * see the folder taxonomy/nav spec section 1.5/1.6/1.9) -- one bordered
 * component (chrome strip + optional column ruler + body + status bar)
 * reused, with different bodies, by:
 *   - the homepage (folder sidebar + all five folder sections)
 *   - each folder page (no sidebar, one flat section)
 *   - the 404 page (no ruler, a row per folder instead of per tool)
 * Kept here rather than inline in each page module so all three stay
 * pixel- and DOM-identical wherever the spec says they should be, and so
 * filter.client.js has one stable set of selectors/data attributes to
 * drive regardless of which page it's running on.
 */

const { escapeHtml } = require('../shell.js');
const { url } = require('../site.js');
const { markFor, folderGlyph } = require('../icons.js');
const { familyOf } = require('../families.js');

/**
 * Kind-chip label per tool `family` (spec 1.5) -- deliberately short,
 * matching the family's own recognizable initialism/name rather than a
 * longer category phrase. 'dev' started as a folder-color-only axis
 * (folders.js's developer-folder familyKey) with no individual tool
 * actually carrying family:'dev' -- the craft-audit fix (site-audit task,
 * item 7) gave the genuine developer-utility tools (Regex Tester, Hash
 * Generator, UUID Generator, and others under folders.js's 'developer'
 * folder) that same family, so their per-row icon/Kind chip finally reads
 * as "Dev" instead of sharing plain-text tools' "Text" chip.
 */
const FAMILY_KIND_LABELS = {
  pdf: 'PDF', csv: 'CSV', json: 'JSON', sheet: 'Sheet', text: 'Text', dev: 'Dev',
};

/**
 * One tool row: icon mark, name/description, and (>=768px only, via CSS)
 * a right-aligned Kind chip naming the tool's own family. `data-filter-*`
 * attributes are build-time-computed filter targets for
 * filter.client.js's substring match -- lowercased once here so the
 * client never re-lowercases on every keystroke.
 * @param {object} t a TOOLS entry.
 */
function renderToolRow(t) {
  const family = familyOf(t.slug);
  const iconWrap = `<div class="tool-row-icon-wrap mark--${escapeHtml(family)}">${markFor(t.slug, 'tool-row-icon')}</div>`;
  const kindLabel = FAMILY_KIND_LABELS[family] || family;
  const kindChip = `<span class="tool-row-kind mark--${escapeHtml(family)}">${escapeHtml(kindLabel)}</span>`;
  const filterText = escapeHtml(`${t.navLabel} ${t.deck} ${t.slug}`.toLowerCase());
  return `<a class="tool-row" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}" data-filter-row data-filter-text="${filterText}">${iconWrap}<span class="tool-row-text"><span class="tool-row-name">${escapeHtml(t.navLabel)}</span><span class="tool-row-desc">${escapeHtml(t.deck)}</span></span>${kindChip}</a>`;
}

/**
 * One folder row (glyph + label + count), used by the homepage sidebar and
 * by the 404 page's "five folders" listing -- the same row shape either
 * way, since both are "here is where to go next," not a tool list.
 * @param {object} folder a FOLDERS entry.
 * @param {number} count that folder's tool count.
 */
function renderFolderSidebarRow(folder, count) {
  return `<a class="window-sidebar-row" href="${escapeHtml(url(`${folder.slug}/`))}">${folderGlyph(folder.familyKey, 'folder-glyph-window')}<span class="window-sidebar-label">${escapeHtml(folder.label)}</span><span class="window-sidebar-count">${count}</span></a>`;
}

/**
 * The chrome strip: mono path, real item count, and (usually) the filter
 * input's injection point (`data-filter-slot`, empty until
 * filter.client.js runs -- "no dead control without JS", spec 1.3b,
 * applies here too: without JS this is just an empty, harmless div).
 * @param {string} pathText e.g. "~" or "~ / spreadsheets".
 * @param {number} count
 * @param {string} itemNoun singular/plural noun for `count`, e.g. "items".
 * @param {boolean} [includeFilterSlot=true] the 404 page passes false: its
 *   window body lists the five FOLDERS as rows, not tools, and
 *   substring-filtering five folder names by their own label isn't a
 *   meaningful feature -- omitting the slot here means filter.client.js
 *   finds no inline filter on that page and "/" correctly falls through
 *   to quick-open instead (a strictly more useful search on that page,
 *   since it searches every tool, not five folder names).
 */
function renderWindowChrome(pathText, count, itemNoun, includeFilterSlot = true) {
  const filterSlot = includeFilterSlot ? '<div class="window-filter-slot" data-filter-slot></div>' : '';
  return `<div class="window-chrome">
      <span class="window-path">${escapeHtml(pathText)}</span>
      <span class="window-count">${count} ${escapeHtml(itemNoun)}</span>
      ${filterSlot}
    </div>`;
}

function renderWindowRuler() {
  return `<div class="window-ruler" aria-hidden="true"><span>Name</span><span>Kind</span></div>`;
}

/**
 * @param {string} text initial status text (real, derived -- never a
 *   hardcoded copy string). aria-live so filter.client.js's updates to
 *   this same element are announced without moving focus.
 */
function renderWindowStatusBar(text) {
  return `<div class="window-status-bar"><span class="window-status-text" aria-live="polite" data-window-status>${escapeHtml(text)}</span></div>`;
}

/**
 * @param {{chrome:string, ruler?:string, sidebar?:string, body:string,
 *   statusBar:string}} parts
 * @returns {string} the complete window markup. `sidebar` present -> a
 *   two-pane body (home only); absent -> body renders full-width (folder
 *   pages, 404).
 */
function renderExplorerWindow({ chrome, ruler = '', sidebar = '', body, statusBar }) {
  const bodyInner = sidebar
    ? `<nav class="window-sidebar" aria-label="Folders">${sidebar}</nav><div class="window-main">${body}</div>`
    : `<div class="window-main window-main-full">${body}</div>`;
  return `<div class="explorer-window">
      ${chrome}
      ${ruler}
      <div class="window-body">${bodyInner}</div>
      ${statusBar}
    </div>`;
}

module.exports = {
  FAMILY_KIND_LABELS,
  renderToolRow,
  renderFolderSidebarRow,
  renderWindowChrome,
  renderWindowRuler,
  renderWindowStatusBar,
  renderExplorerWindow,
};
