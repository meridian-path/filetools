// PDF-to-JPG/PNG processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="pdfToImages") on first file selection,
// or warmed on pointerenter/focus -- same lazy-load reasoning as
// ./pdfPages.client.js, whose renderThumbnails() shape this file's own
// page-canvas rendering closely follows (adapted for a higher export
// resolution rather than a fixed small thumbnail width).
//
// pdf.js (Apache-2.0) is self-hosted from this same origin (vendor/,
// copied from node_modules at build time by scripts/copy-vendor.js) --
// never a CDN, so "turn off your Wi-Fi and this page still works" stays
// true. Zip packaging uses fflate (MIT), same self-hosted origin, only
// imported once the visitor actually clicks convert -- same "every page
// in one zip, not N separate downloads a browser would start blocking as
// spam past a handful" reasoning ./splitCsv.client.js's own header comment
// documents, and the same synchronous zipSync (no Worker/dynamic-code
// path needed).

import { reportBatchProgress } from './batchProgress.js';

const PdfJsPromise = import('../vendor/pdfjs-dist/pdf.min.mjs').then((pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs-dist/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
});

// 2x a PDF's own default point size (~72 DPI) -> ~144 DPI, sharp enough
// for on-screen use and most printing without producing unreasonably
// large export files.
const EXPORT_SCALE = 2;
const THUMBNAIL_WIDTH = 160;

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

function appendSupportNote(resultEl) {
  const note = document.createElement('p');
  note.className = 'support-note';
  note.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(note);
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {number} targetWidth render at whatever scale makes the page this
 *   wide, keeping aspect ratio (matches pdfPages.client.js's own
 *   renderThumbnails() approach) -- used for the small on-page preview.
 */
async function renderToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {'image/jpeg'|'image/png'} mimeType
 * @returns {Promise<Uint8Array>}
 */
function canvasToBytes(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Could not render that page as an image.')); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, mimeType, 0.92);
  });
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that PDF on this device…');

  const pdfjs = await PdfJsPromise;
  const bytes = await file.arrayBuffer();
  let pdfDoc;
  try {
    pdfDoc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  } catch (err) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid PDF.`, 'error');
    return;
  }

  resultEl.innerHTML = '';

  const formatRow = document.createElement('div');
  formatRow.innerHTML = `
    <div>
      <label><input type="radio" name="image-format" value="image/jpeg" checked> JPG</label><br>
      <label><input type="radio" name="image-format" value="image/png"> PNG</label>
    </div>`;
  resultEl.appendChild(formatRow);

  const grid = document.createElement('div');
  grid.className = 'page-grid';
  resultEl.appendChild(grid);

  const pageCount = pdfDoc.numPages;
  for (let i = 1; i <= pageCount; i += 1) {
    // A real timing check (150 pages) measured this thumbnail loop past 1s
    // (~2.6s total for both loops combined) -- per-page reporting here is
    // this pass's real target for that case, not decorative. See
    // src/browser/batchProgress.js.
    if (pageCount > 1) reportBatchProgress(ctx, 'Rendering', i, pageCount, 'page');
    // eslint-disable-next-line no-await-in-loop -- pages render in order,
    // same reasoning as pdfPages.client.js's own renderThumbnails().
    const page = await pdfDoc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const thumbScale = THUMBNAIL_WIDTH / baseViewport.width;
    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderToCanvas(page, thumbScale);
    const card = document.createElement('div');
    card.className = 'page-card';
    card.appendChild(canvas);
    const num = document.createElement('span');
    num.className = 'page-num';
    num.textContent = `Page ${i}`;
    card.appendChild(num);
    grid.appendChild(card);
  }

  const convertBtn = document.createElement('button');
  convertBtn.type = 'button';
  convertBtn.className = 'btn-primary';
  convertBtn.style.marginTop = 'var(--space-4)';
  convertBtn.textContent = 'Convert to images';
  convertBtn.addEventListener('click', async () => {
    const mimeType = formatRow.querySelector('input[name="image-format"]:checked').value;
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    setState('working');
    setStatus(`Rendering ${pageCount} page${pageCount === 1 ? '' : 's'} on this device…`);
    try {
      const baseName = file.name.replace(/\.pdf$/i, '');
      const padWidth = String(pageCount).length;
      const entries = {};
      for (let i = 1; i <= pageCount; i += 1) {
        if (pageCount > 1) reportBatchProgress(ctx, 'Rendering', i, pageCount, 'page');
        // eslint-disable-next-line no-await-in-loop -- sequential so the
        // status line's own page count stays meaningful, and so a very
        // large document doesn't try to hold every full-resolution canvas
        // in memory at once.
        const page = await pdfDoc.getPage(i);
        // eslint-disable-next-line no-await-in-loop
        const canvas = await renderToCanvas(page, EXPORT_SCALE);
        // eslint-disable-next-line no-await-in-loop
        const pageBytes = await canvasToBytes(canvas, mimeType);
        const pageNum = String(i).padStart(padWidth, '0');
        entries[`${baseName}-page-${pageNum}.${ext}`] = pageBytes;
      }
      const { zipSync } = await import('../vendor/fflate/browser.js');
      const zipName = `${baseName}-images.zip`;
      downloadBlob(new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }), zipName);
      setState('done');
      setStatus(`Saved ${zipName} - ${pageCount} image${pageCount === 1 ? '' : 's'} inside.`, 'success');
      appendSupportNote(resultEl);
    } catch (err) {
      setState('error');
      setStatus(err && err.message ? err.message : 'Could not convert that PDF.', 'error');
    }
  });
  resultEl.appendChild(convertBtn);
  resultEl.hidden = false;
  setState('idle');
  setStatus(`${pageCount} page${pageCount === 1 ? '' : 's'} ready. Pick a format, then convert.`);
}
