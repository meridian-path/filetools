# Soak backlog

Next-tool candidates for the `filetools` asset, sourced by periodic demand-mining passes
against incumbent tool coverage and search-autosuggest expansion. Each entry is a candidate,
not a commitment -- every candidate is re-screened for client-side feasibility, real per-page
content, and build effort before it ever becomes a shipped page.

## Pass 1 -- 2026-08-29

Source method: incumbent coverage check (TinyWow's own tool pages, SmallSEOTools, Diffchecker
as the dedicated-competitor case) against this repo's current 36-tool registry (`src/tools/`).
Existing coverage checked first to avoid duplicates: PDF merge/split/rotate/extract-images/
to-jpg/tables-to-csv; CSV merge/split/compare/transpose/to-json/to-xlsx/to-sql;
JSON minify/beautify/to-csv/to-yaml/flatten; XML/YAML-to-JSON; text case/dedupe/sort/
word-frequency; base64/URL/HTML-entity encode-decode; hash/UUID generators; regex tester; SQL
formatter; HEIC/JPG/PNG/PDF image conversions; bank-statement-to-CSV.

### 1. Text diff / compare tool

- **Target query:** "compare two texts", "text diff checker", "find differences between two
  texts".
- **Demand evidence:** Diffchecker (diffchecker.com) is a dedicated, large-scale competitor
  built around exactly this one query -- its own scale is the demand signal. Multiple smaller
  clones (diffchecker.io/.dev/.net, text-compare.com, codeshack.io/diff-checker) exist purely
  to serve this query, confirming durable search volume, not a one-off.
- **Competition note:** several rivals (diffchecker.dev, diffchecker.net) already advertise
  browser-local processing as their own differentiator, so "nothing is sent to a server" alone
  won't be a unique wedge here -- this repo's own `compare-csv` sibling already proves the
  no-upload framing works for structured data; a plain-text diff needs to lean on being zero-ad,
  zero-signup, and instant (no file upload step at all, paste-and-see) rather than privacy alone.
- **Client-side feasibility:** yes -- a line/word-level diff algorithm (LCS or Myers) is pure JS,
  same shape of work as `compare-csv`'s existing row-diff logic.
- **Edge (d):** speed + zero-friction (paste, not upload) + no ads, against a landscape where
  the market leader carries real UI weight.
- **Effort estimate (e):** ≤ 1 day -- diff algorithm plus a two-pane render, reusing
  `compare-csv`'s existing layout patterns.
- **Content-depth note (f):** would need its own real FAQ (e.g., "does word order matter",
  "can I diff code", "is there a size limit") and a worked example distinct from `compare-csv`'s
  own copy, not a reskin of it.

### 2. Word & character counter

- **Target query:** "word counter", "character counter", "how many words is this".
- **Demand evidence:** both TinyWow (`tinywow.com/write/word-counter`) and SmallSEOTools run a
  dedicated word-counter tool -- two independent incumbents in the same niche this site already
  competes in (PDF/CSV/data tooling) validate the query.
- **Competition note:** both incumbents are ad-heavy; neither's own privacy stance was
  confirmed in this pass's research (not verified as client-side), so "nothing is sent to a
  server" is a real, checkable wedge if this tool's own implementation is genuinely local (it
  would be -- plain string counting needs no server round-trip).
- **Client-side feasibility:** yes, trivially -- string length/split, no library needed.
- **Edge (d):** privacy (verified for our own build, unverified for incumbents) + no ads +
  instant, live-as-you-type counting.
- **Effort estimate (e):** ≤ 1 day.
- **Content-depth note (f):** distinct from this repo's own existing `word-frequency-counter`
  (frequency/ranking analysis) -- this is a straight count (words/characters/sentences/reading
  time), a different transactional query with its own FAQ (e.g., "does this count spaces",
  "how is reading time estimated").

### 3. Unix timestamp / epoch converter

- **Target query:** "unix timestamp converter", "epoch to date", "convert timestamp to date".
- **Demand evidence:** TinyWow runs a dedicated epoch/Unix-timestamp tool
  (`tinywow.com/other/unix-timestamp`); this is also a classic recurring StackOverflow-adjacent
  developer query with no single dominant incumbent (fragmented market -- several small
  competing timestamp-converter sites, no household-name winner), which is itself a coverage-gap
  signal per this rule's sourcing guidance.
- **Competition note:** fragmented, low-differentiation field -- most incumbents are bare
  single-input-box tools with thin or no supporting copy.
- **Client-side feasibility:** yes, trivially -- `Date` object math, no library.
- **Edge (d):** specificity/coverage -- pairs naturally with this site's existing `developer`
  folder (hash generator, UUID generator, regex tester), so it's a low-effort addition to an
  already-established audience path, not a cold-start page.
- **Effort estimate (e):** ≤ 1 day.
- **Content-depth note (f):** real differentiation available here (most incumbents are thin) --
  a genuine FAQ on timezone handling, milliseconds-vs-seconds epoch formats, and a worked
  example converting a real API-response-shaped timestamp.

### 4. QR code generator

- **Target query:** "QR code generator", "generate QR code for URL".
- **Demand evidence:** TinyWow runs a dedicated QR tool (`tinywow.com/other/qr-code`); QR
  generation is a well-established, evergreen transactional query independent of this
  audit pass's own research (broad incumbent base: TinyWow plus many single-purpose QR sites).
- **Competition note:** most incumbents round-trip through a server to render the code image;
  this is a genuine no-upload wedge if built with a client-side QR-encoding library (the data
  being encoded -- often a URL, sometimes contact info or Wi-Fi credentials -- is exactly the
  kind of content a privacy-conscious visitor would rather not send to an unknown server).
- **Client-side feasibility:** yes -- needs a small vendored QR-encoding library (same vendoring
  pattern this repo already uses for `pdf-lib`/`exceljs`/`js-yaml` via `scripts/copy-vendor.js`),
  rendered to a downloadable PNG/SVG via canvas.
- **Edge (d):** privacy (real, verifiable difference from most incumbents) + no ads + no
  low-resolution/watermark upsell some competitors gate behind a paywall.
- **Effort estimate (e):** ≤ 2 days (new vendored dependency, plus canvas rendering and a
  download step -- more moving parts than the two tools above).
- **Content-depth note (f):** real FAQ material available (error-correction levels, size limits,
  "can I put Wi-Fi credentials in a QR code", scannability caveats at small sizes).

### 5. Image resize (flagged: folder/family taxonomy question, not just a build item)

- **Target query:** "resize image", "resize photo online".
- **Demand evidence:** TinyWow's own image-tools hub (`tinywow.com/tools/image`) lists resize
  and compress among its most prominent tools, alongside 70+ other image utilities -- a large,
  validated demand category this repo currently has zero presence in (existing image-adjacent
  tools -- `heic-to-jpg-png`, `jpg-png-to-pdf`, `pdf-to-jpg-png` -- are all format-conversion,
  none reshape an image's dimensions or file size).
- **Competition note:** most incumbents (including TinyWow's own image tools) upload the file
  to a server for processing -- a genuine, checkable no-upload wedge, same story as this
  repo's existing PDF/CSV tools.
- **Client-side feasibility:** yes -- canvas `drawImage`/`toBlob` covers resize and
  quality-based compression without any new dependency.
- **Edge (d):** privacy (real) + instant (no upload wait) + no resolution/format upsell.
- **Effort estimate (e):** ≤ 2 days for resize alone; compress-to-target-size is a
  reasonable same-page companion feature, not a second candidate.
- **Content-depth note (f):** real FAQ material available (aspect-ratio locking, output format
  choice, what "quality" actually controls for a lossy re-encode).
- **Flag, not a plain soak item:** this is this repo's first tool with no natural home in the
  current family/folder taxonomy (`src/families.js` has no `image` family; `src/folders.js` has
  no image-oriented folder -- the closest existing precedent, `heic-to-jpg-png`, was slotted
  into `family: 'dev'` as a workaround, not a real fit). Landing an image-*manipulation* tool
  (distinct from the existing image-*conversion* tools) is a taxonomy decision, not just a page
  -- worth a deliberate call on whether this opens a new `image` family/folder (with room
  for future siblings like crop/rotate/watermark) or continues folding into `dev`, rather than
  deciding it silently as a side effect of building the page.

## Not pursued this pass

- **JWT decoder / color-format converter / Markdown-to-HTML / cron-expression explainer** --
  plausible developer-utility candidates in the same vein as #3 above, but not independently
  evidence-checked this pass (budget-capped per the ritual's 5%-of-weekly-capacity ceiling).
  Worth a follow-up pass rather than screening on memory alone.

## Pass 2 -- 2026-08-29 (queue-starved self-trigger)

Run under a 2026-08-29 human ruling permitting a queue-starved session to self-trigger a pass
immediately: the frontier came back genuinely empty for this asset (role-filtered and
full-scan) after the previous work in flight was checkpointed, so this pass ran right away
rather than waiting for the next scheduled cadence or a refill from elsewhere. Same screening
criteria and cap as any other pass; the ritual cadence tracker was marked at the end so the
scheduled cadence isn't double-counted by this self-triggered one.

Source method: incumbent coverage check via live web search (TinyWow, plus the real dedicated
competitors search surfaced for each query) against this repo's current 41-tool registry.
Existing coverage checked first: everything pass 1 already covered, plus (since pass 1) text
diff/compare, word & character counter, Unix timestamp converter, QR code generator, image
resize/compress, and the selective-extraction addition to extract-images-from-pdf. Followed up
on pass 1's own explicitly-deferred "not pursued" list first (JWT decoder, color-format
converter, Markdown-to-HTML, cron-expression explainer), then searched further for new gaps.

### 1. JSON diff / compare tool

- **Target query:** "json diff", "compare json files", "json compare online".
- **Demand evidence:** a large, real dedicated-competitor field confirmed via live search --
  jsondiff.com, jsoncompare.com, jsoncompare.org, jsdiff.com, json-diff.com, semanticdiff.com,
  jsonlint.com's own diff mode, playcode.io's JSON-diff tool -- at least eight independent
  incumbents built around exactly this one query, several naming "semantic diff" (ignoring key
  order/whitespace) as their own headline feature.
- **Competition note:** several incumbents (playcode.io, jsdiff.com, onlinejsonformatt.org)
  already advertise "runs entirely in your browser"/"100% private" as their own differentiator,
  so privacy alone won't be a unique wedge -- same lesson pass 1's own text-diff entry already
  drew. The real gap: none of the surfaced incumbents are this site's own sibling tools, so a
  visitor already using `json-minify-beautify` or `flatten-json` has no reason to trust a
  third-party site for the adjacent "are these two JSON blobs actually different" job.
- **Client-side feasibility:** yes, trivially -- this repo already has the two building blocks
  in production: a real LCS/word-level diff engine (`src/pure/textDiff.mjs`, shipped for
  `text-diff`) and JSON-structure traversal (`src/pure/flattenJson.mjs`/`jsonMinifyBeautify.mjs`).
  A semantic JSON diff is a recursive structural walk (same value/added/removed/changed
  classification `csvDiff.mjs`'s own row-diff already produces for CSV), not a new algorithm
  class for this codebase.
- **Edge (d):** coverage/specificity -- lands in the existing `data-formats` folder alongside
  five sibling JSON tools, so it's a low-effort addition to an already-established audience
  path (same reasoning pass 1's unix-timestamp-converter entry used for the `developer` folder),
  plus a real semantic-diff wedge (ignore key order, ignore whitespace, flag only real value
  changes) matching what only the most sophisticated incumbents (semanticdiff.com) offer.
- **Effort estimate (e):** ≤ 1 day -- reuses this repo's own existing diff-rendering UI pattern
  (`text-diff`'s two-pane layout) and JSON-parsing infrastructure; the new work is the
  recursive structural-diff function itself and its own two-pane/tree render.
- **Content-depth note (f):** real FAQ material distinct from `text-diff`'s own copy -- does key
  order matter (no), how are added/removed array elements shown, what happens on invalid JSON
  in either input, a worked example diffing two realistic API-response-shaped JSON objects.

### 2. JWT decoder

- **Target query:** "jwt decoder", "decode jwt token", "jwt debugger".
- **Demand evidence:** a large, well-established incumbent field confirmed via live search --
  Kinde, 10015.io, SuperTokens, Logto, Authgear's JWT/JWE debugger, calebb.net, plus the
  category-defining jwt.io (not surfaced in this pass's own search results but independently
  well known as the dominant incumbent) -- a mature, evergreen developer-utility query.
- **Competition note:** every incumbent found is itself a developer-tooling or identity-platform
  company (Kinde, SuperTokens, Logto, Authgear) running the tool as a lead-gen/brand play, not a
  neutral utility site -- a real, specific privacy angle exists here that's sharper than most
  candidates on this list: a real JWT can carry session identifiers, user IDs, roles, or other
  claims a visitor would reasonably not want to paste into an identity vendor's own web form
  (however well-intentioned), particularly for a token from a production system being debugged.
- **Client-side feasibility:** yes, trivially -- a JWT is three base64url segments; decoding is
  base64url-decode plus `JSON.parse()` on the header and payload segments, zero dependency.
  This repo's own `base64-encode-decode` tool already proves the base64/base64url decode path
  works reliably client-side. Signature verification (a real HMAC/RSA check) is out of scope for
  a v1 -- decoding claims for inspection is the actual target query, not verification.
- **Edge (d):** privacy (real and specific, per the competition note above) + no
  identity-platform account or sign-up wall some incumbents nudge toward.
- **Effort estimate (e):** ≤ 1 day -- simplest build on this list; no new dependency, no canvas,
  no file I/O.
- **Content-depth note (f):** real FAQ material available -- what `alg`/`typ`/`exp`/`iat` mean,
  why this tool can decode but not verify a signature (and why that's a meaningfully different,
  safer claim than implying verification), what an expired-`exp` token looks like decoded.

### 3. Markdown to HTML converter

- **Target query:** "markdown to html", "convert markdown to html online".
- **Demand evidence:** TinyWow runs a dedicated tool for this exact query
  (`tinywowpdf.com/md-to-html-converter`, confirmed live), alongside independent competitors
  (codeshack.io, codebeautify.org, Syncfusion's free-tools page, markdowntohtml.com) -- a
  real, multi-incumbent transactional query, not a one-off.
- **Competition note:** most incumbents are either ad-heavy (codebeautify.org-style aggregator
  sites) or a vendor's own lead-gen tool (Syncfusion promoting its own rich-text-editor
  component) -- no incumbent's own no-upload/no-ad stance was confirmed in this pass's search,
  so the same wedge this site's other developer tools already use (zero-ad, zero-signup,
  instant) applies cleanly here too.
- **Client-side feasibility:** yes, with one small new vendored dependency -- Markdown parsing
  correctly (nested lists, code fences, tables, links) is exactly the kind of hand-rolled-parser
  risk this site already treats carefully for any hand-written text parser; a small,
  well-established MIT-licensed parser (e.g. `marked`, zero runtime deps) vendored the same way
  this repo already vendors `js-yaml`/`qrcode-generator` via `scripts/copy-vendor.js` is the
  safer and faster path than hand-rolling CommonMark parsing.
- **Edge (d):** no ads + no vendor lead-gen framing + (real, checkable) no-upload, since the
  Markdown source itself may contain a visitor's own not-yet-published writing.
- **Effort estimate (e):** ≤ 1-2 days -- the vendoring step plus the usual `npm audit`/license
  check this site already runs for any new runtime dependency adds real but bounded overhead
  over a zero-dependency tool.
- **Content-depth note (f):** real FAQ material available -- which Markdown flavor/extensions
  are supported (tables, fenced code, strikethrough), whether raw HTML embedded in the Markdown
  source passes through (a real security-relevant question worth an honest, specific answer,
  not a vague "yes"), a worked example converting a realistic README-shaped document.

### 4. Cron expression generator & explainer

- **Target query:** "cron expression generator", "explain cron expression", "cron job builder".
- **Demand evidence:** a real, established incumbent field confirmed via live search --
  crontab.guru (the category-defining, widely-known incumbent), UptimeRobot's CrontabRobot,
  Uptimia's generator, Coddy's generator-and-decoder, cronexpert.com -- a durable developer
  query with no single overwhelming winner outside crontab.guru itself.
- **Competition note:** crontab.guru itself is minimal (a single input plus a plain-English
  explanation, no builder UI, no next-run-times list) -- most of the smaller incumbents add a
  visual builder (dropdowns/checkboxes per field) on top of that same core, which is itself the
  validated shape to match rather than reinvent.
- **Client-side feasibility:** yes -- cron-syntax parsing and next-N-run-time computation is
  pure calendar-math JS, no dependency strictly required, though the day-of-month/day-of-week
  OR-logic edge case and month-boundary/leap-year handling are real correctness risks worth
  extra unit-test coverage (same rigor this repo's own `unix-timestamp-converter` and
  `statement-to-csv` date-handling code already gets) rather than a casual implementation.
- **Edge (d):** specificity/coverage -- pairs naturally with the existing `developer` folder
  (regex tester, unix timestamp converter), and a same-page visual builder plus plain-English
  explanation plus a real next-N-run-times list in one place is more complete than
  crontab.guru's own minimal single-field version.
- **Effort estimate (e):** ≤ 2 days -- the correctness-sensitive calendar math (and its test
  coverage) is genuinely more involved than most candidates on this list, closer to the
  QR-generator/image-resize entries' own two-day estimate than the simpler one-day tools above.
- **Content-depth note (f):** real FAQ material available -- what each of the five fields means,
  how day-of-month and day-of-week interact when both are restricted (a genuinely confusing,
  underspecified-by-cron-itself edge case worth a real, specific answer), a worked example
  explaining a realistic deploy-script cron line.

### 5. Crop image (image family)

- **Target query:** "crop image online", "crop photo free".
- **Demand evidence:** a large, real incumbent field confirmed via live search
  (crop.imageonline.co, freetoolonline.com, imageresizer.com, imgtweak.com, allimagetools.com,
  pixelpanda.ai, fasttool.app) -- a well-established, evergreen image-utility query, distinct
  from "resize image" per real autosuggest behavior (a visitor cropping wants to remove part of
  a frame, not scale the whole thing down).
- **Competition note:** the client-side/no-upload wedge is already common and explicitly
  advertised across MOST of these incumbents (imgtweak.com, allimagetools.com, pixelpanda.ai all
  state "runs in your browser"/"never leaves your device") -- privacy alone is not a
  differentiator in this specific niche the way it still is for PDF/CSV tooling. Per this rule's
  own screening note, saturation alone isn't a drop reason, but the real edge here has to be
  coverage/specificity (living in this site's own new `image` family alongside
  `image-resize-compress`, so a visitor already there has no reason to leave) rather than a
  privacy claim that would just repeat what several rivals already say.
- **Client-side feasibility:** yes -- canvas `drawImage` with a draggable/resizable selection
  rectangle covers cropping without any new dependency; the same `ImageBitmap`/canvas pipeline
  `image-resize-compress` already established is directly reusable.
- **Edge (d):** coverage -- the `image` family/folder's own stated rationale (from the taxonomy
  decision that created it) explicitly named crop as a real future sibling; landing it validates
  that decision rather than leaving the folder a single-tool page. A real, specific feature edge
  some incumbents lack: fixed-ratio presets for common real uses (1:1, 16:9, a social-avatar
  square) named explicitly on the page, per pixelpanda.ai's own "Instagram & YouTube presets"
  framing as the one differentiated feature actually worth matching.
- **Effort estimate (e):** ≤ 2 days -- a draggable/resizable crop-rectangle UI (pointer-event
  handling for drag and resize handles) is more interactive-UI work than `image-resize-compress`
  needed, closer to the QR-generator entry's own two-day estimate.
- **Content-depth note (f):** real FAQ material available -- how the fixed-ratio presets work,
  whether cropping re-compresses the image (same honest answer `image-resize-compress`'s own FAQ
  already gives for resizing), what happens if the crop selection is dragged outside the image
  bounds.

## Not pursued this pass (pass 2)

- **Color-format converter (hex/RGB/HSL)** -- explicitly re-screened this time, not just
  deferred again. Real demand exists (RapidTables, W3Schools, WebFX, and several others all rank
  for "hex to rgb converter"), but the wedge is genuinely weak: color-code conversion carries no
  privacy story at all (a hex code is never sensitive data), and the incumbents include some of
  the most trusted, highest-authority reference sites on the web (W3Schools, RapidTables) already
  offering the exact same instant, free, no-signup experience this site's own wedge usually
  relies on. Coverage/specificity alone doesn't clear the bar either -- a color converter has no
  natural home in this site's own current family taxonomy (not a document format, not a
  developer-utility in the `hash-generator`/`regex-tester` sense) and would need its own new
  taxonomy carve-out for a candidate with a genuinely weak edge. Declined, not just deferred.
- **Image watermark (add)** -- plausible image-family sibling per the same taxonomy rationale as
  crop above, but this pass's own search surfaced TinyWow's watermark tooling as PDF-watermark
  and photo-watermark-REMOVAL specifically, not a confirmed image-watermark-ADD tool from a
  named incumbent -- weaker demand evidence than the other four candidates above, worth a
  dedicated follow-up search rather than screening in on a partial signal.
