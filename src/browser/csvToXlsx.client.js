// CSV-to-XLSX processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="csvToXlsx") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./sortLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .csv file chosen/dropped
// through the normal drop zone, or CSV text typed into the "paste CSV"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// The CSV-parsing/numeric-column-detection logic is pure and lives in
// ../pure/csvToXlsx.mjs so it stays unit-testable without a DOM; this
// file's job is only to (a) read the File's text, (b) render a read-only
// preview table, and (c) build/download the real .xlsx workbook via
// ExcelJS.
//
// ExcelJS loading: see ../browser/xlsxToJson.client.js's own header
// comment for why this is a classic <script> tag wait-for-window.ExcelJS
// pattern rather than plain import() (its published bundle is UMD, not
// ESM) -- duplicated here rather than imported, this directory's own
// established "no browser client file imports another" convention (see
// ../pure/csv.mjs's own header comment on the same shape for pure
// modules).

const PREVIEW_LIMIT = 500;

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
 * Renders the stats badge, the read-only preview table (numeric columns
 * shown right-aligned, matching how they'll render in the real workbook),
 * and the download button.
 *
 * @param {HTMLElement} resultEl
 * @param {string[][]} rows parseCsv()'s output, header row included.
 * @param {boolean[]} numericColumns detectNumericColumns()'s output.
 */
function renderResult(resultEl, rows, numericColumns) {
  resultEl.innerHTML = '';

  const [header, ...dataRows] = rows;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${dataRows.length} row${dataRows.length === 1 ? '' : 's'} - ${header.length} column${header.length === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll';
  const tableEl = document.createElement('table');
  tableEl.className = 'extracted-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  header.forEach((col, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = numericColumns[i] ? `${col} (number)` : col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');
  dataRows.slice(0, PREVIEW_LIMIT).forEach((row) => {
    const tr = document.createElement('tr');
    header.forEach((_, i) => {
      const td = document.createElement('td');
      td.textContent = row[i] == null ? '' : row[i];
      if (numericColumns[i]) td.style.textAlign = 'right';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  scrollWrap.appendChild(tableEl);
  block.appendChild(scrollWrap);

  if (dataRows.length > PREVIEW_LIMIT) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${dataRows.length} rows. The download includes all of them.`;
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download converted.xlsx';
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try {
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      rows.forEach((row, rowIndex) => {
        const isHeaderRow = rowIndex === 0;
        worksheet.addRow(row.map((cell, i) => {
          if (!isHeaderRow && numericColumns[i] && cell !== '') return Number(cell);
          return cell;
        }));
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'converted.xlsx');
    } catch (err) {
      downloadBtn.disabled = false;
      throw err;
    }
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

  const { parseCsvInput, detectNumericColumns } = await import('../pure/csvToXlsx.mjs');

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

  const numericColumns = detectNumericColumns(parsed.rows);
  renderResult(resultEl, parsed.rows, numericColumns);

  setState('done');
  setStatus(`Converted ${parsed.rows.length - 1} row${parsed.rows.length - 1 === 1 ? '' : 's'}. Review below, then download.`, 'success');
}
