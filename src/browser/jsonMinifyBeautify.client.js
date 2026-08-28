// JSON minify/beautify processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="jsonMinifyBeautify")
// on first file selection/paste-convert click, or warmed on
// pointerenter/focus -- same lazy-load reasoning as ./dedupeLines.client.js.
// This tool has two input paths that both land here as the same File shape:
// a .json file chosen/dropped through the normal drop zone, or text typed
// into the "paste JSON" text box (dropzone.client.js wraps the pasted text
// in a synthetic File before calling this module's run(), so this file
// never needs to know which path a given File came from).
//
// Unlike ../browser/urlEncode.client.js's two independent directions, both
// results here sit behind the SAME parse: minified and beautified are two
// views of one JSON.parse()'d value (../pure/jsonMinifyBeautify.mjs -- pure
// logic, no DOM, unit-testable), so a single parse failure blocks both
// panels at once rather than leaving one to render while the other shows an
// error -- same "parse once, gate everything on it" shape
// ../browser/flattenJson.client.js already uses for its own JSON input.

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

function jsonBlob(text) {
  return new Blob([text], { type: 'application/json;charset=utf-8' });
}

function previewOf(text) {
  return text.length > PREVIEW_CHAR_LIMIT ? `${text.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : text;
}

/**
 * A working copy-to-clipboard button -- same shape as
 * ../browser/urlEncode.client.js's makeCopyButton.
 *
 * @param {() => string} getText
 * @param {string} label
 * @param {boolean} primary whether this renders as the page's one
 *   accent-filled action (exactly one per view, by design).
 */
function makeCopyButton(getText, label, primary) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = primary ? 'btn-primary' : 'btn-secondary';
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
 * One result panel: a labeled, read-only text block plus copy/download
 * actions. Shared by both the minified and beautified panels.
 *
 * @param {string} title
 * @param {string} text
 * @param {string} downloadName
 * @param {boolean} primary whether this panel's copy button is the page's
 *   one accent-filled action.
 */
function renderPanel(title, text, downloadName, primary) {
  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  const charCount = text.length;
  badge.textContent = `${title} - ${charCount.toLocaleString()} character${charCount === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  pre.textContent = previewOf(text);
  block.appendChild(pre);

  if (text.length > PREVIEW_CHAR_LIMIT) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = 'Showing the first part of the result. Copy or download to get all of it.';
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  btnRow.appendChild(makeCopyButton(() => text, `Copy ${title.toLowerCase()}`, primary));
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  downloadBtn.textContent = `Download ${downloadName}`;
  downloadBtn.addEventListener('click', () => downloadBlob(jsonBlob(text), downloadName));
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  return block;
}

/**
 * Renders the indent-choice select plus both result panels. Re-invoked in
 * place whenever a visitor changes the indent option -- same pattern as
 * ../browser/urlEncode.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {*} parsed the JSON.parse()'d value.
 * @param {{indent: string}} optionState
 * @param {Function} minifyJson from ../pure/jsonMinifyBeautify.mjs.
 * @param {Function} beautifyJson from ../pure/jsonMinifyBeautify.mjs.
 */
function renderResult(resultEl, parsed, optionState, minifyJson, beautifyJson) {
  resultEl.innerHTML = '';

  const optionsRow = document.createElement('div');
  optionsRow.className = 'table-block-head';
  const label = document.createElement('label');
  label.appendChild(document.createTextNode('Beautify indent: '));
  const select = document.createElement('select');
  [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (value === optionState.indent) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    optionState.indent = select.value;
    renderResult(resultEl, parsed, optionState, minifyJson, beautifyJson);
  });
  label.appendChild(select);
  optionsRow.appendChild(label);
  resultEl.appendChild(optionsRow);

  const panelsRow = document.createElement('div');
  panelsRow.className = 'dual-result-row';

  const minified = minifyJson(parsed);
  panelsRow.appendChild(renderPanel('Minified', minified, 'minified.json', true));

  const beautified = beautifyJson(parsed, optionState.indent);
  panelsRow.appendChild(renderPanel('Beautified', beautified, 'beautified.json', false));

  resultEl.appendChild(panelsRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that JSON on this device…');

  const [{ parseJsonSafe, minifyJson, beautifyJson }] = await Promise.all([
    import('../pure/jsonMinifyBeautify.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some JSON first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some JSON first.', 'error');
    return;
  }

  const parsed = parseJsonSafe(text);
  if (!parsed.ok) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = parsed.error;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading - that wasn’t valid JSON.', 'error');
    return;
  }

  const optionState = { indent: '2' };
  renderResult(resultEl, parsed.value, optionState, minifyJson, beautifyJson);

  setState('done');
  setStatus('Minified and beautified below. Copy or download whichever one you need.', 'success');
}
