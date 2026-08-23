// SQL formatter processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="sqlFormatter") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./dedupeLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .sql file chosen/dropped
// through the normal drop zone, or text typed into the "paste SQL" text
// box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// Same dual-panel live-update pattern as ../browser/urlEncode.client.js
// and ../browser/jsonMinifyBeautify.client.js: both the beautified and
// minified versions render at once from the same input, and unlike JSON
// there is no parse step that can fail -- ../pure/sqlFormatter.mjs's
// tokenizer accepts any text (it does not validate the SQL is correct),
// so there is no error path to gate on here beyond the shared empty-input
// check every paste-driven tool has. A dialect select (in addition to
// url-encode-decode's plusForSpace-style single checkbox) re-renders both
// panels live -- it only changes which characters are recognized as a
// quoted-identifier delimiter, stated plainly in this tool's own FAQ copy.

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

function sqlBlob(text) {
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

function previewOf(text) {
  return text.length > PREVIEW_CHAR_LIMIT ? `${text.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : text;
}

/**
 * A working copy-to-clipboard button -- same shape as
 * ../browser/urlEncode.client.js's makeCopyButton.
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
 * actions. Shared by both the beautified and minified panels.
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
  downloadBtn.addEventListener('click', () => downloadBlob(sqlBlob(text), downloadName));
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  return block;
}

/**
 * Renders the dialect select plus both result panels. Re-invoked in place
 * whenever a visitor changes the dialect -- same pattern as
 * ../browser/jsonMinifyBeautify.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string} text raw file/paste text.
 * @param {{dialect: string}} optionState
 * @param {Function} beautifySql from ../pure/sqlFormatter.mjs.
 * @param {Function} minifySql from ../pure/sqlFormatter.mjs.
 * @param {Record<string, {label:string}>} dialects from ../pure/sqlFormatter.mjs's DIALECTS.
 */
function renderResult(resultEl, text, optionState, beautifySql, minifySql, dialects) {
  resultEl.innerHTML = '';

  const optionsRow = document.createElement('div');
  optionsRow.className = 'table-block-head';
  const label = document.createElement('label');
  label.appendChild(document.createTextNode('Dialect (affects identifier quoting only): '));
  const select = document.createElement('select');
  Object.entries(dialects).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    if (key === optionState.dialect) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    optionState.dialect = select.value;
    renderResult(resultEl, text, optionState, beautifySql, minifySql, dialects);
  });
  label.appendChild(select);
  optionsRow.appendChild(label);
  resultEl.appendChild(optionsRow);

  const panelsRow = document.createElement('div');
  panelsRow.className = 'dual-result-row';

  const beautified = beautifySql(text, optionState.dialect);
  panelsRow.appendChild(renderPanel('Beautified', beautified, 'beautified.sql', true));

  const minified = minifySql(text, optionState.dialect);
  panelsRow.appendChild(renderPanel('Minified', minified, 'minified.sql', false));

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
  setStatus('Reading that SQL on this device…');

  const [{ beautify: beautifySql, minify: minifySql, DIALECTS }] = await Promise.all([
    import('../pure/sqlFormatter.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some SQL first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some SQL first.', 'error');
    return;
  }

  const optionState = { dialect: 'ansi' };
  renderResult(resultEl, text, optionState, beautifySql, minifySql, DIALECTS);

  setState('done');
  setStatus('Beautified and minified below. Copy or download whichever one you need.', 'success');
}
