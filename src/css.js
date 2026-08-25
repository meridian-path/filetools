'use strict';

/**
 * The site's one stylesheet, inlined into every page's <head> (src/shell.js)
 * for fast static delivery with no render-blocking request. Built from
 * DESIGN_TOKENS (src/tokens.js) -- every color/size/spacing value below is a
 * var(--token), never a literal hex or px, so the whole palette/scale can be
 * changed from one file.
 */

const { DESIGN_TOKENS, designTokensCss } = require('./tokens.js');
const { url: sitePath } = require('./site.js');

const FONT_WOFF2_PATH = 'vendor/fonts/space-grotesk/space-grotesk-latin-wght-normal.woff2';
const FONT_WOFF2_URL = sitePath(FONT_WOFF2_PATH);

const SITE_CSS = `
  /* Space Grotesk (display face) -- self-hosted from vendor/fonts/, Latin
     subset only. See tokens.js's --font-display comment for the license
     and CLS notes. Variable-weight file covers 300-700 in one request. */
  @font-face {
    font-family: 'Space Grotesk Variable';
    font-style: normal;
    font-display: swap;
    font-weight: 300 700;
    src: url('${FONT_WOFF2_URL}') format('woff2-variations');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }

  :root {
${designTokensCss(DESIGN_TOKENS)}
  }

  * { box-sizing: border-box; }

  /* prefers-reduced-motion: state changes (color/border/text) stay; only
     their timing collapses. The one exception is the working-state
     indeterminate progress loop below, which is an ongoing-work indicator
     rather than decoration and is separately suppressed by name. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  html { background: var(--color-bg); }

  body {
    margin: 0;
    font-family: var(--font-sans);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: var(--leading-normal);
    font-size: var(--text-base);
    -webkit-text-size-adjust: 100%;
  }

  img, svg { max-width: 100%; }

  main { display: block; }

  h1, h2, h3 {
    color: var(--color-text);
    margin: 0 0 var(--space-4);
  }
  h1 { font: var(--type-h1); letter-spacing: var(--tracking-tight); }
  h2 { font: var(--type-h2); margin-top: var(--space-7); }
  h3 { font: var(--type-h3); }

  p, li { margin: 0 0 var(--space-4); }

  main p, main li, main .deck, main blockquote {
    max-width: var(--measure);
  }

  .deck {
    font: var(--type-deck);
    color: var(--color-muted);
    max-width: var(--measure);
  }

  caption, .caption {
    font: var(--type-caption);
    color: var(--color-muted);
  }

  [data-tabular], .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  a { color: var(--color-accent); }
  a:hover { color: var(--color-accent-hover); }

  :focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    transition: outline-color var(--focus-ring-transition);
  }

  /* -------------------------------------------------------------------
     Skip link
     ------------------------------------------------------------------- */
  .skip-link {
    position: absolute;
    left: var(--space-3);
    top: -100px;
    background: var(--color-text);
    color: var(--color-surface);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    z-index: 100;
    transition: top var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .skip-link:focus { top: var(--space-3); }

  /* -------------------------------------------------------------------
     Header / nav
     ------------------------------------------------------------------- */
  .site-header {
    max-width: var(--width-wide);
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .brand {
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    font-size: var(--text-lg);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    text-decoration: none;
  }
  .brand:hover { color: var(--color-text); }
  .brand .brand-tail { color: var(--color-accent); }

  /* The folder tree (site-wide navigation/IA redesign, see the folder
     taxonomy/nav spec section 1.3): the OUTER disclosure ("Browse ~/") stays closed
     by default at EVERY viewport width now -- unlike the old flat
     29-link dump, the folder tree is real content worth a deliberate
     open action even on desktop, not just a mobile space-saving measure
     (Cobalt, REFERENCE_LIBRARY.md entry 2, demotes secondary nav to
     small text rather than pushing primary content down; that same
     "closed until asked for" shape now applies at every width). What
     changes at the INNER folder-group level (>=1024px, below) is layout
     only: five columns instead of one stacked list. No menu/tree/menubar
     role anywhere in this markup (src/shell.js's own comment cites the
     W3C APG disclosure-navigation rationale) -- these are plain
     details/summary and plain links throughout. */
  .site-nav-disclosure { width: 100%; }
  .site-nav-summary {
    cursor: pointer;
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    margin-left: calc(-1 * var(--space-3));
    color: var(--color-text);
    font-weight: var(--weight-medium);
    /* --font-mono is scoped to the path bar/counts/disclosure-content
       only, never a CONTROL like this clickable summary -- the folder
       taxonomy/nav spec's own declared fallback for an out-of-scope
       element ("--font-sans at --weight-medium with --tracking-tight")
       applies here instead. */
    font-family: var(--font-sans);
    letter-spacing: var(--tracking-tight);
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
  }
  .site-nav-summary:hover { color: var(--color-accent); background: var(--color-accent-tint); }
  .site-nav-summary::-webkit-details-marker { display: none; }
  .site-nav-summary::after {
    content: '';
    width: 8px;
    height: 8px;
    border-right: var(--border-control) solid currentColor;
    border-bottom: var(--border-control) solid currentColor;
    transform: rotate(45deg);
    transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .site-nav-disclosure[open] > .site-nav-summary::after { transform: rotate(-135deg); }

  .site-nav-tree {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) 0 var(--space-3);
  }
  .folder-group {
    border-radius: var(--radius-sm);
  }
  .folder-group-summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
  }
  .folder-group-summary:hover { background: var(--color-accent-tint); }
  .folder-group-summary::-webkit-details-marker { display: none; }
  .folder-group-summary::after {
    content: '';
    width: 7px;
    height: 7px;
    margin-left: auto;
    border-right: var(--border-control) solid var(--color-muted);
    border-bottom: var(--border-control) solid var(--color-muted);
    transform: rotate(45deg);
    transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .folder-group[open] > .folder-group-summary::after { transform: rotate(-135deg); }
  .folder-glyph { width: var(--icon-sm); height: var(--icon-sm); flex-shrink: 0; }
  .folder-group-link {
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
  }
  .folder-group-link:hover { color: var(--color-accent); }
  .folder-group-link[aria-current="page"] { color: var(--color-accent); }
  .folder-group-count { font: var(--type-mono-caption); color: var(--color-muted); }
  .folder-tool-list {
    list-style: none;
    margin: 0;
    padding: 0 0 var(--space-2) var(--tree-indent);
  }
  .folder-tool-list a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: var(--space-1) var(--space-3);
    color: var(--color-text);
    text-decoration: none;
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
  }
  .folder-tool-list a:hover { color: var(--color-accent); background: var(--color-accent-tint); }
  .folder-tool-list a[aria-current="page"] { color: var(--color-accent); }
  .site-nav-tree-extra {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    color: var(--color-muted);
    text-decoration: none;
    font-size: var(--text-sm);
    border-top: var(--border-hairline) solid var(--color-border);
    margin-top: var(--space-1);
  }
  .site-nav-tree-extra:hover { color: var(--color-accent); }
  .site-nav-tree-extra[aria-current="page"] { color: var(--color-accent); }

  /* >=1024px: the open panel lays all five folders out as columns, all
     visible at once, instead of one collapsed-by-default stacked list --
     each folder-group is forced open regardless of its own [open]
     attribute (same "author CSS overrides the native collapsed-content
     default" mechanism the old 768px override used for the outer
     disclosure), and its own toggle affordance is removed since it isn't
     interactive at this width -- only the folder name link and the tool
     links underneath it are. */
  @media (min-width: 1024px) {
    .site-nav-tree {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0 var(--space-4);
      padding-top: var(--space-3);
    }
    .folder-group > .folder-tool-list { display: block !important; }
    .folder-group-summary { cursor: default; padding-left: var(--space-1); }
    .folder-group-summary:hover { background: none; }
    .folder-group-summary::after { display: none; }
    .folder-tool-list { padding-left: var(--space-1); }
    .site-nav-tree-extra { grid-column: 1 / -1; }
  }

  /* -------------------------------------------------------------------
     Page shell / breadcrumb (restyled as a mono file path -- site-wide
     navigation/IA redesign, see the folder taxonomy/nav spec section 1.4)
     ------------------------------------------------------------------- */
  .page-shell {
    max-width: var(--width-page);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }
  .page-shell.page-shell-app { max-width: var(--width-app); }

  .breadcrumb {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-muted);
    margin-bottom: var(--space-4);
    overflow: hidden;
  }
  .breadcrumb a {
    color: var(--color-muted);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: var(--space-1) 0;
  }
  .breadcrumb a:hover { color: var(--color-accent); }
  .breadcrumb .sep { margin: 0 var(--space-1); flex-shrink: 0; }
  /* The current (last, unlinked) segment truncates rather than wraps --
     NN/g's breadcrumb guidance warns against wrapping on mobile. */
  .breadcrumb span[aria-current="page"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  /* -------------------------------------------------------------------
     Buttons
     ------------------------------------------------------------------- */
  .btn-primary, .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 48px;
    min-width: 180px;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    font-weight: var(--weight-medium);
    font-size: var(--text-base);
    text-decoration: none;
    cursor: pointer;
    border: var(--border-control) solid transparent;
  }
  .btn-primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }
  .btn-primary:hover { background: var(--color-accent-hover); color: var(--color-accent-contrast); }
  .btn-secondary {
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }
  .btn-secondary:hover { background: var(--color-accent-tint); }
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    border: var(--border-hairline) solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
  }
  .btn-icon:hover { background: var(--color-accent-tint); border-color: var(--color-accent); }
  .btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

  /* -------------------------------------------------------------------
     Icon marks (src/icons.js) -- color context classes only. Every mark
     is aria-hidden inline SVG that draws itself from three custom
     properties (--mark-plate / --mark-wash / --mark-ink); these classes
     are the only place those get a value, and the only place any
     var(--family-*) token is referenced. .mark--(family) carries plate +
     wash (the format); a second class, .mark-ink--(family), carries ink
     (the pip) so a converter can mix two different families on one mark.
     The binding rule (see tokens.js's family-ramp comment for the fuller
     history) is never on text, a link, a button, or a focus ring --
     --color-accent keeps sole ownership of every interactive element's
     own chrome. A --family-X-1 wash disc behind the mark, reusing this
     same .mark--<family> class on the wrapping element, now appears on
     the tool-page dropzone (.dz-icon-wrap) AND, as of the 2026-08-23
     homepage pass, the hero family index (.family-strip-icon-wrap) and
     the tool-list rows (.tool-row-icon-wrap) -- all three decorate a mark
     sitting inside an interactive element, never the element itself.
     ------------------------------------------------------------------- */
  .mark--pdf   { --mark-plate: var(--family-pdf-6);   --mark-wash: var(--family-pdf-1); }
  .mark--csv   { --mark-plate: var(--family-csv-6);   --mark-wash: var(--family-csv-1); }
  .mark--json  { --mark-plate: var(--family-json-6);  --mark-wash: var(--family-json-1); }
  .mark--sheet { --mark-plate: var(--family-sheet-6); --mark-wash: var(--family-sheet-1); }
  .mark--text  { --mark-plate: var(--family-text-6);  --mark-wash: var(--family-text-1); }
  .mark--dev   { --mark-plate: var(--family-dev-6);   --mark-wash: var(--family-dev-1); }
  .mark-ink--pdf   { --mark-ink: var(--family-pdf-8); }
  .mark-ink--csv   { --mark-ink: var(--family-csv-8); }
  .mark-ink--json  { --mark-ink: var(--family-json-8); }
  .mark-ink--sheet { --mark-ink: var(--family-sheet-8); }
  .mark-ink--text  { --mark-ink: var(--family-text-8); }
  .mark-ink--dev   { --mark-ink: var(--family-dev-8); }

  /* -------------------------------------------------------------------
     Drop zone (src/browser/dropzone.client.js)
     ------------------------------------------------------------------- */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 200px;
    padding: var(--space-6);
    text-align: center;
    background: var(--color-surface);
    border: var(--border-drop) dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    transition: border-color var(--motion-duration-fast) var(--motion-ease-standard),
      background var(--motion-duration-fast) var(--motion-ease-standard),
      box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
  }
  @media (max-width: 768px) {
    .dropzone { min-height: 160px; padding: var(--space-5); }
  }
  .dropzone[data-state="dragover"] {
    border-style: solid;
    border-color: var(--color-accent);
    background: var(--color-accent-tint);
    box-shadow: var(--shadow-drop);
  }
  .dropzone[data-state="working"] {
    border-style: solid;
    border-color: var(--color-accent);
  }
  .dropzone[data-state="error"] {
    border-color: var(--color-danger);
    animation: dz-shake 200ms var(--motion-ease-standard);
  }
  .dropzone[data-state="done"] {
    border-color: var(--color-success);
  }
  @keyframes dz-shake {
    0% { transform: translateX(0); }
    30% { transform: translateX(-4px); }
    70% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }

  /* dz-icon-wrap is now a colored circle (var(--mark-wash), set by the
     .mark--<family> class toolPage.js also puts on this element -- custom
     properties inherit down to the .dz-icon svg inside it for
     --mark-plate/--mark-ink) sized var(--icon-wrap-lg).
     REGRESSION FIX: the mark is now multicolor (plate fill + pip stroke
     via CSS vars), so it can no longer recolor itself through the color
     property/currentColor the way the old single-stroke glyph did. State
     moves to the WRAPPER instead -- the mark itself never changes color
     for any state, only opacity (done) and a loop animation (working,
     unchanged from before since opacity/animation were never
     currentColor-dependent). */
  .dz-icon-wrap {
    position: relative;
    width: var(--icon-wrap-lg); height: var(--icon-wrap-lg);
    border-radius: var(--radius-pill);
    background: var(--mark-wash);
    display: flex; align-items: center; justify-content: center;
    transition: background var(--motion-duration-fast) var(--motion-ease-standard),
      box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .dz-icon {
    width: var(--icon-lg); height: var(--icon-lg);
    transition: opacity var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .dropzone[data-state="dragover"] .dz-icon-wrap {
    background: var(--color-accent-tint);
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .dropzone[data-state="working"] .dz-icon {
    opacity: 0.35;
    animation: dz-spin var(--motion-duration-loop) linear infinite;
  }
  .dropzone[data-state="done"] .dz-icon { opacity: 0; }
  @keyframes dz-spin {
    to { transform: rotate(360deg); }
  }
  /* Check glyph draws in via stroke-dasharray/-offset on entering "done";
     invisible (dasharray fully offset) in every other state. */
  .dz-check {
    /* Trivial adjacent fix while touching this block: dz-icon-wrap grew
       from 48px to var(--icon-wrap-lg) (72px) above, so this now needs
       margin: auto (with inset: 0) to stay centred in the larger circle --
       previously inset: 0 alone happened to work only because wrap and
       check were both exactly 48px. */
    position: absolute;
    inset: 0;
    margin: auto;
    width: var(--icon-lg); height: var(--icon-lg);
    color: var(--color-success);
    opacity: 0;
    transition: opacity var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .dz-check path {
    stroke-dasharray: 40;
    stroke-dashoffset: 40;
    transition: stroke-dashoffset var(--motion-duration-standard) var(--motion-ease-decelerate);
  }
  .dropzone[data-state="done"] .dz-check { opacity: 1; }
  .dropzone[data-state="done"] .dz-check path { stroke-dashoffset: 0; }

  .dz-title {
    font-weight: var(--weight-medium);
    font-size: var(--text-md);
    margin: 0;
  }
  .dz-caption {
    font-size: var(--text-sm);
    color: var(--color-muted);
    margin: 0;
  }
  .dz-proof {
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-muted);
    margin: var(--space-3) 0 0;
  }
  .dz-status {
    text-align: center;
    font-size: var(--text-sm);
    margin: var(--space-3) 0 0;
    min-height: 1.5em;
  }
  .dz-status[data-tone="error"] { color: var(--color-danger); }
  .dz-status[data-tone="success"] { color: var(--color-success); }

  .progress-track {
    display: none;
    width: 100%;
    max-width: 320px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-alt);
    overflow: hidden;
  }
  .dropzone[data-state="working"] .progress-track { display: block; }
  .progress-fill {
    height: 100%;
    width: 40%;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    transition: width var(--motion-duration-fast) var(--motion-ease-standard);
  }
  /* Indeterminate loop: the default for any processor that never calls
     setProgress() -- a "work is happening" signal, not a real percentage --
     the accompanying .dz-status text (already aria-live) carries the real
     detail a processor knows (e.g. "Reading 4 pages on this device..."). */
  .dropzone[data-state="working"]:not([data-determinate="true"]) .progress-fill {
    animation: dz-progress-loop var(--motion-duration-loop) linear infinite;
  }
  @keyframes dz-progress-loop {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
  /* Determinate: a batch processor that genuinely knows done/total (see
     src/browser/batchProgress.js) upgrades to this instead -- real width,
     no loop animation, driven by dropzone.client.js's own setProgress(). */
  .dropzone[data-state="working"][data-determinate="true"] .progress-fill {
    animation: none;
    transform: none;
  }

  .dz-cancel {
    display: none;
    margin-top: var(--space-1);
  }
  .dropzone[data-state="working"][data-slow="true"] .dz-cancel { display: inline-flex; }

  .alert {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    margin: var(--space-4) 0;
  }
  .alert-danger { background: var(--color-danger-bg); color: var(--color-danger); }
  .alert-warn { background: var(--color-warn-bg); color: var(--color-warn); }
  .alert-success { background: var(--color-success-bg); color: var(--color-success); }

  /* -------------------------------------------------------------------
     File list (merge) / page grid (split, rotate)
     ------------------------------------------------------------------- */
  .file-list {
    list-style: none;
    margin: var(--space-4) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .file-row .file-name {
    flex: 1;
    font-weight: var(--weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-row .file-meta {
    color: var(--color-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .file-row .file-actions { display: flex; gap: var(--space-1); }

  /* One row per algorithm inside a hash-result block (Hash Generator --
     src/browser/hashGenerator.client.js). The hash itself is a fixed-width
     hex string, so unlike .json-preview's multi-line <pre> this stays a
     single truncatable line with its own copy button -- a wide hash on a
     narrow viewport scrolls horizontally inside its own box rather than
     wrapping mid-hex or pushing the copy button off-screen. */
  .hash-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
  }
  .hash-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-alt);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .hash-row .hash-label {
    flex-shrink: 0;
    width: 5.5rem;
    font-weight: var(--weight-medium);
    font-size: var(--text-xs);
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .hash-row .hash-value {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
  }
  .hash-row .btn-secondary {
    flex-shrink: 0;
    min-width: 0;
    padding: var(--space-1) var(--space-3);
    min-height: 36px;
  }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3);
    margin: var(--space-4) 0;
  }
  .page-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .page-card canvas, .page-card .page-thumb-fallback {
    width: 100%;
    aspect-ratio: 3 / 4;
    background: var(--color-surface-alt);
    border-radius: var(--radius-sm);
    display: block;
  }
  .page-card .page-num {
    font-size: var(--text-xs);
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  .page-card[data-selected="false"] { opacity: 0.5; }
  .page-card .page-rotate-row { display: flex; gap: var(--space-1); }
  .page-card canvas[data-rotation="90"] { transform: rotate(90deg); }
  .page-card canvas[data-rotation="180"] { transform: rotate(180deg); }
  .page-card canvas[data-rotation="270"] { transform: rotate(270deg); }

  /* -------------------------------------------------------------------
     Extracted-table preview (PDF tables to CSV --
     src/browser/pdfTables.client.js)
     ------------------------------------------------------------------- */
  .table-block {
    margin: var(--space-5) 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .table-block-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .page-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    background: var(--color-accent-tint);
    color: var(--color-accent);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }
  .table-block-head label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text);
  }
  /* Sort-by-column controls (src/browser/sortLines.client.js) reuse this
     same options-row pattern, adding <select> dropdowns alongside the
     checkboxes every other table-block-head already uses. */
  .table-block-head select {
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .table-block-head select:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Split-CSV's rows-per-file control (src/browser/splitCsv.client.js)
     reuses this same options-row pattern with a number input. */
  .table-block-head input[type="number"] {
    width: 88px;
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
  }
  .table-block-head input[type="number"]:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Horizontally scrollable inside its OWN container so the page itself
     never scrolls horizontally at 360px, even for a wide extracted table. */
  .table-scroll {
    overflow-x: auto;
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .extracted-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .extracted-table th, .extracted-table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: var(--border-hairline) solid var(--color-border);
    white-space: nowrap;
  }
  .extracted-table thead th {
    position: sticky;
    top: 0;
    background: var(--color-surface-alt);
    font-weight: var(--weight-medium);
    z-index: 1;
  }
  .extracted-table tbody tr:last-child td { border-bottom: none; }
  /* Read-only JSON preview (YAML to JSON --
     src/browser/yamlToJson.client.js). Reuses .table-scroll's border
     treatment for a consistent contained-scroll box, but scrolls both axes
     since JSON text (unlike a table) can have both long lines and many of
     them. */
  .json-preview {
    max-height: 480px;
    overflow: auto;
    margin: 0;
    padding: var(--space-3);
    background: var(--color-surface-alt);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text);
    white-space: pre;
  }
  /* Read-only encode/decode result (HTML entity encoder/decoder --
     src/browser/htmlEntity.client.js). Same monospace/scroll-box treatment
     as .json-preview above, but wraps long lines instead of scrolling
     horizontally -- encoded output is often one very long line with no
     natural break points (a wall of "&#NNNN;" entities), unlike JSON's own
     line-structured text where horizontal scroll is the better tradeoff. */
  .entity-output {
    max-height: 480px;
    overflow: auto;
    margin: var(--space-4) 0 0;
    padding: var(--space-3);
    background: var(--color-surface-alt);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .row-action-cell { width: 44px; text-align: center; }
  .boundary-editor { margin-top: var(--space-4); }
  .boundary-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .boundary-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .boundary-item input[type="number"] {
    width: 72px;
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
  }
  .table-block > .btn-secondary { margin-top: var(--space-4); }
  .download-btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  /* Two live result panels side by side (URL encode/decode --
     src/browser/urlEncode.client.js's encoded/decoded pair). Stacked by
     default; side by side only at >=1024px, the same breakpoint and
     stacked-first reasoning .how-band and .example-before-after already
     use above, so a wide encoded or decoded string never has to share less
     than half the viewport width until there is room to spare. */
  .dual-result-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  @media (min-width: 1024px) {
    .dual-result-row {
      flex-direction: row;
      align-items: start;
    }
    .dual-result-row > .table-block { flex: 1 1 0; min-width: 0; }
  }

  /* Six live result panels (Text Case Converter --
     src/browser/textCaseConverter.client.js) -- same stacked-first,
     wide-before-columns reasoning as .dual-result-row above, but with more
     panels than one row comfortably fits: 1 column by default, 2 at
     >=768px, 3 at >=1024px (six panels divides evenly at both). */
  .case-result-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    align-items: start;
  }
  @media (min-width: 768px) {
    .case-result-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .case-result-grid { grid-template-columns: repeat(3, 1fr); }
  }

  /* -------------------------------------------------------------------
     Cell-level CSV diff table (compare-csv --
     src/browser/csvDiff.client.js). Row-level tint from a shared
     background token PLUS the .diff-status-cell text label in every row
     (never color alone -- see design-standards.md's "color never the sole
     carrier of meaning").
     ------------------------------------------------------------------- */
  .extracted-table tr[data-diff-status="added"] > td { background: var(--color-success-bg); }
  .extracted-table tr[data-diff-status="removed"] > td { background: var(--color-danger-bg); }
  .extracted-table tr[data-diff-status="changed"] > td { background: var(--color-warn-bg); }
  .extracted-table td[data-diff-cell="changed"] { font-weight: var(--weight-bold); }
  .diff-cell-old {
    color: var(--color-danger);
    text-decoration: line-through;
    margin-right: var(--space-1);
  }
  .diff-cell-new { color: var(--color-success); }
  .diff-status-cell {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    white-space: nowrap;
  }
  .diff-status-cell[data-diff-status="added"] { color: var(--color-success); }
  .diff-status-cell[data-diff-status="removed"] { color: var(--color-danger); }
  .diff-status-cell[data-diff-status="changed"] { color: var(--color-warn); }
  .diff-status-cell[data-diff-status="unchanged"] { color: var(--color-muted); }

  /* -------------------------------------------------------------------
     Regex match highlighting (regex tester -- src/browser/regexTester.client.js).
     Reuses .json-preview's own monospace/pre/scroll-box treatment for the
     highlighted test string, adding just the <mark> match style.
     ------------------------------------------------------------------- */
  .regex-match {
    background: var(--color-accent-tint);
    color: var(--color-accent);
    font-weight: var(--weight-medium);
    border-radius: var(--radius-sm);
    padding: 0 1px;
  }
  /* A zero-width match (e.g. the pattern "a*" against text with no "a") has
     no text of its own to highlight -- a thin accent-colored caret marks
     where it matched instead of rendering nothing at all. */
  .regex-match--empty {
    display: inline-block;
    width: 2px;
    height: 1em;
    vertical-align: middle;
    background: var(--color-accent);
    border-radius: var(--radius-sm);
  }

  /* -------------------------------------------------------------------
     Second input path: "paste markup" (html-table-to-csv today; toolPage.js
     only renders this block when a tool config sets pasteInput)
     ------------------------------------------------------------------- */
  .or-divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-4) 0;
    color: var(--color-muted);
    font-size: var(--text-sm);
  }
  .or-divider::before, .or-divider::after {
    content: '';
    flex: 1;
    height: var(--border-hairline);
    background: var(--color-border);
  }
  .paste-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .paste-input label {
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
  }
  .paste-textarea {
    width: 100%;
    min-height: 140px;
    padding: var(--space-3);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
    color: var(--color-text);
    background: var(--color-surface);
    resize: vertical;
  }
  .paste-textarea:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  .paste-input > .btn-secondary { align-self: flex-start; }

  /* -------------------------------------------------------------------
     Result block
     ------------------------------------------------------------------- */
  .result {
    margin-top: var(--space-5);
    padding: var(--space-5);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  .support-note {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--border-hairline) solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  /* -------------------------------------------------------------------
     Before -> after page-strip diagrams (Pattern D, and the drawn source
     half of Pattern E -- see src/pageStripDiagrams.mjs and
     src/examples/*.mjs). Rendered inline inside an .output-example figure
     (below), so this is deliberately just the <svg> styling -- no card
     background/border/padding of its own, since design-standards.md
     forbids a card nested inside another card and .output-example is
     already that card. (Formerly src/diagrams.js's own top-of-page
     .transform-diagram div carried that card styling directly; retired
     along with the file.)
     ------------------------------------------------------------------- */
  .transform-diagram-svg {
    display: block;
    width: 100%;
    max-width: 480px;
    height: auto;
    color: var(--color-border-strong);
  }
  .transform-diagram-svg .td-label {
    font-family: var(--font-sans);
    font-size: 13px;
    fill: var(--color-muted);
    stroke: none;
  }
  /* The "after" state's accent -- was --color-accent (site-wide brand
     teal); recolored to the tool's own family plate color so the diagram
     agrees with that tool's mark/dropzone color rather than competing
     with it. --color-accent keeps its monopoly on actions/links/focus
     (design-standards.md's restraint-budget rule). */
  .transform-diagram-svg .td-accent { color: var(--mark-plate); }

  /* -------------------------------------------------------------------
     Tool surface card
     ------------------------------------------------------------------- */
  #tool {
    background: var(--color-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  @media (max-width: 768px) {
    #tool { padding: var(--space-4); }
  }

  /* -------------------------------------------------------------------
     How-it-works process rail -- CSS-only counter-generated step markers
     on the genuinely-ordered <ol> (design-standards.md permits numbering an
     element's own semantics; it rejects decorative numbering of sections,
     a different thing).
     ------------------------------------------------------------------- */
  .how-steps {
    list-style: none;
    padding-left: 0;
    counter-reset: how-step;
    margin: var(--space-5) 0;
  }
  .how-steps li {
    position: relative;
    max-width: var(--measure);
    padding-left: calc(28px + var(--space-4));
    padding-bottom: var(--space-5);
    border-left: var(--border-hairline) solid var(--color-border);
    margin-left: 13px;
  }
  .how-steps li:last-child { border-left-color: transparent; padding-bottom: 0; }
  .how-steps li::before {
    counter-increment: how-step;
    content: counter(how-step);
    position: absolute;
    left: -14px;
    top: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent-tint);
    color: var(--color-accent);
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    font-size: var(--text-sm);
  }

  /* -------------------------------------------------------------------
     Two-column "how it works" band -- steps left, a real generated output
     example right (src/examples/*.mjs). Only rendered by toolPage.js when
     an example exists for that tool, so tool pages with no example yet
     keep the plain single-column .how-steps list unchanged. Below 1024px
     this is a plain block: <ol> then <figure> stack in DOM order (steps
     first, then example), which is why no separate mobile rule is needed.
     ------------------------------------------------------------------- */
  @media (min-width: 1024px) {
    .how-band {
      display: grid;
      grid-template-columns: minmax(0, 34rem) minmax(0, 1fr);
      gap: var(--space-7);
      align-items: start;
    }
    .how-band .how-steps { margin-top: 0; }
  }
  .output-example {
    margin: var(--space-5) 0 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  @media (min-width: 1024px) {
    .output-example { margin-top: 0; }
  }
  .output-example figcaption {
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }
  .output-example-body {
    max-width: 100%;
  }
  @media (max-width: 768px) {
    .output-example-body { overflow-x: auto; }
  }
  .output-example-note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  /* -------------------------------------------------------------------
     Before/after example tables (Pattern B, src/examples/*.mjs) -- an
     Input table then an Output table either side of an arrow, inside an
     .output-example figure. Any row a tool actually removes or adds
     reuses .extracted-table's own tr[data-diff-status] tinting above
     (added zero new color rules) plus .diff-status-cell for the
     accompanying text label, since color is never the sole carrier of
     meaning. Stacked by default (DOM order Input then Output preserved);
     side by side only once the .how-band itself is two columns, so this
     never fights that wider breakpoint for space.
     ------------------------------------------------------------------- */
  .example-before-after {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  @media (min-width: 1024px) {
    .example-before-after {
      flex-direction: row;
      align-items: center;
    }
    .example-ba-col { flex: 1 1 0; min-width: 0; }
    /* Pattern E (extract-to-grid, src/examples/pdf-to-csv.mjs and
       siblings): the left column is always a small drawn source diagram,
       never a table -- it doesn't need half the figure's width the way
       Pattern B's two real tables do, and a real 3-column extracted table
       given only half a narrow figure gets pushed into
       .table-scroll's horizontal-scroll affordance, hiding a whole column
       at first glance (exactly what src/examples/merge-csv.mjs's own
       header comment says Pattern B avoids by keeping its fixtures to 2
       columns). Fixed-width here instead, so the real table -- the
       valuable half -- gets the rest of the space.
       ------------------------------------------------------------------- */
    .example-ba-col--source { flex: 0 0 130px; }
  }
  .example-ba-col { min-width: 0; }
  .example-ba-label {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .example-ba-col .table-scroll + .example-ba-label { margin-top: var(--space-3); }
  .example-ba-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: var(--color-muted);
    font-size: var(--text-lg);
  }
  @media (min-width: 1024px) {
    .example-ba-arrow { padding: 0 var(--space-1); }
  }
  /* Each before/after column is roughly half of an already-narrow figure
     (see .output-example-body above), so its table needs tighter cells
     than the full-width diff table compare-csv's example uses -- smaller
     text and padding, both still from the existing type/space scale. */
  .example-ba-col .extracted-table th,
  .example-ba-col .extracted-table td {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }

  /* -------------------------------------------------------------------
     FAQ -- native <details>/<summary> disclosure (Deliverable 4). The
     first two items ship the open attribute; see src/pages/toolPage.js.
     ------------------------------------------------------------------- */
  .faq-item {
    max-width: var(--measure);
    border-bottom: var(--border-hairline) solid var(--color-border);
    padding: var(--space-4) 0;
  }
  .faq-item:first-of-type { border-top: var(--border-hairline) solid var(--color-border); }
  .faq-item summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding-left: var(--space-5);
    position: relative;
  }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::before {
    content: '';
    position: absolute;
    left: 0;
    width: 10px;
    height: 10px;
    border-right: var(--border-control) solid var(--color-muted);
    border-bottom: var(--border-control) solid var(--color-muted);
    transform: rotate(-45deg);
    transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .faq-item[open] summary::before { transform: rotate(45deg); }
  .faq-item[open] { border-left: var(--border-control) solid var(--color-accent); padding-left: var(--space-3); }
  .faq-item summary h3 { display: inline; font-size: var(--text-md); margin: 0; }
  .faq-item p { margin: var(--space-2) 0 0 var(--space-5); color: var(--color-text); }

  /* -------------------------------------------------------------------
     Related tools -- one inline glyph+text row under a hairline, not a
     card grid (design-standards.md; see toolPage.js's comment).
     ------------------------------------------------------------------- */
  .related-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-6);
    margin: var(--space-4) 0 0;
    padding-top: var(--space-4);
    border-top: var(--border-hairline) solid var(--color-border);
    max-width: none;
  }
  .related-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--weight-medium);
  }
  .related-link svg { width: var(--icon-sm); height: var(--icon-sm); flex-shrink: 0; }
  .related-link:hover { color: var(--color-accent); }

  /* -------------------------------------------------------------------
     Ad slot -- reserved height, never above/beside the tool.
     ------------------------------------------------------------------- */
  .ad-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--ad-min-h-mobile);
    margin: var(--space-6) 0;
    contain: layout;
    background: var(--color-surface-alt);
    border: var(--border-hairline) dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  @media (min-width: 768px) {
    .ad-slot { min-height: var(--ad-min-h-desktop); }
  }

  /* -------------------------------------------------------------------
     Footer
     ------------------------------------------------------------------- */
  .site-footer {
    max-width: var(--width-wide);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
    border-top: var(--border-hairline) solid var(--color-border);
    color: var(--color-muted);
    font-size: var(--text-sm);
  }
  .footer-groups {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  @media (min-width: 768px) {
    .footer-groups { grid-template-columns: repeat(3, 1fr); }
  }
  .footer-group h3 {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text);
    margin-bottom: var(--space-2);
  }
  .footer-group ul { list-style: none; margin: 0; padding: 0; }
  .footer-group li { margin: 0 0 var(--space-1); }
  .footer-group a { color: var(--color-muted); }
  .footer-group a:hover { color: var(--color-accent); }
  .footer-legal { max-width: none; }
  .footer-legal a { color: var(--color-muted); margin-right: var(--space-4); }
  .footer-credit {
    margin: var(--space-3) 0 0;
    color: var(--color-muted);
    font-size: var(--text-xs);
  }
  .footer-credit a { color: var(--color-muted); }
  .footer-credit a:hover { color: var(--color-accent); }
  .footer-social {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .footer-social svg { display: block; }

  .newsletter-signup {
    margin: var(--space-5) 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
    max-width: 60ch;
  }
  .newsletter-heading {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-2);
  }
  .newsletter-description {
    color: var(--color-muted);
    font-size: var(--text-xs);
    margin: 0 0 var(--space-3);
  }
  .newsletter-signup--pending .newsletter-description { margin-bottom: 0; }
  /* D1 fix: the styled box (border/background/fixed height) now belongs
     ONLY to the loaded iframe -- the default slot (.newsletter-slot,
     src/shell.js) renders as a plain link with no box at all, so a load
     that never happens degrades to a real link, not an empty rectangle. */
  .newsletter-slot a { font-weight: var(--weight-medium); }
  .newsletter-embed {
    display: block;
    width: 100%;
    max-width: 480px;
    height: 320px;
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
  }

  /* -------------------------------------------------------------------
     404 -- restyled as the explorer's not-found state (site-wide
     navigation/IA redesign, see the folder taxonomy/nav spec section 1.9).
     ------------------------------------------------------------------- */
  .window-sidebar-full {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* -------------------------------------------------------------------
     Home page hero -- left-aligned, directly above the explorer window
     (design-standards.md's Distinctiveness Gate names a centered hero
     over a card grid an automatic NO-GO). Compressed for the explorer-
     window redesign (spec 1.5): the former family-index strip is retired
     -- the window's own sidebar + per-row Kind chips now carry that same
     "jump straight to a format" scent with more precision (a real count
     per folder, not just an icon), so the hero is kicker + h1 + one-line
     deck + one CTA, nothing wider than the measure. The page still
     renders wide (page-shell-app, home.js): the homepage is a directory/
     app hub, not a prose page.
     ------------------------------------------------------------------- */
  .hero { padding: var(--space-7) 0 var(--space-5); text-align: left; }
  .hero-kicker {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-3);
  }
  .hero h1 { margin-bottom: var(--space-3); max-width: var(--measure); }
  .hero .deck { margin: 0 0 var(--space-5); }
  .hero-cta { margin-top: var(--space-2); }

  .tool-group { margin: var(--space-7) 0; padding: var(--space-4); border-radius: var(--radius-lg); }
  .tool-group h2 { margin-top: 0; margin-bottom: var(--space-4); }

  /* A flat, dense single column (no 2-up grid): the explorer window's own
     column ruler (Name / Kind) implies one row per tool, not a card-style
     multi-column layout -- design-standards.md's craft-floor reasoning on
     ragged final rows, which a grid reintroduces as row count grows. */
  .tool-list { display: flex; flex-direction: column; }
  .tool-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    /* Density move (craft-retrofit Phase 1): a within-group tier (--space-2)
       between rows reads as one deliberate, instrument-dense list rather
       than the between-group tier (--space-3) it used before, which read
       closer to a card list than a file listing. Horizontal padding is
       unchanged -- only the vertical rhythm tightens. */
    padding: var(--space-2) 0;
    border-bottom: var(--border-hairline) solid var(--color-border);
    text-decoration: none;
    color: var(--color-text);
    min-height: 44px;
  }
  .tool-list > .tool-row:last-child { border-bottom: none; }
  /* filter.client.js toggles the hidden attribute (not inline style) on a
     filtered-out row -- but this rule's own display: flex above has equal
     specificity to the UA stylesheet's [hidden] { display: none } and
     loses the cascade tie to author-stylesheet order, so a hidden row
     without this override would still render as a flex item. */
  .tool-row[hidden] { display: none; }
  .tool-row:hover .tool-row-name { color: var(--color-accent); }
  /* Wash-disc treatment (see the Icon marks comment above) -- gives each
     row's family color real presence instead of a small near-monochrome
     glyph, at a size (--icon-wrap-md, tokens.js) matched to this row's own
     existing 44px min-height so the list doesn't grow taller. */
  .tool-row-icon-wrap {
    width: var(--icon-wrap-md); height: var(--icon-wrap-md);
    border-radius: var(--radius-pill);
    background: var(--mark-wash);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .tool-row-icon { width: var(--icon-md); height: var(--icon-md); }
  .tool-row-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .tool-row-name {
    font: var(--type-row-name);
    color: var(--color-text);
  }
  .tool-row-desc { font: var(--type-control); color: var(--color-muted); }
  /* Kind chip (spec 1.5): the tool's own family label, family-6 text on
     family-1 background -- the same ramp pair every mark/glyph already
     uses via .mark--<family>, so no new color logic. Hidden below 768px
     (the row's icon mark already carries the same color signal there;
     the chip is additional information density that only fits once the
     row has room). */
  .tool-row-kind {
    display: none;
    flex-shrink: 0;
    font: var(--type-mono-caption);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--mark-wash);
    color: var(--mark-plate);
  }
  @media (min-width: 768px) {
    .tool-row-kind { display: inline-block; }
  }

  /* -------------------------------------------------------------------
     Explorer window (spec 1.5/1.6/1.9) -- one bordered surface reused by
     the homepage (with a folder sidebar), each folder page (without one),
     and the 404 page (folder rows instead of tool rows). Chrome
     decoration is deliberately closed to this exact token list (spec
     1.11's own guardrail against gimmick creep -- no traffic lights, no
     bevels, no wallpaper texture, ever).
     ------------------------------------------------------------------- */
  .explorer-window {
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    margin: var(--space-6) 0;
  }
  .window-chrome {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    /* Density move: within-group vertical padding (--space-2), matching
       the tightened row rhythm below -- the chrome strip is the window's
       own toolbar, not a section header, so it reads as part of the same
       dense instrument rather than a lighter band above it. */
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface-alt);
    border-bottom: var(--border-hairline) solid var(--color-border);
  }
  .window-path { font: var(--type-mono-path); color: var(--color-text); }
  .window-count { font: var(--type-mono-caption); color: var(--color-muted); white-space: nowrap; }
  .window-filter-slot { flex: 1; min-width: 0; display: flex; justify-content: flex-end; }
  .window-filter-input {
    width: 100%;
    max-width: 220px;
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font: var(--type-control);
  }
  .window-ruler {
    display: none;
    padding: var(--space-2) var(--space-4) 0;
    font: var(--type-mono-caption);
    color: var(--color-muted);
    justify-content: space-between;
  }
  @media (min-width: 768px) {
    .window-ruler { display: flex; }
    .window-ruler span:last-child { margin-right: calc(var(--space-2) + 56px); }
  }
  .window-body {
    display: flex;
    flex-direction: column;
    padding: var(--space-2) var(--space-4) var(--space-4);
  }
  @media (min-width: 1024px) {
    .window-body { flex-direction: row; gap: var(--space-6); }
  }
  .window-sidebar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: var(--border-hairline) solid var(--color-border);
    margin-bottom: var(--space-2);
  }
  @media (min-width: 1024px) {
    .window-sidebar {
      flex-direction: column;
      flex-wrap: nowrap;
      width: var(--sidebar-width);
      flex-shrink: 0;
      border-bottom: none;
      border-right: var(--border-hairline) solid var(--color-border);
      padding: var(--space-2) var(--space-3) var(--space-2) 0;
      margin-bottom: 0;
    }
    /* Found during the craft-retrofit Phase 1 visual-QA pass: the 404
       page reuses .window-sidebar's row styling for its folder list via
       .window-sidebar-full, but as BODY content (no actual sidebar next
       to it -- renderExplorerWindow() gets it as the body parameter,
       never the sidebar parameter, see notFound.js), not a real two-pane
       sidebar. Without this override it inherited the fixed
       --sidebar-width above at >=1024px, leaving a narrow folder list
       and a large empty pane beside it. */
    .window-sidebar-full {
      width: 100%;
      border-right: none;
      padding: var(--space-2) 0;
    }
  }
  .window-sidebar-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: var(--color-text);
    font: var(--type-control);
  }
  .window-sidebar-row:hover { background: var(--color-accent-tint); color: var(--color-accent); }
  .window-sidebar-label { flex: 1; }
  .window-sidebar-count { font: var(--type-mono-caption); color: var(--color-muted); }
  .folder-glyph-window { width: var(--icon-sm); height: var(--icon-sm); flex-shrink: 0; }
  .window-main { flex: 1; min-width: 0; }
  .window-section { margin: var(--space-4) 0; }
  .window-section:first-child { margin-top: var(--space-2); }
  .window-section-heading {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
  }
  .window-section-heading a { color: var(--color-text); text-decoration: none; }
  .window-section-heading a:hover { color: var(--color-accent); }
  .window-section-count { font: var(--type-mono-caption); color: var(--color-muted); }
  .window-empty-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    color: var(--color-muted);
    font: var(--type-control);
  }
  /* Same specificity trap as .tool-row[hidden] above: filter.client.js sets
     the hidden attribute (not inline style) on this row, but its own
     display: flex above has equal specificity, so without this override a
     "hidden" empty-state row still renders. */
  .window-empty-row[hidden] { display: none; }
  .window-empty-clear {
    border: var(--border-hairline) solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    min-height: 36px;
    cursor: pointer;
    font: var(--type-control);
  }
  .window-empty-clear:hover { border-color: var(--color-border-strong); }
  .window-status-bar {
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface-alt);
    border-top: var(--border-hairline) solid var(--color-border);
  }
  .window-status-text { font: var(--type-mono-caption); color: var(--color-muted); }

  /* -------------------------------------------------------------------
     Quick-open (spec 1.7/1.13) -- a full-screen backdrop + a single
     bordered dialog carrying one combobox input and its listbox. The
     header trigger button only ever exists once filter.client.js runs
     ("no dead control without JS").

     Signature-interaction move (craft-retrofit Phase 1): the trigger
     itself is unchanged in mechanism (still the one header affordance
     insertQuickOpenTrigger() appends on every page -- filter.client.js is
     untouched this phase), but now carries real border weight
     (--border-control instead of the default --border-hairline) and a
     slightly stronger background so it reads as a persistent toolbar
     control rather than a muted afterthought, consistent everywhere the
     header wraps to its own row on narrow viewports.
     ------------------------------------------------------------------- */
  .quickopen-trigger {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-control) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font: var(--type-control);
    cursor: pointer;
  }
  .quickopen-trigger:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .quickopen-trigger kbd {
    font: var(--type-mono-caption);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
  }
  .quickopen-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 24, 31, 0.4);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-7) var(--space-4);
    z-index: 200;
  }
  /* Same specificity trap as .tool-row[hidden] above: filter.client.js sets
     backdrop.hidden = true to close the dialog, but this rule's own
     display: flex has equal specificity, so without this override the
     dialog never actually closes and keeps swallowing clicks. */
  .quickopen-backdrop[hidden] { display: none; }
  .quickopen-dialog {
    width: 100%;
    max-width: 480px;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }
  .quickopen-input {
    width: 100%;
    min-height: 52px;
    padding: var(--space-3) var(--space-4);
    border: none;
    border-bottom: var(--border-hairline) solid var(--color-border);
    font-family: var(--font-sans);
    font-size: var(--text-md);
    color: var(--color-text);
  }
  .quickopen-input:focus-visible { outline: none; }
  .quickopen-listbox {
    list-style: none;
    margin: 0;
    padding: var(--space-2);
    max-height: 360px;
    overflow-y: auto;
  }
  .quickopen-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--color-text);
  }
  .quickopen-option[aria-selected="true"] { background: var(--color-accent-tint); color: var(--color-accent); }
  .quickopen-option-folder { font: var(--type-mono-caption); color: var(--color-muted); flex-shrink: 0; }
  .quickopen-empty { padding: var(--space-4); color: var(--color-muted); font: var(--type-control); }
`;

module.exports = { SITE_CSS, FONT_WOFF2_URL };
