'use strict';

/**
 * The shared page shell every page on the site is built from -- home, every
 * tool page, /how-this-works/, /privacy/, and 404. There is no second
 * layout. Header nav, footer "all tools", and the related-tools grid are
 * all derived from the TOOLS registry (src/tools/index.js), so a new tool
 * page never requires touching this file.
 */

const { SITE_NAME, SITE_TAGLINE, BASE_PATH, url, absoluteUrl } = require('./site.js');
const { SITE_CSS, FONT_WOFF2_URL } = require('./css.js');
const { FAVICON_DATA_URI } = require('./icon.js');
const { adSlot, adsScriptTag } = require('./ads.js');
const adConfig = require('./adConfig.js');
const { TOOLS, toolBySlug } = require('./tools/index.js');
const {
  FOLDERS, FOLDER_BY_KEY, toolsInFolder, folderOf, HOMEPAGE_FOLDER_ROW_CAP_THRESHOLD, HOMEPAGE_FOLDER_ROW_CAP,
} = require('./folders.js');
const { folderGlyph } = require('./icons.js');

const GOATCOUNTER_URL = 'https://dg-filetools.goatcounter.com/count';
const KOFI_URL = 'https://ko-fi.com/flavaa';
const BMC_URL = 'https://buymeacoffee.com/dylanger254';
const OG_DEFAULT_IMAGE = absoluteUrl('og-default.png');

/**
 * Shared social-link mark (a ring, a jagged upward line, a dot at the tip)
 * recreated as inline SVG from the operator's own profile picture. Colors
 * are the artist's fixed brand colors, not derived from this site's own
 * token ramp, so the mark stays recognizable and identical across every
 * property and the social profile itself -- same self-contained-asset
 * exemption from the tokens-only rule as icon.js's ICON_SVG.
 */
const SOCIAL_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="47" fill="#0f2233"/><circle cx="50" cy="50" r="35" fill="none" stroke="#6f95a1" stroke-width="3"/><path d="M16 74 L38 58 L50 66 L83 27" fill="none" stroke="#c99a44" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="83" cy="27" r="9" fill="#f2e0a8"/></svg>';

/**
 * Portfolio-wide footer credit line -- identical wording/type role on all
 * three properties, naming the operator and linking to the other two, by
 * design (this is deliberately shared across the whole portfolio).
 */
function renderFooterCredit() {
  return `<p class="footer-credit">Built by Dylan, also making <a href="https://repertoire-builder.com" rel="noopener noreferrer">Repertoire Builder</a> and <a href="https://lol-practice-system.com" rel="noopener noreferrer">Solo Queue Practice</a>. <a class="footer-social" href="https://x.com/builtittheycome" rel="noopener noreferrer">${SOCIAL_ICON_SVG}Follow @builtittheycome</a></p>`;
}

/**
 * The build-time tool index quick-open reads (site-wide navigation/IA
 * redesign, see the folder taxonomy/nav spec section 1.7): slug/navLabel/
 * deck/folder label/url for every tool, embedded once per page in a
 * `<script type="application/json">` block (never `application/ld+json` --
 * this isn't structured data, just a trusted data source for
 * filter.client.js's quick-open combobox). `<` escaping matches
 * structuredData.js's jsonLdScript() precedent, so a future tool deck
 * containing "</script>" can never break out of the tag even though this
 * data is build-time trusted, not visitor input.
 */
function toolIndexScript() {
  const items = TOOLS.map((t) => ({
    slug: t.slug,
    navLabel: t.navLabel,
    deck: t.deck,
    folder: FOLDER_BY_KEY[folderOf(t.slug)].label,
    url: url(`${t.category}/${t.slug}/`),
  }));
  const json = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<script type="application/json" id="tool-index">${json}</script>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{title:string, description:string, canonical:string,
 *   ogType?:'website'|'article', jsonLd?:string[], noindex?:boolean}} opts
 * @returns {string} a full <head>...</head> block.
 */
function documentHead(opts) {
  const { title, description, canonical, ogType = 'website', jsonLd = [], noindex, feedUrl } = opts;

  const robotsMeta = noindex ? '\n  <meta name="robots" content="noindex">' : '';
  const feedLink = feedUrl
    ? `\n  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)} - new tools" href="${escapeHtml(feedUrl)}">`
    : '';
  const og = `\n  <meta property="og:title" content="${escapeHtml(title)}">` +
    `\n  <meta property="og:description" content="${escapeHtml(description)}">` +
    `\n  <meta property="og:url" content="${escapeHtml(canonical)}">` +
    `\n  <meta property="og:type" content="${escapeHtml(ogType)}">` +
    `\n  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">` +
    `\n  <meta property="og:image" content="${escapeHtml(OG_DEFAULT_IMAGE)}">` +
    `\n  <meta property="og:image:width" content="1200">` +
    `\n  <meta property="og:image:height" content="630">` +
    `\n  <meta name="twitter:card" content="summary_large_image">`;
  const jsonLdBlock = jsonLd.length ? `\n  ${jsonLd.join('\n  ')}` : '';

  return `<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="object-src 'none'; base-uri 'none'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">${robotsMeta}${og}${feedLink}
  <meta name="google-adsense-account" content="${escapeHtml(adConfig.client)}">
  <link rel="preload" as="font" type="font/woff2" href="${escapeHtml(FONT_WOFF2_URL)}" crossorigin>
  <link rel="icon" href="${FAVICON_DATA_URI}">
  <link rel="icon" type="image/svg+xml" href="${escapeHtml(url('favicon.svg'))}">
  <link rel="apple-touch-icon" href="${escapeHtml(url('apple-touch-icon.png'))}">
  <style>${SITE_CSS}</style>${jsonLdBlock}
  ${adsScriptTag()}
  <script data-goatcounter="${GOATCOUNTER_URL}" data-goatcounter-settings='{"allow_query":["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref"]}' async src="https://gc.zgo.at/count.js" crossorigin="anonymous"></script>
</head>`;
}

/**
 * One folder's own disclosure inside the nav tree: a summary row (glyph +
 * label + count, linking to that folder's index page) above its tool
 * links. Below 1024px this is a real, independently-toggling disclosure
 * (grouped via the native `name` attribute so opening one closes any
 * other open sibling on narrow/touch viewports -- a progressive
 * enhancement that degrades to independently-toggleable in a browser
 * that doesn't support grouped <details> yet, never broken). At and
 * above 1024px, src/css.js forces every folder-group open regardless of
 * its [open] attribute, laying all five out as columns in one panel --
 * see that file's own comment on the breakpoint.
 *
 * @param {object} folder one FOLDERS entry.
 * @param {string|null} activeSlug the current page's slug (a tool slug or
 *   a folder slug -- the two namespaces never collide, see
 *   test/folders.test.mjs).
 */
function renderFolderNavGroup(folder, activeSlug) {
  const tools = toolsInFolder(folder.key);
  const folderHref = url(`${folder.slug}/`);
  const isActiveFolder = activeSlug === folder.slug;
  const toolLinks = tools.map((t) =>
    `<li><a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}"${activeSlug === t.slug ? ' aria-current="page"' : ''}>${escapeHtml(t.navLabel)}</a></li>`
  ).join('\n            ');

  return `<details class="folder-group" name="site-nav-folder-group">
          <summary class="folder-group-summary">
            ${folderGlyph(folder.familyKey, 'folder-glyph-nav')}
            <a class="folder-group-link" href="${escapeHtml(folderHref)}"${isActiveFolder ? ' aria-current="page"' : ''}>${escapeHtml(folder.label)}</a>
            <span class="folder-group-count">${tools.length}</span>
          </summary>
          <ul class="folder-tool-list">
            ${toolLinks}
          </ul>
        </details>`;
}

/**
 * @param {string|null} activeSlug the current page's slug -- a tool slug,
 *   a folder slug, 'how-this-works', or null on a page with none of
 *   those (home, privacy).
 */
function renderHeader(activeSlug) {
  const folderGroups = FOLDERS.map((f) => renderFolderNavGroup(f, activeSlug)).join('\n        ');

  // Native <details>/<summary> disclosure, same zero-JS pattern as the FAQ
  // accordion in toolPage.js. Closed by default at every viewport width
  // (site-wide navigation/IA redesign, see the folder taxonomy/nav spec
  // section 1.3): unlike the old flat 29-link dump, the folder tree is real content
  // worth a deliberate "open" action even on desktop, not just a mobile
  // space-saving measure -- src/css.js's >=1024px rule now only changes
  // how the OPEN panel lays out (five columns instead of one stacked
  // list), never whether it starts open. No menu/tree/menubar role
  // anywhere here: the W3C APG's own disclosure-navigation pattern
  // states site nav should use a plain nav landmark, not a widget role
  // that implies a different keyboard contract than these plain links
  // already have.
  return `<header class="site-header">
    <a class="brand" href="${escapeHtml(url())}">file<span class="brand-tail">tools</span></a>
    <details class="site-nav-disclosure">
      <summary class="site-nav-summary">Browse ~/</summary>
      <nav class="site-nav-tree" aria-label="Folders">
        ${folderGroups}
        <a class="site-nav-tree-extra" href="${escapeHtml(url('how-this-works/'))}"${activeSlug === 'how-this-works' ? ' aria-current="page"' : ''}>How this works</a>
      </nav>
    </details>
  </header>`;
}

/**
 * The path bar's first segment on every page below home (site-wide
 * navigation/IA redesign, see the folder taxonomy/nav spec section 1.4): visible text
 * is the mono "~" home-directory shorthand, with a real "Home" label for
 * assistive tech via renderBreadcrumb()'s ariaLabel support below. The
 * home page itself renders no breadcrumb at all (it doesn't pass one to
 * renderPage) -- "the window chrome owns '~'" there, per the spec.
 */
const HOME_CRUMB = { name: '~', href: url(), ariaLabel: 'Home' };

/**
 * @param {Array<{name:string, href?:string, ariaLabel?:string}>} crumbs
 *   first entry is home (see HOME_CRUMB); the last entry (current page)
 *   should omit href. `ariaLabel`, when present, overrides the linked
 *   segment's accessible name without changing its visible text -- used
 *   for HOME_CRUMB's "~" glyph, which needs a real word for a screen
 *   reader even though its printed form is a path shorthand.
 */
function renderBreadcrumb(crumbs) {
  const items = crumbs
    .map((c, i) => {
      const isLast = i === crumbs.length - 1;
      const ariaLabelAttr = c.ariaLabel ? ` aria-label="${escapeHtml(c.ariaLabel)}"` : '';
      const inner = c.href && !isLast
        ? `<a href="${escapeHtml(c.href)}"${ariaLabelAttr}>${escapeHtml(c.name)}</a>`
        : `<span aria-current="page"${ariaLabelAttr}>${escapeHtml(c.name)}</span>`;
      const sep = i > 0 ? '<span class="sep" aria-hidden="true">/</span>' : '';
      return `${sep}${inner}`;
    })
    .join('');
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${items}</nav>`;
}

// Newsletter signup: a plain outbound link to the project's Substack
// publication, styled as a normal footer link -- no embedded iframe.
// Craft-audit follow-up (2026-08-29 reference-library audit): this used to
// lazy-load Substack's own hosted subscribe widget once its footer slot
// scrolled into view, which rendered that provider's own dark avatar tile,
// publication name, and orange "Subscribe" button on every one of this
// site's 54 pages -- three brand elements that are not filetools' own,
// competing with this site's single teal accent (this design system's own
// "exactly ONE accent-filled action per view" rule) directly under a
// footer whose accent is teal. Removed entirely rather than restyled: the
// iframe's interior is cross-origin content this stylesheet has no access
// to restyle, so containment had already hit its ceiling (see the CSS
// comment this replaced). A plain link loses no real capability at this
// site's current subscriber volume and needs no lazy-load machinery at all.
const SUBSTACK_PUBLICATION_URL = 'https://builtittheycome.substack.com';

/**
 * Sitewide newsletter signup, rendered inside the shared footer so it
 * appears on every page.
 */
function renderNewsletterSignup() {
  return `<div class="newsletter-signup">
      <h2 class="newsletter-heading">Hear about new tools</h2>
      <p class="newsletter-description">One email when a new tool ships. No spam, unsubscribe anytime. <a href="${escapeHtml(SUBSTACK_PUBLICATION_URL)}" target="_blank" rel="noopener noreferrer">Subscribe on Substack</a>.</p>
    </div>`;
}

function renderFooter() {
  const groups = FOLDERS
    .map((folder) => {
      const allTools = toolsInFolder(folder.key);
      // Scale valve (spec 1.10/1.12): only above HOMEPAGE_FOLDER_ROW_CAP_THRESHOLD
      // tools total does a footer group cap itself, at HOMEPAGE_FOLDER_ROW_CAP
      // most-recent-by-launchDate rows plus a link to the folder's own full
      // page -- reusing the same threshold/cap the homepage's own folder
      // sections use (src/folders.js), since the spec gives both the
      // identical numbers. At today's tool count this never trims anything;
      // every row still renders.
      const capped = TOOLS.length > HOMEPAGE_FOLDER_ROW_CAP_THRESHOLD
        ? [...allTools].sort((a, b) => (a.launchDate < b.launchDate ? 1 : -1)).slice(0, HOMEPAGE_FOLDER_ROW_CAP)
        : allTools;
      const items = capped
        .map((t) => `<li><a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${escapeHtml(t.navLabel)}</a></li>`)
        .join('\n        ');
      const seeAllItem = capped.length < allTools.length
        ? `\n        <li><a href="${escapeHtml(url(`${folder.slug}/`))}">All ${escapeHtml(folder.label)} -&gt;</a></li>`
        : '';
      return `<div class="footer-group">
        <h3><a href="${escapeHtml(url(`${folder.slug}/`))}">${escapeHtml(folder.label)}</a></h3>
        <ul>
        ${items}${seeAllItem}
        </ul>
      </div>`;
    })
    .join('\n      ');

  return `<footer class="site-footer">
    <div class="footer-groups">
      ${groups}
      <div class="footer-group">
        <h3>Site</h3>
        <ul>
          <li><a href="${escapeHtml(url('how-this-works/'))}">How this works</a></li>
          <li><a href="${escapeHtml(url('privacy/'))}">Privacy</a></li>
        </ul>
      </div>
    </div>
    <p>No accounts. No file uploads. Your files are processed on your device.</p>
    <p class="footer-legal">
      <a href="${escapeHtml(url('privacy/'))}">Privacy</a>
      <a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>
      <a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>
    </p>
    ${renderFooterCredit()}
    ${renderNewsletterSignup()}
    ${adSlot('footer')}
    <p class="caption">&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}</p>
  </footer>`;
}

/**
 * @param {{slug?:string, title:string, metaDescription:string, h1:string,
 *   deck?:string, breadcrumb?:Array<{name:string, href?:string}>,
 *   mainHtml:string, jsonLd?:string[], canonical:string, wide?:boolean,
 *   noindex?:boolean}} opts
 * @returns {string} a complete standalone HTML document.
 */
function renderPage(opts) {
  const { slug = null, title, metaDescription, breadcrumb, mainHtml, jsonLd, canonical, wide, noindex, skipTarget = '#main', feedUrl } = opts;
  const breadcrumbHtml = breadcrumb ? renderBreadcrumb(breadcrumb) : '';
  const skipLabel = skipTarget === '#tool' ? 'Skip to tool' : 'Skip to content';

  return `<!doctype html>
<html lang="en">
${documentHead({ title, description: metaDescription, canonical, jsonLd, noindex, feedUrl })}
<body>
  <a class="skip-link" href="${escapeHtml(skipTarget)}">${escapeHtml(skipLabel)}</a>
  ${renderHeader(slug)}
  <main id="main" class="page-shell${wide ? ' page-shell-app' : ''}">
    ${breadcrumbHtml}
${mainHtml}
  </main>
  ${renderFooter()}
  ${toolIndexScript()}
  <script type="module" src="${escapeHtml(url('js/filter.client.js'))}"></script>
</body>
</html>
`;
}

module.exports = {
  SITE_CSS,
  KOFI_URL,
  BMC_URL,
  HOME_CRUMB,
  escapeHtml,
  toolIndexScript,
  documentHead,
  renderHeader,
  renderFooter,
  renderNewsletterSignup,
  renderBreadcrumb,
  renderPage,
  adSlot,
};
