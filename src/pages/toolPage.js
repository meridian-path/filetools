'use strict';

const { renderPage, adSlot, escapeHtml, HOME_CRUMB } = require('../shell.js');
const { breadcrumbJsonLd, softwareApplicationJsonLd, faqPageJsonLd } = require('../structuredData.js');
const { toolBySlug } = require('../tools/index.js');
const { url, absoluteUrl } = require('../site.js');
const { markFor } = require('../icons.js');
const { familyOf } = require('../families.js');
const { folderOf, FOLDER_BY_KEY } = require('../folders.js');
const { assembleBrowserClients } = require('../browserClients.js');

// Assembled (2026-08-22 fragment-pattern refactor) from each tool's own
// `maxBytes` field (src/browserClients.js), the same source
// src/build.js's generated dropzone.registry.generated.js draws its own
// copy of this map from -- see that file's header comment for why the
// browser-facing copy still has to be generated separately rather than
// shared as one runtime module (this file is Node/CommonJS build-time
// code; the browser copy is a plain ES module with no bundler). Only used
// here to render an honest per-tool caption; the actual enforcement is
// dropzone.client.js's job.
const { MAX_BYTES_BY_CLIENT } = assembleBrowserClients();
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

function formatMb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * @param {object} tool one entry from src/tools/index.js.
 * @param {{exampleHtml?: string, exampleAriaLabel?: string, exampleNote?: string}} [example]
 *   The tool's generated output-example panel (src/examples/index.mjs),
 *   resolved by src/build.js before calling this function -- this file
 *   stays synchronous and pure, so example resolution (which needs an
 *   async import() of an ESM module) happens once in the caller, not
 *   here. exampleHtml is '' for a tool with no example module yet, in
 *   which case no .how-band / <figure> is rendered at all and the "how it
 *   works" list renders as a plain single-column list.
 * @returns {string} the complete standalone HTML document for that tool's
 *   page. Shared by all three merge/split/rotate tool pages -- the client
 *   module (src/browser/pdfPages.client.js) reads data-mode off #tool to
 *   decide which controls to render/behave as, so this template does not
 *   fork per tool beyond copy and the accept/multiple attributes.
 */
function renderToolPage(tool, example = {}) {
  const { exampleHtml = '', exampleAriaLabel = '', exampleNote = '' } = example;
  const canonical = absoluteUrl(`${tool.category}/${tool.slug}/`);
  // A custom-panel tool (e.g. uuid-generator.js, regex-tester.js) has no
  // FILE input at all -- either no input whatsoever (a generator) or a
  // live pattern/text pair that should update on every keystroke, not
  // wait for a "Convert" click (a live tool like the regex tester) -- so
  // it skips the entire dropzone/paste-input block below and loads its own
  // client file directly instead of going through ./dropzone.client.js's
  // file-driven PROCESSORS routing. That client file owns 100% of its own
  // interactive surface. Every other tool on the site is file/paste-driven,
  // so this stays a single boolean flag rather than its own page template.
  const isCustomPanel = !!tool.customPanelMode;

  const howItems = tool.howSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('\n        ');
  // Native <details>/<summary> disclosure, not a JS accordion -- zero extra
  // JS, correct keyboard/screen-reader behaviour by construction, and every
  // answer stays present in the served HTML (accordion content that's
  // injected only on interaction is treated as lower-weight by search
  // engines; native <details> keeps 100% of the text in the served HTML).
  // The first two items ship `open` so the two highest-value answers
  // (privacy first) keep their immediately-visible weight; the rest are
  // collapsed.
  const faqItems = tool.faqs.map((f, i) => `<details class="faq-item"${i < 2 ? ' open' : ''}>
        <summary><h3>${escapeHtml(f.q)}</h3></summary>
        <p>${f.answerHtml}</p>
      </details>`).join('\n      ');

  // A single inline glyph+text row under a hairline, not a 3-card grid --
  // giving "related" content-block visual weight on every one of this
  // site's tool pages was the single largest contributor to identical
  // section silhouettes across pages (design-standards.md). Every link and
  // its anchor text is unchanged from the card version; only the
  // restated-deck paragraph is dropped.
  const related = tool.relatedSlugs
    .map((slug) => toolBySlug(slug))
    .filter(Boolean)
    .map((t) => `<a class="related-link" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${markFor(t.slug)}${escapeHtml(t.navLabel)}</a>`)
    .join('\n      ');

  // Explicit '' (a tool that accepts any file type, e.g. hash-generator.js)
  // is deliberately distinct from the field being omitted entirely (every
  // PDF tool -- default 'PDF') -- '' means "no type name in the copy",
  // producing "Drop your files here" rather than a doubled-up "Drop your
  // file files here".
  const fileTypeLabel = tool.fileTypeLabel === undefined ? 'PDF' : tool.fileTypeLabel;
  const dzTitle = tool.multiple
    ? (fileTypeLabel ? `Drop your ${fileTypeLabel} files here` : 'Drop your files here')
    : (fileTypeLabel ? `Drop your ${fileTypeLabel} here` : 'Drop a file here');
  const chooseLabel = tool.multiple ? 'Choose files' : 'Choose file';

  const pasteHtml = (!isCustomPanel && tool.pasteInput)
    ? `<div class="or-divider" role="separator" aria-label="or"><span>or</span></div>
      <div class="paste-input">
        <label for="paste-textarea">${escapeHtml(tool.pasteInput.label)}</label>
        <textarea id="paste-textarea" class="paste-textarea" placeholder="${escapeHtml(tool.pasteInput.placeholder)}" rows="6" spellcheck="false"></textarea>
        <button type="button" id="paste-convert" class="btn-secondary paste-convert-btn">${escapeHtml(tool.pasteInput.buttonLabel)}</button>
      </div>`
    : '';

  const dropzoneHtml = isCustomPanel ? '' : `<div class="dropzone" data-state="idle">
        <div class="dz-icon-wrap mark--${escapeHtml(familyOf(tool.slug))}">
          ${markFor(tool.slug, 'dz-icon')}
          <svg class="dz-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12.5 9.5 18 20 6"/></svg>
        </div>
        <p class="dz-title">${escapeHtml(dzTitle)}</p>
        <label class="btn-primary" for="file-input">${escapeHtml(chooseLabel)}</label>
        <input id="file-input" type="file" class="sr-only" accept="${escapeHtml(tool.accepts)}"${tool.multiple ? ' multiple' : ''}>
        <p class="dz-caption">Up to ${formatMb(MAX_BYTES_BY_CLIENT[tool.clientEntry] || DEFAULT_MAX_BYTES)} per file. Stays on this device.</p>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill"></div></div>
        <button type="button" class="btn-secondary dz-cancel">Cancel</button>
      </div>
      <p class="dz-proof">Nothing is sent anywhere. Turn off your Wi-Fi and this page still works - try it.</p>`;

  // Real, generated (not drawn) live output example -- fills the empty
  // right half of the page at >=1024px. A tool with no example module yet
  // renders the plain single-column how-steps list, unchanged. Carries
  // mark--<family> the same way .dz-icon-wrap below does, purely so the
  // --mark-plate/--mark-wash custom properties are in scope here too --
  // needed by Pattern D's page-strip diagrams (.td-accent, src/css.js), so
  // an "after" page agrees with this tool's own family color rather than
  // the site-wide accent teal.
  const outputExampleHtml = exampleHtml
    ? `<figure class="output-example mark--${escapeHtml(familyOf(tool.slug))}"${exampleAriaLabel ? ` aria-label="${escapeHtml(exampleAriaLabel)}"` : ''}>
          <figcaption>Example output</figcaption>
          <div class="output-example-body">${exampleHtml}</div>
          <p class="output-example-note">${escapeHtml(exampleNote)}</p>
        </figure>`
    : '';

  const howHtml = outputExampleHtml
    ? `<div class="how-band">
        <ol class="how-steps">
        ${howItems}
        </ol>
        ${outputExampleHtml}
      </div>`
    : `<ol class="how-steps">
        ${howItems}
      </ol>`;

  // Pro-feature upsell (currently only compare-csv.js's paid batch/Excel-report add-on):
  // a self-contained additive section loaded by its own client script,
  // entirely separate from the free dropzone flow above -- see
  // src/browser/compareCsvPro.client.js's header comment for the full
  // design. `gumroadBuyUrl`/`gumroadProductPermalink` stay unset until a
  // human creates the real Gumroad product; the client script renders an
  // honest "not listed for sale yet" state until then, never a live-looking
  // but broken purchase link.
  const proFeatureHtml = tool.proFeature ? `
    <section class="pro-feature" aria-labelledby="pro-h"${tool.proFeature.gumroadBuyUrl ? ` data-gumroad-buy-url="${escapeHtml(tool.proFeature.gumroadBuyUrl)}"` : ''}${tool.proFeature.gumroadProductPermalink ? ` data-gumroad-product="${escapeHtml(tool.proFeature.gumroadProductPermalink)}"` : ''}>
      <h2 id="pro-h">${escapeHtml(tool.h1)} Pro</h2>
      <div class="pro-feature-body"></div>
    </section>
    <script type="module" src="${escapeHtml(url(`js/${tool.proFeature.clientEntry}.client.js`))}"></script>` : '';

  const mainHtml = `    <h1>${escapeHtml(tool.h1)}</h1>
    <p class="deck">${escapeHtml(tool.deck)}</p>
    <section id="tool" aria-labelledby="tool-h" data-mode="${escapeHtml(tool.mode)}" data-client="${escapeHtml(tool.clientEntry)}" data-accept="${escapeHtml(tool.accepts)}" data-file-type-label="${escapeHtml(fileTypeLabel)}"${tool.multiple ? ' data-multiple="true"' : ''}>
      <h2 id="tool-h" class="sr-only">${escapeHtml(tool.h1)}</h2>
      ${dropzoneHtml}
      ${pasteHtml}
      <div class="dz-status" role="status" aria-live="polite"></div>
      <div class="result" hidden></div>
    </section>

    <section class="how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      ${howHtml}
    </section>

    <section class="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Frequently asked questions</h2>
      ${faqItems}
    </section>
    ${proFeatureHtml}

    ${adSlot('inContent')}

    <section class="related" aria-labelledby="related-h">
      <h2 id="related-h">Related tools</h2>
      <p class="related-row">
      ${related}
      </p>
    </section>

    <p class="caption">Files are processed locally in your browser and never uploaded. Read more on the <a href="${escapeHtml(url('privacy/'))}">privacy page</a>.</p>

    ${isCustomPanel
      ? `<script type="module" src="${escapeHtml(url(`js/${tool.clientEntry}.client.js`))}"></script>`
      : `<script type="module" src="${escapeHtml(url('js/dropzone.client.js'))}"></script>`}
`;

  // Three-level path (site-wide navigation/IA redesign, see the folder
  // taxonomy/nav spec section 1.4/3.4): Home -> folder -> tool. The folder segment
  // links to that folder's own index page even for a /data/-hosted tool
  // (the display folder never mirrors the physical URL category) -- this
  // display path deliberately diverges from the physical URL, which
  // Google's breadcrumb documentation explicitly prefers over mirroring
  // URL structure (cited in full in src/pages/folder.js).
  const folder = FOLDER_BY_KEY[folderOf(tool.slug)];
  const folderUrl = url(`${folder.slug}/`);

  const jsonLd = [
    softwareApplicationJsonLd({ name: tool.h1, description: tool.metaDescription, url: canonical }),
    breadcrumbJsonLd([
      { name: 'Home', url: absoluteUrl() },
      { name: folder.label, url: absoluteUrl(`${folder.slug}/`) },
      { name: tool.h1, url: canonical },
    ]),
    faqPageJsonLd(tool.faqs.map((f) => ({ q: f.q, answerHtml: f.answerHtml }))),
  ];

  return renderPage({
    slug: tool.slug,
    title: tool.title,
    metaDescription: tool.metaDescription,
    breadcrumb: [
      HOME_CRUMB,
      { name: folder.slug, href: folderUrl },
      { name: tool.slug },
    ],
    mainHtml,
    jsonLd,
    canonical,
    wide: true,
    skipTarget: '#tool',
  });
}

module.exports = { renderToolPage };
