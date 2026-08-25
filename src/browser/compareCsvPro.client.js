// Compare-CSV Pro: the paid add-on to the free compare-csv tool.
// NOT part of ./dropzone.client.js's
// file-driven PROCESSORS routing -- src/pages/toolPage.js loads this file
// directly as an extra <script type="module"> alongside the tool's normal
// dropzone script, whenever a tool's registration carries a `proFeature`
// field (see src/tools/compare-csv.js). It owns its own self-contained
// `.pro-feature` section, entirely additive: the free single-pair compare
// above it is completely unchanged by anything in this file.
//
// Two things ship, unlocked together by one license code:
//   1. Batch mode -- many file pairs (a "Batch A" selection and a "Batch B"
//      selection) compared in one pass, matched by filename stem (see
//      ../pure/compareCsvPro.mjs's pairFilesByStem). Reuses the exact same
//      diff engine the free tool uses (../pure/csvDiff.mjs) per pair --
//      nothing about the diff algorithm itself is different or "better" in
//      Pro, only that it runs across many files at once.
//   2. A combined Excel diff report -- one workbook, one sheet per matched
//      pair, changed/added/removed rows fill-highlighted. ExcelJS loading
//      duplicates ../browser/csvToXlsx.client.js's own UMD <script> pattern
//      (see that file's header comment for why) -- this directory's
//      established "no browser client file imports another" convention.
//
// License gate: a client-side-only check against Gumroad's public license
// verify API (https://api.gumroad.com/v2/licenses/verify) -- no backend, no
// secret. This is inherently not tamper-proof (nothing running only in the
// browser can be) -- an accepted, disclosed tradeoff: the goal is a
// legitimate paywall for a typical visitor, not DRM.
//
// PLACEHOLDER PRODUCT, RENDERED HONESTLY: no real Gumroad product exists
// yet as of this commit -- creating one is a human action (money/account,
// outside what this session does). GUMROAD_CONFIG below is the one place
// that changes once it does: fill in both fields with the real values from
// the created product and the "coming soon" copy switches to a real Buy
// link and unlock-code box automatically. Until then, a visitor is told
// plainly this isn't for sale yet -- never shown a live-looking but broken
// purchase link.
const GUMROAD_CONFIG = {
  // The full purchase-page URL a visitor clicks to buy
  // (e.g. "https://SELLER.gumroad.com/l/PERMALINK"). Fill in once the
  // product exists.
  buyUrl: null,
  // The short product permalink Gumroad's license-verify API itself needs
  // as `product_permalink` (e.g. "abcde") -- a different value from the
  // full buyUrl above, also only known once the product exists.
  productPermalink: null,
};

const UNLOCK_STORAGE_KEY = 'compare-csv-pro-unlocked';
const PRICE_LABEL = '$3';

// Batch mode's two file inputs are plain <input type="file"> elements, NOT
// routed through ./dropzone.client.js's own per-clientEntry maxBytes
// enforcement (see this file's header comment for why) -- so this needs its
// own explicit cap, checked before any file content is read. Matches
// src/tools/compare-csv.js's own registered `maxBytes` for the free tool,
// so "up to 20MB per file" means the same thing in both places on this
// page.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const STATUS_FILL = {
  changed: 'FFFFF3CD',
  added: 'FFD4EDDA',
  removed: 'FFF8D7DA',
};

function isUnlocked() {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
  } catch {
    // Private-browsing/storage-blocked contexts throw on access -- treated
    // as "not unlocked" rather than crashing the page; a real purchaser in
    // that state re-enters their code each visit, which is the same
    // fallback any localStorage-dependent feature on this site accepts.
    return false;
  }
}

function setUnlocked() {
  try {
    window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
  } catch {
    // Storage blocked -- the unlock still applies for the rest of this
    // page load (the caller re-renders immediately after calling this),
    // it just won't persist across a reload. Disclosed via the same
    // honest-degradation posture as every other localStorage use here.
  }
}

let excelJsPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/exceljs/exceljs.min.js', import.meta.url).href;
      script.onload = () => {
        if (window.ExcelJS) resolve(window.ExcelJS);
        else reject(new Error('The spreadsheet writer loaded but didn’t initialize correctly.'));
      };
      script.onerror = () => reject(new Error('The tool’s code hasn’t finished downloading yet - reconnect for a moment, then try again.'));
      document.head.appendChild(script);
    }).catch((err) => {
      excelJsPromise = null;
      throw err;
    });
  }
  return excelJsPromise;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * @param {object} outcome a ../pure/csvDiff.mjs diffCsvFiles() result.
 * @returns {{header: string[], rows: Array<{status: string, cells: string[]}>}}
 *   the same "old → new" single-cell convention the free tool's CSV
 *   download uses, kept separately here (not imported) per this
 *   directory's established no-cross-import convention for browser files.
 *   Every value here comes straight from the uploaded files -- untrusted --
 *   so `neutralize` (../pure/compareCsvPro.mjs's neutralizeFormulaInjection,
 *   threaded in rather than re-imported here) is applied to the header row
 *   and every data cell before it's written to the workbook, the same
 *   formula-injection control the free tool's CSV download already gets
 *   from ../pure/csv.mjs's own csvEscapeField.
 *
 * @param {object} outcome
 * @param {(value: string) => string} neutralize
 */
function buildSheetRows(outcome, neutralize) {
  const width = outcome.columnCount;
  const header = ['Status'];
  for (let c = 0; c < width; c += 1) {
    const fromB = outcome.headerB && c < outcome.headerB.length ? outcome.headerB[c].trim() : '';
    const fromA = outcome.headerA && c < outcome.headerA.length ? outcome.headerA[c].trim() : '';
    header.push(neutralize(fromB || fromA || `Column ${c + 1}`));
  }
  const rows = outcome.rows.map((r) => {
    const cells = [r.status];
    for (let c = 0; c < width; c += 1) {
      if (r.status === 'changed' && r.changedCells.includes(c)) {
        const av = r.a && c < r.a.length ? r.a[c] : '';
        const bv = r.b && c < r.b.length ? r.b[c] : '';
        cells.push(neutralize(`${av} → ${bv}`));
      } else {
        const src = r.b || r.a || [];
        cells.push(neutralize(c < src.length ? src[c] : ''));
      }
    }
    return { status: r.status, cells };
  });
  return { header, rows };
}

/**
 * @param {Array<{stem: string, nameA: string, nameB: string, outcome: object}>} results
 * @returns {Promise<Blob>}
 */
async function buildCombinedWorkbook(results) {
  const { sheetNameFor, neutralizeFormulaInjection } = await import('../pure/compareCsvPro.mjs');
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set();

  results.forEach(({ stem, outcome }) => {
    const sheetName = sheetNameFor(stem, usedNames);
    usedNames.add(sheetName);
    const sheet = workbook.addWorksheet(sheetName);
    const { header, rows } = buildSheetRows(outcome, neutralizeFormulaInjection);
    sheet.addRow(header);
    rows.forEach((row) => {
      const excelRow = sheet.addRow(row.cells);
      const fill = STATUS_FILL[row.status];
      if (fill) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        });
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function readFilesAsText(fileList) {
  return Promise.all(Array.from(fileList).map(async (file) => ({ name: file.name, text: await file.text() })));
}

function renderLockedView(root, config) {
  root.innerHTML = '';

  const desc = document.createElement('p');
  desc.textContent = `Compare-CSV Pro adds batch mode (compare many file pairs at once, matched by filename) and a combined Excel report with changed/added/removed rows highlighted - a one-time ${PRICE_LABEL} unlock. The free comparison above is unaffected either way.`;
  root.appendChild(desc);

  if (config.buyUrl) {
    const buyRow = document.createElement('div');
    buyRow.className = 'download-btn-row';
    const buyLink = document.createElement('a');
    buyLink.className = 'btn-primary';
    buyLink.href = config.buyUrl;
    buyLink.target = '_blank';
    buyLink.rel = 'noopener noreferrer';
    buyLink.textContent = `Buy Pro - ${PRICE_LABEL}`;
    buyRow.appendChild(buyLink);
    root.appendChild(buyRow);
  } else {
    const comingSoon = document.createElement('div');
    comingSoon.className = 'alert alert-warn';
    comingSoon.setAttribute('role', 'status');
    comingSoon.textContent = 'Not listed for sale yet - coming soon.';
    root.appendChild(comingSoon);
  }

  if (config.productPermalink) {
    const unlockLabel = document.createElement('label');
    unlockLabel.textContent = 'Already purchased? Enter your unlock code:';
    unlockLabel.htmlFor = 'pro-license-input';
    root.appendChild(unlockLabel);

    const unlockRow = document.createElement('div');
    unlockRow.className = 'table-block-head';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'pro-license-input';
    input.maxLength = 200;
    input.autocomplete = 'off';
    input.spellcheck = false;
    unlockRow.appendChild(input);

    const unlockBtn = document.createElement('button');
    unlockBtn.type = 'button';
    unlockBtn.className = 'btn-secondary';
    unlockBtn.textContent = 'Unlock';
    unlockRow.appendChild(unlockBtn);
    root.appendChild(unlockRow);

    const statusEl = document.createElement('div');
    statusEl.setAttribute('role', 'status');
    root.appendChild(statusEl);

    unlockBtn.addEventListener('click', async () => {
      const code = input.value.trim();
      statusEl.innerHTML = '';
      if (!code) {
        statusEl.innerHTML = '<div class="alert alert-warn" role="alert">Enter your unlock code first.</div>';
        return;
      }
      unlockBtn.disabled = true;
      unlockBtn.textContent = 'Checking…';
      try {
        const { interpretLicenseResponse } = await import('../pure/compareCsvPro.mjs');
        // increment_uses_count is left at Gumroad's own default (true) --
        // this is a genuine new activation (this browser didn't have Pro
        // unlocked before this call), so counting it against the license's
        // real uses is the correct, expected behavior for an
        // activate-this-device flow, not an oversight.
        const body = new URLSearchParams({ product_permalink: config.productPermalink, license_key: code });
        const response = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
        const json = await response.json().catch(() => null);
        const result = interpretLicenseResponse(json);
        if (result.ok) {
          setUnlocked();
          renderUnlockedView(root, config);
        } else {
          statusEl.innerHTML = '';
          const alert = document.createElement('div');
          alert.className = 'alert alert-danger';
          alert.setAttribute('role', 'alert');
          alert.textContent = result.error;
          statusEl.appendChild(alert);
        }
      } catch {
        statusEl.innerHTML = '<div class="alert alert-danger" role="alert">Couldn’t reach the license server - check your connection and try again.</div>';
      } finally {
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock';
      }
    });
  }
}

function renderUnlockedView(root, config) {
  root.innerHTML = '';

  const confirmEl = document.createElement('p');
  confirmEl.className = 'caption';
  confirmEl.textContent = 'Pro unlocked on this device.';
  root.appendChild(confirmEl);

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const labelA = document.createElement('label');
  labelA.appendChild(document.createTextNode('Batch A (original) files '));
  const inputA = document.createElement('input');
  inputA.type = 'file';
  inputA.accept = '.csv,text/csv';
  inputA.multiple = true;
  labelA.appendChild(inputA);
  head.appendChild(labelA);

  const labelB = document.createElement('label');
  labelB.appendChild(document.createTextNode('Batch B (changed) files '));
  const inputB = document.createElement('input');
  inputB.type = 'file';
  inputB.accept = '.csv,text/csv';
  inputB.multiple = true;
  labelB.appendChild(inputB);
  head.appendChild(labelB);

  const compareBtn = document.createElement('button');
  compareBtn.type = 'button';
  compareBtn.className = 'btn-primary';
  compareBtn.textContent = 'Compare batch';
  head.appendChild(compareBtn);

  root.appendChild(head);

  const outEl = document.createElement('div');
  root.appendChild(outEl);

  compareBtn.addEventListener('click', async () => {
    const filesA = inputA.files;
    const filesB = inputB.files;
    outEl.innerHTML = '';
    if (!filesA || !filesB || filesA.length === 0 || filesB.length === 0) {
      outEl.innerHTML = '<div class="alert alert-warn" role="alert">Choose files for both Batch A and Batch B first.</div>';
      return;
    }

    const oversized = [...filesA, ...filesB].filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-danger';
      msg.setAttribute('role', 'alert');
      msg.textContent = `Too large (over 20MB): ${oversized.map((f) => f.name).join(', ')}. Nothing was read - use smaller files.`;
      outEl.appendChild(msg);
      return;
    }

    compareBtn.disabled = true;
    compareBtn.textContent = 'Comparing…';
    try {
      const [{ pairFilesByStem }, { diffCsvFiles }] = await Promise.all([
        import('../pure/compareCsvPro.mjs'),
        import('../pure/csvDiff.mjs'),
      ]);

      const [entriesA, entriesB] = await Promise.all([readFilesAsText(filesA), readFilesAsText(filesB)]);
      const namesA = entriesA.map((e) => e.name);
      const namesB = entriesB.map((e) => e.name);
      const { pairs, unmatchedA, unmatchedB } = pairFilesByStem(namesA, namesB);

      if (pairs.length === 0) {
        outEl.innerHTML = '<div class="alert alert-warn" role="alert">No filenames matched between Batch A and Batch B - name each pair the same (e.g. report.csv in both batches) so they can be paired.</div>';
        return;
      }

      const textByNameA = new Map(entriesA.map((e) => [e.name, e.text]));
      const textByNameB = new Map(entriesB.map((e) => [e.name, e.text]));

      const results = pairs.map(({ stem, nameA, nameB }) => {
        const outcome = diffCsvFiles(textByNameA.get(nameA), textByNameB.get(nameB));
        return { stem, nameA, nameB, outcome };
      });

      const block = document.createElement('div');
      block.className = 'table-block';

      const scrollWrap = document.createElement('div');
      scrollWrap.className = 'table-scroll';
      const table = document.createElement('table');
      table.className = 'extracted-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th scope="col">Pair</th><th scope="col">Changed</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">Unchanged</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      results.forEach(({ nameA, nameB, outcome }) => {
        const tr = document.createElement('tr');
        const pairTd = document.createElement('td');
        pairTd.textContent = `${nameA} → ${nameB}`;
        tr.appendChild(pairTd);
        ['changed', 'added', 'removed', 'unchanged'].forEach((key) => {
          const td = document.createElement('td');
          td.textContent = String(outcome.stats[key]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scrollWrap.appendChild(table);
      block.appendChild(scrollWrap);

      if (unmatchedA.length || unmatchedB.length) {
        const note = document.createElement('div');
        note.className = 'alert alert-warn';
        note.setAttribute('role', 'alert');
        const parts = [];
        if (unmatchedA.length) parts.push(`Batch A: ${unmatchedA.join(', ')}`);
        if (unmatchedB.length) parts.push(`Batch B: ${unmatchedB.join(', ')}`);
        note.textContent = `No match found for: ${parts.join(' · ')}`;
        block.appendChild(note);
      }

      const btnRow = document.createElement('div');
      btnRow.className = 'download-btn-row';
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'btn-primary';
      downloadBtn.textContent = 'Download combined-diff.xlsx';
      downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        try {
          const blob = await buildCombinedWorkbook(results);
          downloadBlob(blob, 'combined-diff.xlsx');
        } finally {
          downloadBtn.disabled = false;
        }
      });
      btnRow.appendChild(downloadBtn);
      block.appendChild(btnRow);

      outEl.appendChild(block);
    } catch {
      outEl.innerHTML = '<div class="alert alert-danger" role="alert">Something went wrong reading or comparing those files - try again.</div>';
    } finally {
      compareBtn.disabled = false;
      compareBtn.textContent = 'Compare batch';
    }
  });
}

const section = document.querySelector('.pro-feature');
if (section) {
  const root = section.querySelector('.pro-feature-body');
  const config = {
    buyUrl: section.dataset.gumroadBuyUrl || GUMROAD_CONFIG.buyUrl || null,
    productPermalink: section.dataset.gumroadProduct || GUMROAD_CONFIG.productPermalink || null,
  };
  if (isUnlocked()) {
    renderUnlockedView(root, config);
  } else {
    renderLockedView(root, config);
  }
}
