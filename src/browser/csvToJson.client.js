// CSV-to-JSON processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="csvToJson") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./sortLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .csv file chosen/dropped
// through the normal drop zone, or CSV text typed into the "paste CSV"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// The parse/shape logic is pure and lives in ../pure/csvToJson.mjs so it
// stays unit-testable without a DOM; this file's job is only to (a) read
// the File's text, (b) render the read-only JSON preview, and (c) build/
// download the .json file. Mirrors ../browser/yamlToJson.client.js's own
// render shape (a JSON preview block, not a table) since the RESULT here
// is JSON either way, regardless of which tool produced it.

const PREVIEW_CHAR_LIMIT = 200000;

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

function jsonBlob(jsonText) {
  return new Blob([jsonText], { type: 'application/json;charset=utf-8' });
}

/**
 * Craft-audit fix (item 8): a working copy-to-clipboard button, same shape
 * as ../browser/jsonMinifyBeautify.client.js's own makeCopyButton (that
 * file's header comment traces this same duplicated-by-convention pattern
 * back to ../browser/urlEncode.client.js) -- this tool's JSON output only
 * ever offered "Download converted.json", unlike its sibling
 * json-minify-beautify a click away, which already has working "Copy
 * minified"/"Copy beautified" buttons for the same kind of text/code
 * result.
 *
 * @param {() => string} getText
 * @param {string} label
 */
function makeCopyButton(getText, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary';
  btn.textContent = label;
  let resetTimer = null;
  btn.addEventListener('click', async () => {
    if (resetTimer) clearTimeout(resetTimer);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no Clipboard API');
      await navigator.clipboard.writeText(getText());
      btn.textContent = 'Copied';
    } catch (err) {
      btn.textContent = 'Couldn’t copy - select the text and copy manually';
    }
    resetTimer = setTimeout(() => { btn.textContent = label; }, 2000);
  });
  return btn;
}

/**
 * @param {HTMLElement} resultEl
 * @param {string} jsonText the full, pretty-printed JSON text.
 * @param {number} recordCount
 */
function renderResult(resultEl, jsonText, recordCount) {
  resultEl.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${recordCount} record${recordCount === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  const truncated = jsonText.length > PREVIEW_CHAR_LIMIT;
  pre.textContent = truncated ? `${jsonText.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : jsonText;
  block.appendChild(pre);

  if (truncated) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = 'Showing the first part of the result. The download includes all of it.';
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download converted.json';
  downloadBtn.addEventListener('click', () => {
    downloadBlob(jsonBlob(jsonText), 'converted.json');
  });
  btnRow.appendChild(downloadBtn);
  // Download stays the one accent-filled (.btn-primary) action per view;
  // Copy is secondary, same convention jsonMinifyBeautify.client.js's own
  // panels already use.
  btnRow.appendChild(makeCopyButton(() => jsonText, 'Copy JSON'));
  block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  block.appendChild(supportNote);

  resultEl.appendChild(block);
  resultEl.hidden = false;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that file on this device…');

  const { parseCsvInput, csvRowsToJsonRecords } = await import('../pure/csvToJson.mjs');

  const text = await file.text();
  const parsed = parseCsvInput(text);

  resultEl.innerHTML = '';

  if (!parsed.ok) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = parsed.error;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus(parsed.error, 'error');
    return;
  }

  const records = csvRowsToJsonRecords(parsed.rows);
  const jsonText = JSON.stringify(records, null, 2);
  renderResult(resultEl, jsonText, records.length);

  setState('done');
  setStatus(`Converted ${records.length} row${records.length === 1 ? '' : 's'} into JSON. Review below, then download.`, 'success');
}
