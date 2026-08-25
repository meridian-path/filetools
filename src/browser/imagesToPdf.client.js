// JPG/PNG-to-PDF processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="imagesToPdf") on first file selection, or
// warmed on pointerenter/focus -- same lazy-load reasoning as
// ./pdfPages.client.js, which this file's reorder-then-convert UI mirrors
// closely (same file-list/up/down/remove shape as its own runMerge()) for
// one real reason: combining several source files into one PDF is the same
// operation either way, just with image sources instead of PDF sources.
//
// pdf-lib (MIT) is self-hosted from this same origin (vendor/, copied from
// node_modules at build time by scripts/copy-vendor.js) -- never a CDN, so
// "turn off your Wi-Fi and this page still works" stays true.

const PDFLibPromise = import('../vendor/pdf-lib/pdf-lib.esm.min.js');

// A PDF point is defined at 72 per inch. Treating 1 image pixel as 1 point
// (i.e. IMAGE_DPI 72) means a modern phone/camera photo -- routinely
// 3000-4000px on a side -- becomes a physically oversized page (a 4032x3024
// photo would be ~56x42in). 144 is the same reverse-direction precedent
// ./pdfToImages.client.js's own EXPORT_SCALE already uses for PDF page ->
// image rendering, applied here the other way (image pixels -> PDF points)
// so a page printed at actual size looks right on typical print/screen
// output instead of building a page the size of a banner.
const IMAGE_DPI = 144;
const POINTS_PER_PIXEL = 72 / IMAGE_DPI;

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {File} file
 * @returns {boolean} true for a PNG, by MIME type first (what a real
 *   browser file picker/drop reliably sets) and the file extension as a
 *   fallback (a synthetic File from some other source, e.g. a test, might
 *   not carry a MIME type at all) -- anything not PNG is treated as JPEG,
 *   since `accepts` on this tool's own registration already restricts the
 *   dropzone to just these two formats.
 */
function isPng(file) {
  if (file.type === 'image/png') return true;
  if (file.type === 'image/jpeg') return false;
  return /\.png$/i.test(file.name);
}

/**
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {File} file
 * @returns {Promise<import('pdf-lib').PDFImage>} throws a visitor-facing
 *   Error naming the specific file for a corrupt/mislabeled image.
 */
async function embedImage(doc, file, PDFLib) {
  const bytes = await file.arrayBuffer();
  try {
    return isPng(file) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (err) {
    throw new Error(`"${file.name}" doesn’t look like a valid ${isPng(file) ? 'PNG' : 'JPG'}.`);
  }
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
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;

  const [PDFLib] = await Promise.all([PDFLibPromise]);

  // Render the reorder UI immediately; the actual PDF is only built once
  // the visitor presses "Convert to PDF" below, so reordering never
  // re-reads any file.
  let order = files.map((f, i) => i);

  function renderList() {
    resultEl.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'file-list';
    order.forEach((fileIndex, position) => {
      const file = files[fileIndex];
      const li = document.createElement('li');
      li.className = 'file-row';
      li.innerHTML = `
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-meta">${humanSize(file.size)}</span>
        <span class="file-actions">
          <button type="button" class="btn-icon" data-action="up" aria-label="Move ${escapeHtml(file.name)} up">&uarr;</button>
          <button type="button" class="btn-icon" data-action="down" aria-label="Move ${escapeHtml(file.name)} down">&darr;</button>
          <button type="button" class="btn-icon" data-action="remove" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
        </span>`;
      li.querySelector('[data-action="up"]').disabled = position === 0;
      li.querySelector('[data-action="down"]').disabled = position === order.length - 1;
      li.querySelector('[data-action="up"]').addEventListener('click', () => {
        if (position > 0) {
          [order[position - 1], order[position]] = [order[position], order[position - 1]];
          renderList();
        }
      });
      li.querySelector('[data-action="down"]').addEventListener('click', () => {
        if (position < order.length - 1) {
          [order[position + 1], order[position]] = [order[position], order[position + 1]];
          renderList();
        }
      });
      li.querySelector('[data-action="remove"]').addEventListener('click', () => {
        order = order.filter((idx) => idx !== fileIndex);
        renderList();
      });
      list.appendChild(li);
    });
    resultEl.appendChild(list);

    const convertBtn = document.createElement('button');
    convertBtn.type = 'button';
    convertBtn.className = 'btn-primary';
    convertBtn.textContent = 'Convert to PDF';
    convertBtn.disabled = order.length < 1;
    convertBtn.addEventListener('click', async () => {
      setState('working');
      setStatus('Converting on this device…');
      try {
        const doc = await PDFLib.PDFDocument.create();
        for (const idx of order) {
          const file = files[idx];
          const image = await embedImage(doc, file, PDFLib);
          const pageWidth = image.width * POINTS_PER_PIXEL;
          const pageHeight = image.height * POINTS_PER_PIXEL;
          const page = doc.addPage([pageWidth, pageHeight]);
          page.drawImage(image, {
            x: 0, y: 0, width: pageWidth, height: pageHeight,
          });
        }
        const bytes = await doc.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'converted.pdf');
        setState('done');
        setStatus(`Converted ${order.length} image${order.length === 1 ? '' : 's'} into one PDF. Your download has started.`, 'success');
        appendSupportNote(resultEl);
      } catch (err) {
        setState('error');
        setStatus(err.message || 'Could not convert those images.', 'error');
      }
    });
    resultEl.appendChild(convertBtn);
    resultEl.hidden = false;
  }

  renderList();
  setState('idle');
  setStatus(`${files.length} image${files.length === 1 ? '' : 's'} ready. Reorder them, then convert.`);
}
