import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Site-wide broken-internal-link check against the real BUILT dist/
 * output -- crawls every *.html file, extracts every href/src, and
 * verifies each internal one (root-relative, matching src/site.js's
 * BASE_PATH = '/' convention) resolves to a real file in dist/. External
 * links (http/https/mailto/tel) and same-page anchors (#foo) are
 * classified but not fetched -- this is a static filesystem check, not a
 * live crawler, so it can never flag a real external outage or false-
 * positive on network flakiness. Requires `npm run build` to have already
 * produced dist/, same convention every e2e test in this suite uses.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const HTML_FILES = findHtmlFiles(DIST);

const HREF_SRC_RE = /\s(?:href|src)="([^"]*)"/g;

function extractLinks(html) {
  const links = [];
  let m;
  while ((m = HREF_SRC_RE.exec(html))) links.push(m[1]);
  return links;
}

function classify(link) {
  if (/^(https?:|mailto:|tel:)/i.test(link)) return 'external';
  if (link.startsWith('#')) return 'anchor';
  if (link.startsWith('data:')) return 'data-uri';
  return 'internal';
}

/**
 * Resolves a root-relative internal link (e.g. "/data/hash-generator/" or
 * "/js/foo.client.js") to a real filesystem path under DIST, applying the
 * same trailing-slash-means-index.html convention src/build.js's own
 * writeHtml() uses.
 */
function resolveInternalLink(link) {
  const withoutQuery = link.split('#')[0].split('?')[0];
  if (!withoutQuery) return null; // a bare "#fragment" or "?query" link, already classified separately
  const relPath = withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
  const resolved = relPath === '' || relPath.endsWith('/') ? path.join(DIST, relPath, 'index.html') : path.join(DIST, relPath);
  return resolved;
}

test('every *.html file in dist/ was actually found (sanity check for the crawler itself)', () => {
  assert.ok(HTML_FILES.length >= 30, `expected at least 30 built pages, found ${HTML_FILES.length}`);
});

test('every internal href/src across the whole built site resolves to a real file in dist/', () => {
  const broken = [];
  for (const file of HTML_FILES) {
    const html = fs.readFileSync(file, 'utf8');
    for (const link of extractLinks(html)) {
      if (classify(link) !== 'internal') continue;
      const resolved = resolveInternalLink(link);
      if (resolved && !fs.existsSync(resolved)) {
        broken.push(`${path.relative(DIST, file)} -> "${link}" (resolved to missing ${path.relative(DIST, resolved)})`);
      }
    }
  }
  assert.deepEqual(broken, [], `broken internal links found:\n${broken.join('\n')}`);
});

test('every tool page links back to Home ("~") in its breadcrumb', () => {
  // A real tool page is nested two levels under dist/ (<category>/<slug>/
  // index.html) -- deliberately excludes the folder index pages
  // themselves (<category-or-folder>/index.html, one level deep), which
  // also happen to contain "pdf"/"data" as path substrings but are not
  // tool pages.
  const toolPages = HTML_FILES.filter((f) => /[\\/](pdf|data)[\\/][^\\/]+[\\/]index\.html$/.test(f));
  assert.ok(toolPages.length >= 25, `expected at least 25 tool pages, found ${toolPages.length}`);
  const missing = [];
  for (const file of toolPages) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('class="breadcrumb"') || !/<a href="\/" aria-label="Home">~<\/a>/.test(html)) {
      missing.push(path.relative(DIST, file));
    }
  }
  assert.deepEqual(missing, [], `tool pages missing a Home breadcrumb link:\n${missing.join('\n')}`);
});

test('every non-external link uses a root-relative path (starts with "/"), never a bare relative path that would break under a nested URL', () => {
  // A relative link like "js/foo.js" (no leading slash) resolves differently
  // depending on the CURRENT page's own depth -- correct from
  // /data/foo/index.html, wrong from /index.html. This site's BASE_PATH
  // convention (src/site.js) is root-relative everywhere, so any bare
  // relative internal link is itself a bug, independent of whether it
  // happens to resolve on the filesystem check above.
  const offenders = [];
  for (const file of HTML_FILES) {
    const html = fs.readFileSync(file, 'utf8');
    for (const link of extractLinks(html)) {
      if (classify(link) !== 'internal') continue;
      if (!link.startsWith('/')) offenders.push(`${path.relative(DIST, file)} -> "${link}"`);
    }
  }
  assert.deepEqual(offenders, [], `bare relative (non-root-relative) internal links found:\n${offenders.join('\n')}`);
});
