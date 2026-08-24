'use strict';

/**
 * sitemap.xml / robots.txt generation, derived from the actual list of
 * paths the build wrote -- never hand-maintained, so it cannot drift from
 * what's really on disk. 404.html is excluded (the static-hosting error
 * page, never a real destination).
 */

const { absoluteUrl, BUILD_DATE } = require('./site.js');
const { FOLDERS } = require('./folders.js');

/**
 * @param {Array<{category:string, slug:string}>} tools the TOOLS registry.
 * @returns {string[]} every root-relative directory path the build writes
 *   an index.html for (excluding 404.html, a static-hosting error page,
 *   never a real destination, and excluding the noindex /data/ helper
 *   page -- see src/build.js's comment on that page). Folder index paths
 *   are derived from FOLDERS (src/folders.js), never hand-listed, so a
 *   future folder addition is automatically picked up here too. The one
 *   shared source for both sitemap.xml (src/build.js) and the post-deploy
 *   IndexNow ping (scripts/indexnow-ping.js), so the two can never list
 *   different URLs.
 */
function sitemapPathsFor(tools) {
  return [
    '',
    'how-this-works/',
    'privacy/',
    ...FOLDERS.map((f) => `${f.slug}/`),
    ...tools.map((t) => `${t.category}/${t.slug}/`),
  ];
}

/**
 * @param {string[]} paths root-relative directory paths as written to
 *   dist/ (e.g. '', 'pdf/merge-pdf/', 'privacy/'). '404.html' is filtered.
 * @returns {Array<{path:string, loc:string, lastmod:string}>} sorted for
 *   deterministic output.
 */
function buildSitemapEntries(paths) {
  return paths
    .filter((p) => p !== '404.html')
    .slice()
    .sort()
    .map((p) => ({ path: p, loc: absoluteUrl(p), lastmod: BUILD_DATE }));
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string[]} paths see buildSitemapEntries.
 * @returns {string} sitemaps.org 0.9 schema. No priority/changefreq --
 *   Google ignores both.
 */
function renderSitemapXml(paths) {
  const entries = buildSitemapEntries(paths);
  const urls = entries
    .map((e) => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxtContent() {
  return `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl('sitemap.xml')}\n`;
}

module.exports = { sitemapPathsFor, buildSitemapEntries, renderSitemapXml, robotsTxtContent };
