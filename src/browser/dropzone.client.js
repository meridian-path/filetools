// Shared drop-zone controller -- page-agnostic UI/state-machine logic used
// by every tool page on the site. Knows nothing about
// PDFs specifically: it validates file type/count against the #tool
// section's data-accept/data-multiple attributes, manages the dropzone's
// five visual states (idle/dragover/working/error/done -- see src/css.js),
// and hands the chosen FileList off to the mode-specific processor named by
// #tool's data-client attribute (e.g. "pdfPages" -> ./pdfPages.client.js,
// "pdfTables" -> ./pdfTables.client.js -- this is the TOOLS registry's
// `clientEntry` field, see src/tools/index.js). Loaded as a plain
// <script type="module"> (see src/pages/toolPage.js) -- no bundler, no
// build step needed for this file itself to run in a browser.
//
// THE LANGUAGE RULE: the word "upload" never appears in any control, status,
// or error string here. Nothing this site does is actually an upload (the
// whole point is that files never leave the device), so using that word in
// the UI would be actively misleading, not just off-brand.
//
// PROCESSORS/MAX_BYTES_BY_CLIENT/PASTE_FILE (2026-08-22 fragment-pattern
// refactor): these three maps used to be hand-typed consts right here, one
// line added per new tool to each of them. They're now generated at build
// time (src/build.js's writeDropzoneRegistry(), from each tool's own
// clientEntry/maxBytes/pasteFile fields -- see src/tools/pdf-merge.js's
// comment above its own `family` field, and src/browserClients.js) into
// dropzone.registry.generated.js, a sibling module written alongside this
// file's own copy into dist/js/ -- never checked into git, exactly like
// every other file under dist/. This file itself still needs zero build
// step to run in a browser; only its generated sibling is codegen'd. A
// newly merged tool adds its own src/tools/<slug>.js; this file (the
// hand-authored controller logic) never changes.
import { PROCESSORS, MAX_BYTES_BY_CLIENT, PASTE_FILE } from './dropzone.registry.generated.js';
import { pasteEmptyErrorMessage } from '../pure/pasteEmptyError.mjs';

const toolSection = document.getElementById('tool');
if (toolSection) {
  const mode = toolSection.dataset.mode;
  const clientEntry = toolSection.dataset.client || 'pdfPages';
  const accept = (toolSection.dataset.accept || '').split(',').map((s) => s.trim()).filter(Boolean);
  const multiple = toolSection.dataset.multiple === 'true';
  // src/pages/toolPage.js's own fileTypeLabel field (see its comment there:
  // '' is a deliberate "no type name in the copy" value, distinct from the
  // attribute being entirely absent -- toolPage.js always emits the
  // attribute now, so a missing one only happens on a page this file
  // doesn't otherwise recognize, and 'PDF' is the same safe default
  // toolPage.js itself falls back to for an omitted field).
  const fileTypeLabel = toolSection.dataset.fileTypeLabel === undefined ? 'PDF' : toolSection.dataset.fileTypeLabel;

  /** "a CSV file" / "an Excel file" / "an HTML file" / "a SQL file" -- a/an
   * choice by sound, not just spelling: a plain leading vowel LETTER
   * ("Excel"), or a leading consonant letter that's pronounced with a vowel
   * sound as part of an acronym ("HTML" = "aitch-tee-em-el", "XML" =
   * "eks-em-el"). Deliberately NOT a general "any 2+-capital acronym
   * starting with F/H/L/M/N/R/S/X reads as a vowel sound" rule -- that
   * broader guess was tried and shipped once, then broke on this
   * codebase's own real "SQL file" label: SQL is conventionally read as
   * the word "sequel" (this tool's own meta description already says "a
   * SQL query", establishing the intended pronunciation), not spelled out
   * as "ess-cue-ell", so S does not universally read as a vowel sound the
   * way H and X do. Rather than re-guess at more letters, this stays an
   * explicit allow-list of the two letters actually verified against a
   * real label today; add a new letter here only once a real fileTypeLabel
   * needs it, with its pronunciation checked against this exact trap. */
  function withArticle(label) {
    const vowelSound = /^[aeiou]/i.test(label) || /^[HX][A-Z]/.test(label);
    return `${vowelSound ? 'an' : 'a'} ${label}`;
  }

  /** "CSV files" / "Excel files" / "files" -- strips a trailing "file" before adding "files" so "CSV file" doesn't become "CSV file files". */
  function pluralize(label) {
    return label.endsWith('file') ? `${label.slice(0, -4)}files` : `${label} files`;
  }

  const dropzone = toolSection.querySelector('.dropzone');
  const fileInput = toolSection.querySelector('#file-input');
  const statusEl = toolSection.querySelector('.dz-status');
  const resultEl = toolSection.querySelector('.result');
  const cancelBtn = toolSection.querySelector('.dz-cancel');
  const progressFill = toolSection.querySelector('.progress-fill');
  // Craft-audit fixes (items 4/5): the paste box's own status line,
  // independent of the file drop-zone's `.dz-status`/visual state above.
  // See handleFileList()'s `source` parameter below for how a paste-
  // triggered run is routed here instead of touching the drop-zone at all.
  const pasteStatusEl = toolSection.querySelector('.paste-status');

  // "working" state timing (the three standard response-time limits -
  // visible change within 100ms, explicit working state past 1s,
  // determinate progress past 10s): a generation counter is bumped on
  // every new file selection
  // AND on Cancel, so a
  // processor that's still running when the visitor cancels can finish
  // its work in the background without ever touching the UI again --
  // that's what makes Cancel real from the visitor's point of view, even
  // though no per-processor AbortSignal plumbing exists to stop the
  // in-flight CPU work itself (out of scope for this pass; noted here so
  // it isn't assumed away).
  let currentGeneration = 0;
  let slowTimer = null;

  function clearSlowTimer() {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    delete dropzone.dataset.slow;
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      currentGeneration += 1;
      clearSlowTimer();
      setState('idle');
      setStatus('Cancelled.');
      resultEl.hidden = true;
      resultEl.innerHTML = '';
    });
  }

  // PROCESSORS, MAX_BYTES_BY_CLIENT, and PASTE_FILE are imported at the
  // top of this file -- see the comment there for why they're generated
  // rather than hand-typed here now. PROCESSORS stays a known, closed map
  // (codegen'd as one, not a template-string import(`./${clientEntry}.
  // client.js`)) so an unexpected or malformed data-client value fails
  // loudly (see the catch in handleFileList) instead of silently
  // attempting an arbitrary import.
  const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

  function formatMb(bytes) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }

  let processorPromise = null;
  function warmProcessor() {
    if (!processorPromise) {
      const loader = PROCESSORS[clientEntry];
      processorPromise = (loader ? loader() : Promise.reject(new Error(`Unknown tool client: ${clientEntry}`)))
        .catch((err) => {
          // A dynamic import can fail (module not cached yet and the
          // network dropped mid-fetch, a bad deploy, etc). Never let the
          // raw "Failed to fetch dynamically imported module: ..." string
          // reach the visitor -- replace it with a sentence they can act
          // on, and clear the cached promise so the next file selection
          // gets a fresh attempt instead of the same stale rejection.
          processorPromise = null;
          throw new Error('The tool’s code hasn’t finished downloading yet - reconnect for a moment, then try again.');
        });
    }
    return processorPromise;
  }
  // Warm the (larger) pdf.js/pdf-lib import as soon as the visitor shows
  // intent, so the perceived cost at actual file-selection time is near
  // zero for anyone who uses the tool. These two callers don't consume the
  // result, so swallow a warm-time rejection here -- a real failure still
  // surfaces normally from handleFileList's own await below.
  dropzone.addEventListener('pointerenter', () => warmProcessor().catch(() => {}), { once: true });
  dropzone.addEventListener('focusin', () => warmProcessor().catch(() => {}), { once: true });

  // Also warm unconditionally once the page has finished loading and the
  // browser is idle. This is what makes "turn off your Wi-Fi and this page
  // still works" true for a visitor who never hovers or focuses the drop
  // zone before going offline -- the scenario the pre-deploy review found
  // broken. Deferred to idle time rather than fired immediately so it
  // never competes with the initial paint: requestIdleCallback only runs
  // once the browser has nothing more pressing to do, so this costs
  // nothing against Lighthouse Performance.
  function warmOnIdle() {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => warmProcessor().catch(() => {}), { timeout: 4000 });
    } else {
      setTimeout(() => warmProcessor().catch(() => {}), 1000);
    }
  }
  if (document.readyState === 'complete') {
    warmOnIdle();
  } else {
    window.addEventListener('load', warmOnIdle, { once: true });
  }

  function setState(state) {
    dropzone.dataset.state = state;
    // Every fresh "working" phase starts indeterminate (the site's default --
    // most processors never call setProgress at all, and the progress-loop
    // CSS animation already carries that case). A processor that DOES know a
    // real done/total (see setProgress below) upgrades to a determinate bar
    // partway through; clearing here on every transition INTO "working"
    // means a stale determinate width from a two-step tool's PREVIOUS run
    // (pick files -> reorder -> press "Merge"/"Convert" again) can never
    // leak into the next run before its own first setProgress call, if any.
    if (state === 'working') {
      delete dropzone.dataset.determinate;
      if (progressFill) progressFill.style.width = '';
    }
  }

  function setStatus(message, tone) {
    statusEl.textContent = message || '';
    if (tone) statusEl.dataset.tone = tone;
    else delete statusEl.dataset.tone;
  }

  /** Upgrades the progress bar from indeterminate to a real, determinate
   * done/total width -- for the handful of batch processors whose loop
   * genuinely knows both numbers (see src/browser/batchProgress.js). Most
   * tools never call this; the bar stays indeterminate and that's correct
   * for them (the "determinate progress past 10s" requirement only bites
   * once a processor can actually count units). */
  function setProgress(done, total) {
    if (!progressFill || !total) return;
    dropzone.dataset.determinate = 'true';
    const pct = Math.max(0, Math.min(100, (done / total) * 100));
    progressFill.style.width = `${pct}%`;
  }

  function fileMatchesAccept(file) {
    if (!accept.length) return true;
    return accept.some((pattern) => {
      // A leading dot is a filename-extension pattern (e.g. ".html") rather
      // than a MIME type -- needed because some browser/OS combinations
      // report an empty or unexpected `file.type` for less common
      // extensions, and checking the extension too is a cheap backstop.
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
      if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -1));
      return file.type === pattern;
    });
  }

  /**
   * Craft-audit fixes (items 4/5): routes a status message/state change to
   * either the shared file drop-zone (`source === 'file'`, unchanged
   * behavior) or the paste box's OWN independent status line
   * (`source === 'paste'`) -- never both. Before this, EVERY validation
   * error and EVERY processor state transition landed on the shared
   * `.dz-status`/`dropzone.dataset.state` regardless of which input path
   * triggered it, so converting via the paste box could flip the
   * completely unrelated file drop-zone to a green "done" checkmark
   * (item 5, implying a file had been dropped when none was), and an error
   * raised by the paste box lived on past the moment a visitor started
   * typing something valid, since nothing ever cleared it except another
   * click (item 4 -- now cleared by the paste textarea's own 'input'
   * listener below instead).
   * @param {'file'|'paste'} source
   */
  function reportStatus(source, message, tone) {
    if (source === 'paste') {
      if (!pasteStatusEl) return;
      pasteStatusEl.textContent = message || '';
      if (tone) pasteStatusEl.dataset.tone = tone;
      else delete pasteStatusEl.dataset.tone;
    } else {
      setStatus(message, tone);
    }
  }
  function reportState(source, state) {
    // The drop-zone's own visual state (icon/checkmark/border color) is
    // reserved for real file-drop/choose actions -- a paste-triggered run
    // never touches it, so the two affordances stay genuinely independent.
    if (source !== 'paste') setState(state);
  }

  async function handleFileList(fileList, source = 'file') {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (!multiple && files.length > 1) {
      reportState(source, 'error');
      reportStatus(source, `This tool works on one file at a time. Choose a single ${fileTypeLabel || 'file'}.`, 'error');
      return;
    }

    const bad = files.find((f) => !fileMatchesAccept(f));
    if (bad) {
      reportState(source, 'error');
      reportStatus(
        source,
        fileTypeLabel
          ? `"${bad.name}" isn't ${withArticle(fileTypeLabel)} - this tool reads ${pluralize(fileTypeLabel)}.`
          : `"${bad.name}" isn't a supported file type for this tool.`,
        'error'
      );
      return;
    }

    const maxBytes = MAX_BYTES_BY_CLIENT[clientEntry] || DEFAULT_MAX_BYTES;
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      reportState(source, 'error');
      reportStatus(source, `"${tooBig.name}" is too large (${formatMb(tooBig.size)}). This tool handles files up to ${formatMb(maxBytes)} - anything bigger risks freezing your browser tab.`, 'error');
      return;
    }

    const myGeneration = ++currentGeneration;
    function stillCurrent() {
      return myGeneration === currentGeneration;
    }

    reportState(source, 'working');
    reportStatus(source, source === 'paste' ? 'Reading that on this device…' : 'Reading your file on this device…');
    resultEl.hidden = true;
    resultEl.innerHTML = '';

    // Past 10s of the SAME job still running, reveal the Cancel button
    // (Nielsen's third response-time limit). Guarded by stillCurrent() so
    // a fast job that already finished doesn't pop it back up late. Left
    // tied to the drop-zone regardless of source -- a real 10s+ stall is
    // rare enough for a paste-driven job (no large-file I/O) that it isn't
    // part of this fix's scope; only the ordinary error/done states above
    // and below are what items 4/5 actually reported.
    clearSlowTimer();
    slowTimer = setTimeout(() => {
      if (stillCurrent()) dropzone.dataset.slow = 'true';
    }, 10000);

    try {
      const processor = await warmProcessor();
      // setState/setStatus/resultEl are only ever touched by this
      // generation's own processor.run() call below (a plain object, not a
      // wrapped guard) -- the guard applies to the OUTER handling here, so
      // a superseded generation's eventual resolution/rejection can't
      // overwrite what a later (or cancelled) selection already put on
      // screen.
      await processor.run({
        mode,
        files,
        section: toolSection,
        dropzone,
        resultEl,
        setState: (s) => { if (stillCurrent()) reportState(source, s); },
        setStatus: (m, t) => { if (stillCurrent()) reportStatus(source, m, t); },
        setProgress: (done, total) => { if (stillCurrent()) setProgress(done, total); },
      });
      if (stillCurrent()) clearSlowTimer();
    } catch (err) {
      if (stillCurrent()) {
        clearSlowTimer();
        reportState(source, 'error');
        reportStatus(source, err && err.message ? err.message : 'Something went wrong reading that file.', 'error');
      }
    }
  }

  fileInput.addEventListener('change', (e) => {
    handleFileList(e.target.files);
    // Reset so choosing the exact same file twice in a row still fires
    // 'change' the second time.
    e.target.value = '';
  });

  // "Magnetic" target: bind drag/drop to the whole tool section, not just
  // the visual dashed box, so a release slightly outside the dashes still
  // lands.
  ['dragenter', 'dragover'].forEach((evt) => {
    toolSection.addEventListener(evt, (e) => {
      e.preventDefault();
      setState('dragover');
    });
  });
  ['dragleave', 'dragend'].forEach((evt) => {
    toolSection.addEventListener(evt, (e) => {
      if (evt === 'dragleave' && toolSection.contains(e.relatedTarget)) return;
      if (dropzone.dataset.state === 'dragover') setState('idle');
    });
  });
  toolSection.addEventListener('drop', (e) => {
    e.preventDefault();
    setState('idle');
    if (e.dataTransfer && e.dataTransfer.files) handleFileList(e.dataTransfer.files);
  });

  // A drag that misses the tool section entirely should never navigate the
  // tab away and destroy the visitor's in-progress work.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (!toolSection.contains(e.target)) e.preventDefault();
  });

  // Optional second input path (src/pages/toolPage.js's `pasteInput`
  // block -- every tool that sets a `pasteInput` field, e.g.
  // html-table-to-csv, csv-to-json, json-minify-beautify): pasted text is
  // wrapped in a synthetic File and pushed through the exact same
  // handleFileList/processor.run() path (with source:'paste' -- see
  // reportStatus/reportState above) a chosen/dropped file takes, so every
  // tool's processor only ever has to handle one input shape.
  const pasteContainer = toolSection.querySelector('.paste-input');
  const pasteTextarea = toolSection.querySelector('.paste-textarea');
  const pasteButton = toolSection.querySelector('.paste-convert-btn');
  // Craft-audit fix (item 6): a tool whose `pasteInput.live` field is true
  // (toolPage.js threads it through as `data-live="true"` on this same
  // container) auto-converts on type instead of waiting for a button
  // click -- currently json-minify-beautify only, see that tool's own
  // comment for why. The button stays as a manual fallback either way.
  const pasteLive = !!(pasteContainer && pasteContainer.dataset.live === 'true');
  // Craft-audit fix: this used to hardcode "Paste some markup first" for
  // every tool with a paste box, calling a JSON/CSV/SQL paste "markup" even
  // though only html-table-to-csv's own input actually is markup. Read
  // straight off the tool's own visible paste-box label (toolPage.js's
  // `pasteInput.label`, rendered as this same container's own <label>) --
  // the exact noun a visitor already sees printed above the box, so the
  // error can never drift out of sync with what the label says. See
  // ../pure/pasteEmptyError.mjs for the actual message-building logic.
  const pasteLabelEl = pasteContainer && pasteContainer.querySelector('label');
  const pasteLabelText = (pasteLabelEl && pasteLabelEl.textContent) || '';

  function runPasteConvert(text, { reportEmptyAsError }) {
    if (!text.trim()) {
      if (reportEmptyAsError) {
        reportStatus('paste', pasteEmptyErrorMessage(pasteLabelText), 'error');
      } else {
        // Live mode with nothing typed (yet): a silent reset, not an
        // error -- an empty box mid-typing isn't a mistake to flag.
        reportStatus('paste', '');
        resultEl.hidden = true;
        resultEl.innerHTML = '';
      }
      return;
    }
    const pasteFile = PASTE_FILE[clientEntry] || { name: 'pasted-input.txt', type: 'text/plain' };
    const file = new File([text], pasteFile.name, { type: pasteFile.type });
    handleFileList([file], 'paste');
  }

  if (pasteTextarea && pasteButton) {
    pasteButton.addEventListener('click', () => {
      runPasteConvert(pasteTextarea.value, { reportEmptyAsError: true });
    });

    // Craft-audit fix (item 4): clear this paste box's OWN status the
    // moment its content changes, rather than leaving a stale error (or
    // stale success message) on screen until the next explicit click.
    let liveDebounceTimer = null;
    pasteTextarea.addEventListener('input', () => {
      reportStatus('paste', '');
      if (!pasteLive) return;
      if (liveDebounceTimer) clearTimeout(liveDebounceTimer);
      const text = pasteTextarea.value;
      liveDebounceTimer = setTimeout(() => {
        runPasteConvert(text, { reportEmptyAsError: false });
      }, 250);
    });
  }
}
