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
