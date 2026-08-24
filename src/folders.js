'use strict';

/**
 * Display taxonomy for site-wide navigation/IA (nav tree, homepage,
 * folder pages, footer, sitemap) -- decoupled from `tool.category`, which
 * stays the physical URL prefix ('pdf' | 'data') and NEVER changes for an
 * existing tool. See the site-wide navigation/IA redesign architect spec
 * section 1.1 for the full rationale: the URL is a
 * permanent identifier, the folder is presentation, and this split is what
 * lets the taxonomy be reorganized later without ever touching a URL.
 *
 * One canonical folder per tool, never two (NN/g breadcrumb guidance: a
 * single canonical path even on a polyhierarchical site) -- cross-topic
 * membership stays covered by each tool's own `relatedSlugs`.
 *
 * FOLDER_BY_SLUG is assembled from the TOOLS registry's own `folder` field
 * on each src/tools/<slug>.js (same fragment-pattern mirroring
 * src/families.js uses for `family`) -- a new tool adds its own file with
 * a `folder` field; no shared file (this one included) changes for it, so
 * two tool branches can never conflict on a shared folder row.
 * test/folders.test.mjs is the regression check that would catch a
 * missing/unknown folder row the same way test/families.test.mjs already
 * does for family.
 */
const { TOOLS } = require('./tools/index.js');

/**
 * Ordered array, the exact order folders should render in nav/footer/home.
 * `familyKey` is the src/families.js family whose token ramp (--family-
 * <key>-1/6/8) supplies this folder's glyph/chip color via the existing
 * mark--<family> class mechanism -- folders never get their own color
 * tokens (spec 1.11: a folder's accent IS its familyKey's, not a new
 * token). `key` is the internal registry key; `slug` is the folder's own
 * URL segment under BASE_PATH (/<slug>/), independent of any tool's
 * `category`.
 */
const FOLDERS = [
  { key: 'pdf', slug: 'pdf', label: 'PDF', familyKey: 'pdf', description: 'Merge, split, rotate, and extract data from PDF files.' },
  { key: 'spreadsheets', slug: 'spreadsheets', label: 'CSV & Spreadsheets', familyKey: 'csv', description: 'Merge, compare, transpose, and convert CSV and spreadsheet files.' },
  { key: 'data-formats', slug: 'data-formats', label: 'JSON & Data Formats', familyKey: 'json', description: 'Convert and clean up JSON, XML, and YAML.' },
  { key: 'text', slug: 'text', label: 'Text', familyKey: 'text', description: 'Sort, dedupe, and analyze plain text.' },
  // familyKey 'dev' is the folder-level color axis only (src/tokens.js's
  // --family-dev-1/6/8, added alongside this file) -- the individual
  // tools inside this folder keep their OWN existing `family` (mostly
  // 'text', for their own icon mark), unrelated to their folder's color.
  { key: 'developer', slug: 'developer', label: 'Developer', familyKey: 'dev', description: 'Encoding, hashing, and other developer-utility conversions.' },
];

const DEFAULT_FOLDER = 'developer';

// Scale valve (spec 1.12): while the TOOLS registry stays at or under this
// count, every homepage folder section renders in full -- above it, each
// section caps at this many rows (most-recent by launchDate) plus a link
// to that folder's own full page. Lives here, not in home.js, so B2's
// homepage and any future listing share the same constant and rationale.
const HOMEPAGE_FOLDER_ROW_CAP_THRESHOLD = 48;
const HOMEPAGE_FOLDER_ROW_CAP = 8;

const FOLDER_BY_KEY = Object.fromEntries(FOLDERS.map((f) => [f.key, f]));
const FOLDER_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t.folder]));

/**
 * @param {string} slug
 * @returns {string} the tool's folder key, or DEFAULT_FOLDER ('developer')
 *   for a slug with no explicit entry -- so a newly merged tool can never
 *   break the build. test/folders.test.mjs asserts every slug in the real
 *   TOOLS registry has an explicit entry, so this fallback is never
 *   silently relied on for a shipped tool page; it only protects a brief
 *   window between a tool merging and its folder row landing.
 */
function folderOf(slug) {
  return FOLDER_BY_SLUG[slug] || DEFAULT_FOLDER;
}

/**
 * @param {string} key a FOLDERS[].key.
 * @returns {object[]} every tool assigned to that folder, in TOOLS'
 *   (alphabetical-by-filename) order.
 */
function toolsInFolder(key) {
  return TOOLS.filter((t) => folderOf(t.slug) === key);
}

module.exports = {
  FOLDERS,
  FOLDER_BY_KEY,
  FOLDER_BY_SLUG,
  DEFAULT_FOLDER,
  HOMEPAGE_FOLDER_ROW_CAP_THRESHOLD,
  HOMEPAGE_FOLDER_ROW_CAP,
  folderOf,
  toolsInFolder,
};
