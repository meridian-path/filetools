'use strict';

/**
 * Flat, mechanical check for the copy tells named in
 * docs/design/CRAFT_DOCTRINE.md section 2.2 ("Copy tells") and the literal,
 * canonical phrase list `.claude/rules/design-standards.md`'s
 * Distinctiveness Gate item 3 maintains (that file is the single canonical
 * home for the phrase list itself -- this script is the mechanical, wired-
 * into-CI enforcement of it, the copy-tell counterpart to
 * scripts/check-em-dash.js's mechanical enforcement of the em-dash ban
 * named in that same item 3).
 *
 * Four categories, matching the task this script was written for:
 *   1. The three explicitly-named single/short phrases -- seamlessly,
 *      effortlessly, robust -- plus every other literal phrase design-
 *      standards.md's item 3 lists as greppable (delve, unlock the power
 *      of, cutting-edge, boasts, "when it comes to," etc.), and its two
 *      quoted regex shapes ("whether you're X or Y" and the "it's not X,
 *      it's Y" antithesis framing).
 *   2. Exclamation-point enthusiasm: multiple "!" characters doing the
 *      enthusiasm the copy itself should be doing. Checked page-wide (not
 *      per element) since the tell is the accumulation across a page, not
 *      any single "!".
 *   3. Hedge-stacking: two or more hedge words (might/could/perhaps/
 *      potentially/possibly) piled into the same rendered text chunk.
 *   4. Process-talk markers: internal Orchestra vocabulary and internal
 *      task-/decision-ids leaking into rendered copy -- the rendered-output
 *      counterpart to scripts/check-internal-ids.js, which only scans this
 *      repo's own source/test/docs/CI files, never the built dist/ pages a
 *      visitor actually sees.
 *
 * What this deliberately does NOT try to lint mechanically (left to the
 * qa.md step 11b independent reviewer read, and the doctrine's own lineup/
 * squint rituals): symmetric rule-of-three lists used as filler, and "a
 * feature list nobody asked for" -- both are a judgment call about framing,
 * not a greppable string.
 *
 * Same rendered-surface scan shape as check-em-dash.js: every built
 * dist/**\/*.html page, scanning prose elements (<p>, <li>, headings,
 * <summary>), <title> text content, and content=/alt=/aria-label=
 * attribute values -- reuses that script's findHtmlFiles directly rather
 * than re-implementing directory traversal.
 *
 * Usage: node scripts/check-copy-tells.js (requires dist/ -- run after
 * `npm run build`). Exits 1 and prints every offending page and the
 * offending snippet on failure; exits 0 and prints a pass summary on
 * success. Wired as a `pretest` npm script alongside check-em-dash.js and
 * check-internal-ids.js, so `npm test` (and CI, which runs `npm run build`
 * then `npm test`) fails automatically on any hit.
 */

const fs = require('fs');
const path = require('path');
const { findHtmlFiles } = require('./check-em-dash.js');
const { ID_RE: INTERNAL_ID_RE } = require('./check-internal-ids.js');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const TAG_NAMES = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary'];
const PROSE_RE = new RegExp(`<(${TAG_NAMES.join('|')})(?![a-zA-Z0-9-])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'g');
const TITLE_RE = /<title(?![a-zA-Z0-9-])[^>]*>([\s\S]*?)<\/title>/g;
const ATTR_NAMES = ['content', 'alt', 'aria-label'];
const ATTR_RE = new RegExp(`\\b(?:${ATTR_NAMES.join('|')})\\s*=\\s*("[^"]*"|'[^']*')`, 'g');

// design-standards.md Distinctiveness Gate item 3's literal phrase list,
// minus the em-dash line (owned by check-em-dash.js) and minus the two
// framing tells that need a regex shape (handled by REGEX_TELLS below).
// Case-insensitive substring match, mirroring how the canonical list itself
// is written as plain phrases, not word-bounded terms.
const SIMPLE_PHRASES = [
  'delve',
  'seamlessly',
  'effortlessly',
  'unlock the power of',
  'elevate your',
  'robust',
  'cutting-edge',
  'cutting edge',
  "in today's fast-paced world",
  "today's fast-paced world",
  "it's important to note that",
  'boasts',
  'stands as a testament to',
  'navigating the landscape of',
  'when it comes to',
  'a game-changer',
  'game-changer',
  'game changer',
  'at the end of the day',
  "let's dive in",
  'diving into',
];

// Regex-shaped tells design-standards.md item 3 quotes explicitly.
const REGEX_TELLS = [
  {
    label: 'plays a crucial/vital/pivotal role',
    re: /plays a (crucial|vital|pivotal) role/i,
  },
  {
    label: '"whether you\'re X or Y" framing',
    re: /whether you'?re\s+.{1,80}\bor\b/i,
  },
  {
    // Quoted verbatim from design-standards.md item 3.
    label: '"it\'s not X, it\'s Y" antithesis framing',
    re: /[Ii]t'?s not (just )?.{0,60}(it'?s|it is|but)/,
  },
];

// Hedge words that, piled two-or-more into the same chunk, are the
// "might potentially perhaps" hedge-stacking tell.
const HEDGE_WORDS = ['might', 'could', 'perhaps', 'potentially', 'possibly'];

// Internal Orchestra vocabulary that has no business in rendered product
// copy -- public-repo-hygiene.md rule 1's list, restricted here to the
// multi-word/hyphenated forms unlikely to false-positive against ordinary
// tool copy (a bare "builder" or "reviewer" is too common a word on a
// file-tools site to flat-ban; "chief-of-staff" or "orchestrator/" is not).
const PROCESS_TALK_PHRASES = [
  'chief-of-staff',
  'decision brief',
  'queue task',
  'action policy',
  'always escalate',
  'orchestrator/',
  '.claude/rules',
  '.claude/agents',
  'internal ticket',
];

function snippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

// <style>/<script> block content is never rendered as visible text, but a
// naive tag-name regex can still be tricked into treating it as prose: a
// real bug found while red-then-green testing this checker against
// filetools' own built site -- a CSS comment in dist/index.html's <style>
// block literally reads "native <details>/<summary> disclosure", and
// PROSE_RE's non-greedy match from that bare, attribute-less "<summary>"
// text ran all the way to the next REAL </summary> closing tag far below,
// swallowing the whole CSS block (and everything between) as if it were
// one giant <summary> element's content. Stripping style/script blocks
// before scanning removes the false tag-shaped text at its source, rather
// than trying to special-case every way a comment can mention markup.
function stripNonRenderedBlocks(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
}

/** @returns {{source: string, text: string}[]} every rendered text chunk on the page */
function collectTextChunks(rawHtml) {
  const html = stripNonRenderedBlocks(rawHtml);
  const chunks = [];
  for (const m of html.matchAll(PROSE_RE)) {
    chunks.push({ source: 'prose', text: m[2].replace(/<[^>]+>/g, ' ') });
  }
  for (const m of html.matchAll(TITLE_RE)) {
    chunks.push({ source: 'title', text: m[1].replace(/<[^>]+>/g, ' ') });
  }
  for (const m of html.matchAll(ATTR_RE)) {
    chunks.push({ source: 'attribute', text: m[1].slice(1, -1) });
  }
  return chunks;
}

/** @returns {string[]} human-readable hits, one per offending location */
function findCopyTells(html) {
  const hits = [];
  const chunks = collectTextChunks(html);

  for (const { source, text } of chunks) {
    const tag = source === 'prose' ? '' : ` (${source})`;
    const lower = text.toLowerCase();

    for (const phrase of SIMPLE_PHRASES) {
      if (lower.includes(phrase)) {
        hits.push(`copy tell "${phrase}"${tag}: ${snippet(text)}`);
      }
    }

    for (const { label, re } of REGEX_TELLS) {
      if (re.test(text)) {
        hits.push(`copy tell (${label})${tag}: ${snippet(text)}`);
      }
    }

    for (const phrase of PROCESS_TALK_PHRASES) {
      if (lower.includes(phrase)) {
        hits.push(`process-talk marker "${phrase}"${tag}: ${snippet(text)}`);
      }
    }

    const idMatch = text.match(new RegExp(INTERNAL_ID_RE.source, 'i'));
    if (idMatch) {
      hits.push(`process-talk marker (internal id "${idMatch[0]}")${tag}: ${snippet(text)}`);
    }

    const foundHedges = HEDGE_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
    if (foundHedges.length >= 2) {
      hits.push(`hedge-stacking (${foundHedges.join(', ')})${tag}: ${snippet(text)}`);
    }
  }

  // Exclamation-point enthusiasm is a page-wide accumulation, not a
  // per-element one: a single "!" on an otherwise plain page is not the
  // tell, two or more scattered across the page's copy is. Only counts a
  // "!" used as sentence-ending punctuation (a word character immediately
  // before it, whitespace/end immediately after) -- NOT a literal "!" that
  // is itself the subject of technical copy, which this site's own FAQ
  // content genuinely contains: an RFC 3986 unreserved-character list
  // ("- _ . ! ~ * ' ( )") and an escaped "&lt;!DOCTYPE&gt;" example both
  // surfaced as real false positives while red-then-green testing this
  // checker against the actual built site, since a plain `text.includes('!')`
  // flags either one identically to real enthusiasm punctuation.
  // Global-flagged regex used only with String#match (which resets its own
  // lastIndex internally and returns every match), never with .test() --
  // .test() on a `g`-flagged regex mutates and reuses lastIndex across
  // calls, which would silently skip matches on later chunks in the loop
  // below. A separate, non-global copy is used for the per-chunk presence
  // check to avoid that trap entirely.
  const SENTENCE_EXCLAIM_RE_G = /\w!(?=\s|$)/g;
  const SENTENCE_EXCLAIM_RE = /\w!(?=\s|$)/;
  const totalExclaims = chunks.reduce(
    (n, c) => n + (c.text.match(SENTENCE_EXCLAIM_RE_G) || []).length,
    0
  );
  if (totalExclaims >= 2) {
    for (const { source, text } of chunks) {
      if (SENTENCE_EXCLAIM_RE.test(text)) {
        const tag = source === 'prose' ? '' : ` (${source})`;
        hits.push(`exclamation-point enthusiasm${tag}: ${snippet(text)}`);
      }
    }
  }

  return hits;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ does not exist -- run `npm run build` first.');
    process.exitCode = 1;
    return;
  }
  const files = findHtmlFiles(DIST);
  let failed = false;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const hits = findCopyTells(html);
    if (hits.length) {
      failed = true;
      const rel = path.relative(DIST, file);
      console.error(`FAIL ${rel}: ${hits.length} copy-tell occurrence(s)`);
      hits.forEach((h) => console.error(`  - ${h}`));
    }
  }
  if (failed) {
    console.error(
      '\nCopy-tell check failed. See docs/design/CRAFT_DOCTRINE.md section 2.2 and ' +
        '.claude/rules/design-standards.md\'s Distinctiveness Gate item 3 -- rewrite the ' +
        'flagged copy in plain, specific, voiced language instead of the flagged tell.'
    );
    process.exitCode = 1;
  } else {
    console.log(`Copy-tell check passed on ${files.length} pages -- zero occurrences.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  findCopyTells,
  collectTextChunks,
  SIMPLE_PHRASES,
  REGEX_TELLS,
  PROCESS_TALK_PHRASES,
  HEDGE_WORDS,
};
