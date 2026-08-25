// UUID/GUID generator page controller. Unlike every other tool client
// file, this is NOT dynamically imported by ./dropzone.client.js's
// PROCESSORS map -- there is no file or pasted text to convert, only
// options to pick, so src/pages/toolPage.js loads this file directly as
// the page's <script type="module"> for a tool with `customPanelMode: true`
// (see that flag's comment in src/tools/uuid-generator.js and the
// isCustomPanel branch in src/pages/toolPage.js). It builds its own control
// row and result panel entirely client-side and generates a first batch
// immediately on load, reusing the same .table-block/.table-block-head/
// .json-preview/.download-btn-row classes every other tool's result panel
// already uses (see ./csvToSqlInsert.client.js's renderResult for the
// closest sibling of this pattern).

import { generateBatch, NAMESPACES } from '../pure/uuidGenerator.mjs';

const MAX_COUNT = 1000;

const NAMESPACE_OPTIONS = [
  { value: NAMESPACES.dns, label: 'DNS' },
  { value: NAMESPACES.url, label: 'URL' },
  { value: NAMESPACES.oid, label: 'OID' },
  { value: NAMESPACES.x500, label: 'X.500' },
  { value: 'custom', label: 'Custom namespace UUID' },
];

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

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

// Bumped on every render() call so an in-flight generateBatch() promise
// from a superseded render (e.g. the visitor changed the version select
// again before the previous v5 hash finished) never overwrites what a
// later call already put on screen -- same generation-counter guard
// ./dropzone.client.js's own handleFileList uses.
let renderGeneration = 0;

/**
 * @param {HTMLElement} resultEl
 * @param {{version:string, count:number, namespaceChoice:string, customNamespace:string, name:string}} state
 * @param {{focusField?: 'customNamespace'|'name', caret?: number}} [restoreFocus] - render()
 *   rebuilds the entire subtree on every call, including whichever <input> the visitor is
 *   actively typing into - passing the field that triggered this render lets it re-focus +
 *   re-position the caret on the freshly created replacement node right after building it,
 *   so a keystroke never gets dropped.
 */
function render(resultEl, state, restoreFocus) {
  const myGeneration = ++renderGeneration;
  resultEl.innerHTML = '';

  const optionsRow = document.createElement('div');
  optionsRow.className = 'table-block-head';

  const versionLabel = document.createElement('label');
  versionLabel.appendChild(document.createTextNode('Version: '));
  const versionSelect = document.createElement('select');
  [
    ['v4', 'v4 - random'],
    ['v7', 'v7 - time-ordered (recommended for new IDs)'],
    ['v1', 'v1 - time-based'],
    ['v5', 'v5 - name-based (SHA-1)'],
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === state.version) opt.selected = true;
    versionSelect.appendChild(opt);
  });
  versionSelect.addEventListener('change', () => {
    state.version = versionSelect.value;
    render(resultEl, state);
  });
  versionLabel.appendChild(versionSelect);
  optionsRow.appendChild(versionLabel);

  const countLabel = document.createElement('label');
  countLabel.appendChild(document.createTextNode('Count: '));
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = String(MAX_COUNT);
  countInput.step = '1';
  countInput.value = String(state.count);
  countInput.setAttribute('aria-label', 'How many UUIDs to generate');
  countInput.addEventListener('change', () => {
    let next = Math.floor(Number(countInput.value));
    if (!Number.isFinite(next) || next < 1) next = 1;
    if (next > MAX_COUNT) next = MAX_COUNT;
    state.count = next;
    render(resultEl, state);
  });
  countLabel.appendChild(countInput);
  optionsRow.appendChild(countLabel);

  resultEl.appendChild(optionsRow);

  if (state.version === 'v5') {
    const v5Row = document.createElement('div');
    v5Row.className = 'table-block-head';

    const nsLabel = document.createElement('label');
    nsLabel.appendChild(document.createTextNode('Namespace: '));
    const nsSelect = document.createElement('select');
    NAMESPACE_OPTIONS.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === state.namespaceChoice) opt.selected = true;
      nsSelect.appendChild(opt);
    });
    nsSelect.addEventListener('change', () => {
      state.namespaceChoice = nsSelect.value;
      render(resultEl, state);
    });
    nsLabel.appendChild(nsSelect);
    v5Row.appendChild(nsLabel);

    let customInput = null;
    if (state.namespaceChoice === 'custom') {
      const customLabel = document.createElement('label');
      customLabel.appendChild(document.createTextNode('Custom namespace: '));
      customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.placeholder = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      customInput.value = state.customNamespace;
      customInput.addEventListener('input', () => {
        state.customNamespace = customInput.value;
        render(resultEl, state, { focusField: 'customNamespace', caret: customInput.selectionStart });
      });
      customLabel.appendChild(customInput);
      v5Row.appendChild(customLabel);
    }

    const nameLabel = document.createElement('label');
    nameLabel.appendChild(document.createTextNode('Name: '));
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'example.com';
    nameInput.value = state.name;
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value;
      render(resultEl, state, { focusField: 'name', caret: nameInput.selectionStart });
    });
    nameLabel.appendChild(nameInput);
    v5Row.appendChild(nameLabel);

    resultEl.appendChild(v5Row);

    // Must run after v5Row is attached to resultEl (which is already in the
    // live document) - an element cannot receive focus while it's still
    // sitting in a detached DOM subtree.
    if (restoreFocus && restoreFocus.focusField === 'customNamespace' && customInput) {
      customInput.focus();
      customInput.setSelectionRange(restoreFocus.caret, restoreFocus.caret);
    } else if (restoreFocus && restoreFocus.focusField === 'name') {
      nameInput.focus();
      nameInput.setSelectionRange(restoreFocus.caret, restoreFocus.caret);
    }
  }

  const namespace = state.namespaceChoice === 'custom' ? state.customNamespace : state.namespaceChoice;

  generateBatch({ version: state.version, count: state.count, namespace, name: state.name }).then((outcome) => {
    if (myGeneration !== renderGeneration) return;

    if (!outcome.ok) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-warn';
      msg.setAttribute('role', 'alert');
      msg.textContent = outcome.error;
      resultEl.appendChild(msg);
      resultEl.hidden = false;
      return;
    }

    const block = document.createElement('div');
    block.className = 'table-block';

    const head = document.createElement('div');
    head.className = 'table-block-head';
    const badge = document.createElement('span');
    badge.className = 'page-badge';
    badge.textContent = `${outcome.uuids.length} UUID${outcome.uuids.length === 1 ? '' : 's'}`;
    head.appendChild(badge);
    block.appendChild(head);

    const pre = document.createElement('pre');
    pre.className = 'json-preview';
    pre.textContent = outcome.uuids.join('\n');
    block.appendChild(pre);

    const btnRow = document.createElement('div');
    btnRow.className = 'download-btn-row';
    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'btn-primary';
    regenBtn.textContent = 'Generate new';
    regenBtn.addEventListener('click', () => render(resultEl, state));
    btnRow.appendChild(regenBtn);
    btnRow.appendChild(makeCopyButton(() => outcome.uuids.join('\n'), 'Copy all'));
    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-secondary';
    downloadBtn.textContent = 'Download uuids.txt';
    downloadBtn.addEventListener('click', () => downloadBlob(new Blob([outcome.uuids.join('\n')], { type: 'text/plain;charset=utf-8' }), 'uuids.txt'));
    btnRow.appendChild(downloadBtn);
    block.appendChild(btnRow);

    resultEl.appendChild(block);

    const supportNote = document.createElement('p');
    supportNote.className = 'support-note';
    supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
      + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
      + ' &middot; '
      + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
    resultEl.appendChild(supportNote);

    resultEl.hidden = false;
  });
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  const state = {
    version: 'v4',
    count: 5,
    namespaceChoice: NAMESPACES.dns,
    customNamespace: '',
    name: '',
  };
  render(resultEl, state);
}
