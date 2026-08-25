// JSON-to-YAML processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="jsonToYaml") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./sortLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .json file chosen/dropped
// through the normal drop zone, or JSON text typed into the "paste JSON"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// js-yaml (MIT, self-hosted from this same origin -- vendor/, copied from
// node_modules at build time by scripts/copy-vendor.js, never a CDN) does
// the actual YAML serialization via its dump(). See
// ../browser/yamlToJson.client.js's own header comment for this same
// library's hot-dependency scrutiny (pinned exact version, DEFAULT_SCHEMA
// only, no dynamic-code tag support) -- dump() carries none of that
// direction's own untrusted-input-parsing risk anyway, since it only ever
// serializes an already-parsed JS value (from JSON.parse, itself safe)
// back out as text.
//
// The JSON-parsing/friendly-error logic is pure and lives in
// ../pure/jsonToYaml.mjs so it stays unit-testable without a DOM; this
// file's job is only to (a) read the File's text, (b) call js-yaml's
// dump(), (c) render the read-only YAML preview, and (d) build/download
// the .yaml file.

const yamlModulePromise = import('../vendor/js-yaml/js-yaml.mjs');

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

function yamlBlob(yamlText) {
  return new Blob([yamlText], { type: 'application/yaml;charset=utf-8' });
}

/**
 * @param {HTMLElement} resultEl
 * @param {string} yamlText the full YAML text.
 */
function renderResult(resultEl, yamlText) {
  resultEl.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  const lineCount = yamlText.split('\n').length;
  badge.textContent = `${lineCount} line${lineCount === 1 ? '' : 's'} of YAML`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  const truncated = yamlText.length > PREVIEW_CHAR_LIMIT;
  pre.textContent = truncated ? `${yamlText.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : yamlText;
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
  downloadBtn.textContent = 'Download converted.yaml';
  downloadBtn.addEventListener('click', () => {
    downloadBlob(yamlBlob(yamlText), 'converted.yaml');
  });
  btnRow.appendChild(downloadBtn);
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

  const [yaml, { parseJsonInput }] = await Promise.all([
    yamlModulePromise,
    import('../pure/jsonToYaml.mjs'),
  ]);

  const text = await file.text();
  const parsed = parseJsonInput(text);

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

  const yamlText = yaml.dump(parsed.value);
  renderResult(resultEl, yamlText);

  setState('done');
  setStatus('Converted. Review below, then download.', 'success');
}
