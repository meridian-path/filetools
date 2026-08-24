// CSV to SQL INSERT processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="csvToSqlInsert")
// on first file selection/paste-convert click, or warmed on
// pointerenter/focus -- same lazy-load reasoning as ./dedupeLines.client.js.
// This tool has two input paths that both land here as the same File
// shape: a .csv file chosen/dropped through the normal drop zone, or text
// typed into the "paste CSV" text box (dropzone.client.js wraps the
// pasted text in a synthetic File before calling this module's run(), so
// this file never needs to know which path a given File came from).
//
// Unlike the dual-panel tools (url-encode-decode, json-minify-beautify,
// sql-formatter), there is only ONE output here (the generated SQL), but
// THREE live-editable options instead of one or two: a table-name text
// input, a dialect select, and a "one statement per row" checkbox -- all
// three re-render the single result panel in place, the same "re-invoke
// render in place" pattern those other tools already use for their own
// option controls.

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

function makeCopyButton(getText, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-primary';
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
 * Renders the three option controls plus the single SQL result panel (or
 * a friendly inline error if the parsed CSV has no real data). Re-invoked
 * in place whenever a visitor changes any option -- same pattern as
 * ../browser/jsonMinifyBeautify.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string[][]} rows parseCsv()'s output.
 * @param {{tableName:string, dialect:string, oneStatementPerRow:boolean}} optionState
 * @param {Function} generateInsertStatements from ../pure/csvToSqlInsert.mjs.
 * @param {Record<string, {label:string}>} dialects from ../pure/csvToSqlInsert.mjs's DIALECTS.
 */
function renderResult(resultEl, rows, optionState, generateInsertStatements, dialects) {
  resultEl.innerHTML = '';

  const optionsRow = document.createElement('div');
  optionsRow.className = 'table-block-head';

  const nameLabel = document.createElement('label');
  nameLabel.appendChild(document.createTextNode('Table name: '));
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = optionState.tableName;
  nameInput.addEventListener('input', () => {
    optionState.tableName = nameInput.value;
    renderResult(resultEl, rows, optionState, generateInsertStatements, dialects);
  });
  nameLabel.appendChild(nameInput);
  optionsRow.appendChild(nameLabel);

  const dialectLabel = document.createElement('label');
  dialectLabel.appendChild(document.createTextNode('Dialect: '));
  const dialectSelect = document.createElement('select');
  Object.entries(dialects).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    if (key === optionState.dialect) opt.selected = true;
    dialectSelect.appendChild(opt);
  });
  dialectSelect.addEventListener('change', () => {
    optionState.dialect = dialectSelect.value;
    renderResult(resultEl, rows, optionState, generateInsertStatements, dialects);
  });
  dialectLabel.appendChild(dialectSelect);
  optionsRow.appendChild(dialectLabel);

  const perRowLabel = document.createElement('label');
  const perRowCheckbox = document.createElement('input');
  perRowCheckbox.type = 'checkbox';
  perRowCheckbox.checked = optionState.oneStatementPerRow;
  perRowCheckbox.addEventListener('change', () => {
    optionState.oneStatementPerRow = perRowCheckbox.checked;
    renderResult(resultEl, rows, optionState, generateInsertStatements, dialects);
  });
  perRowLabel.appendChild(perRowCheckbox);
  perRowLabel.appendChild(document.createTextNode(' One INSERT statement per row (instead of one batched statement)'));
  optionsRow.appendChild(perRowLabel);

  resultEl.appendChild(optionsRow);

  const outcome = generateInsertStatements(rows, {
    tableName: optionState.tableName,
    dialect: optionState.dialect,
    oneStatementPerRow: optionState.oneStatementPerRow,
  });

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
  badge.textContent = `${outcome.rowCount} row${outcome.rowCount === 1 ? '' : 's'} - ${outcome.columns.length} column${outcome.columns.length === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  pre.textContent = previewOf(outcome.sql);
  block.appendChild(pre);

  if (outcome.sql.length > PREVIEW_CHAR_LIMIT) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = 'Showing the first part of the result. Copy or download to get all of it.';
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  btnRow.appendChild(makeCopyButton(() => outcome.sql, 'Copy SQL'));
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  downloadBtn.textContent = 'Download insert.sql';
  downloadBtn.addEventListener('click', () => downloadBlob(sqlBlob(outcome.sql), 'insert.sql'));
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
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that CSV on this device…');

  const [{ parseCsv, generateInsertStatements, DIALECTS }] = await Promise.all([
    import('../pure/csvToSqlInsert.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some CSV first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some CSV first.', 'error');
    return;
  }

  const rows = parseCsv(text);
  const isPaste = file.name === 'pasted-input.csv';
  const defaultTableName = isPaste ? 'my_table' : file.name.replace(/\.csv$/i, '');
  const optionState = { tableName: defaultTableName, dialect: 'mysql', oneStatementPerRow: false };
  renderResult(resultEl, rows, optionState, generateInsertStatements, DIALECTS);

  const preview = generateInsertStatements(rows, optionState);
  setState('done');
  setStatus(
    preview.ok
      ? `Converted ${preview.rowCount} row${preview.rowCount === 1 ? '' : 's'} below. Copy or download the SQL.`
      : `Finished reading - ${preview.error}`,
    preview.ok ? 'success' : 'error'
  );
}
