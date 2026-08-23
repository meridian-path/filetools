// Text case converter processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="textCaseConverter")
// on first file selection/paste-convert click, or warmed on
// pointerenter/focus -- same lazy-load reasoning as ./dedupeLines.client.js.
// This tool has two input paths that both land here as the same File shape:
// a .txt file chosen/dropped through the normal drop zone, or text typed
// into the "paste text" text box (dropzone.client.js wraps the pasted text
// in a synthetic File before calling this module's run(), so this file
// never needs to know which path a given File came from).
//
// Unlike every other tool on this site's dual-panel pattern
// (../browser/urlEncode.client.js, ../browser/jsonMinifyBeautify.client.js),
// this one renders ALL SIX cases at once (../pure/textCaseConverter.mjs's
// CASES array) -- the task brief's own "batch conversion of multiple cases
// at once" edge case, so a visitor never has to pick one case, look at it,
// then come back and pick another. Text conversion never fails (there's no
// parse step the way JSON minify/beautify has one), so there's no error
// path to gate on here -- only an empty-input check.

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

function textBlob(text) {
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
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
 *   accent-filled action (design-standards.md: exactly one per view).
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
 * One case's result panel: its label, the converted text, and copy/
 * download actions. Shared by all six cases.
 *
 * @param {{key:string, label:string, fileSuffix:string}} caseDef one entry
 *   from ../pure/textCaseConverter.mjs's CASES.
 * @param {string} text the converted result for this case.
 * @param {boolean} primary whether this panel's copy button is the page's
 *   one accent-filled action (the first case only).
 */
function renderPanel(caseDef, text, primary) {
  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = caseDef.label;
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
  btnRow.appendChild(makeCopyButton(() => text, `Copy ${caseDef.label}`, primary));
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  const filename = `${caseDef.fileSuffix}.txt`;
  downloadBtn.textContent = `Download ${filename}`;
  downloadBtn.addEventListener('click', () => downloadBlob(textBlob(text), filename));
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  return block;
}

/**
 * Renders all six case panels for the given text.
 *
 * @param {HTMLElement} resultEl
 * @param {string} text raw file/paste text.
 * @param {Array} cases from ../pure/textCaseConverter.mjs's CASES.
 */
function renderResult(resultEl, text, cases) {
  resultEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'case-result-grid';
  cases.forEach((caseDef, i) => {
    grid.appendChild(renderPanel(caseDef, caseDef.fn(text), i === 0));
  });
  resultEl.appendChild(grid);

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
  setStatus('Reading that text on this device…');

  const [{ CASES }] = await Promise.all([
    import('../pure/textCaseConverter.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some text first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some text first.', 'error');
    return;
  }

  renderResult(resultEl, text, CASES);

  setState('done');
  setStatus('All six cases below. Copy or download whichever ones you need.', 'success');
}
