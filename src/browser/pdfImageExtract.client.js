// Extract-images-from-PDF processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="pdfImageExtract")
// on first file selection, or warmed on pointerenter/focus -- same
// lazy-load reasoning as ./pdfPages.client.js.
//
// pdf.js (Apache-2.0) is self-hosted from this same origin (vendor/,
// copied from node_modules at build time by scripts/copy-vendor.js) --
// never a CDN, so "turn off your Wi-Fi and this page still works" stays
// true. Zip packaging uses fflate (MIT), same self-hosted origin, same
// synchronous zipSync pattern ./pdfToImages.client.js and
// ./splitCsv.client.js already establish for "every output in one zip,
// not N separate downloads a browser would start blocking as spam".
//
// EXTRACTION APPROACH (verified against a real pdf-lib-built PDF with a
// real embedded JPEG before writing this file, not assumed from docs):
// pdf.js's public API has no "give me this embedded image's original
// compressed bytes" call -- getOperatorList() finds each embedded image
// XObject by name (the paintImageXObject op), but the actual decoded
// pixels only become available on page.objs AFTER that page has been
// rendered at least once (rendering is what triggers pdf.js's own image
// decode). Each resolved image object exposes either a `.bitmap`
// (ImageBitmap, the common case in a modern Chromium) or raw `.data`
// pixels (an older/CPU-decode fallback) -- both are handled here by
// drawing onto a same-size offscreen canvas and re-encoding via
// canvas.toBlob('image/png'), which is also why the output is always
// PNG regardless of the source's own original format (see this tool's
// own FAQ for why that's the honest, lossless choice rather than a
// silent one).
//
// SCOPE CUT (disclosed on the page's own FAQ, not silent): only
// OPS.paintImageXObject is extracted -- repeated/tiled image patterns
// (paintImageXObjectRepeat) and inline images drawn directly in the
// content stream (paintInlineImageXObject/Group) are not. That covers
// the common real-world case (a photo/scan/logo placed on a page)
// without the added complexity of the rarer repeat/inline shapes.

const PdfJsPromise = import('../vendor/pdfjs-dist/pdf.min.mjs').then((pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs-dist/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
});

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
 * @param {import('pdfjs-dist').PDFPageProxy} pdfPage
 * @param {string} id
 * @returns {*} the resolved image object, or null if not yet resolved
 *   anywhere. An image XObject referenced from more than one page (the
 *   same embedded photo/logo reused across pages) resolves onto pdf.js's
 *   own shared commonObjs, not this page's own per-page objs -- pg.objs
 *   alone throws "Requesting object that isn't resolved yet" for such an
 *   id (verified directly against a real 2-page PDF sharing one embedded
 *   image before writing this), so both caches are checked with `.has()`
 *   first rather than assuming which one a given id lives on.
 */
function resolveImageObj(pdfPage, id) {
  if (pdfPage.objs.has(id)) return pdfPage.objs.get(id);
  if (pdfPage.commonObjs.has(id)) return pdfPage.commonObjs.get(id);
  return null;
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
 * @param {import('pdfjs-dist').PDFPageProxy} pdfPage
 * @param {*} pdfjs the loaded pdf.js module (for OPS).
 * @returns {Promise<{id:string, width:number, height:number}[]>} every
 *   paintImageXObject image on this one page, in document order. Also
 *   renders the page once (required so pdf.js actually decodes each
 *   image onto pdfPage.objs -- see this file's own header comment).
 */
async function findPageImages(pdfPage, pdfjs) {
  const opList = await pdfPage.getOperatorList();
  const ids = [];
  for (let i = 0; i < opList.fnArray.length; i += 1) {
    if (opList.fnArray[i] === pdfjs.OPS.paintImageXObject) {
      ids.push(opList.argsArray[i][0]);
    }
  }
  if (ids.length === 0) return [];

  const viewport = pdfPage.getViewport({ scale: 1 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;

  return ids
    .map((id) => {
      const obj = resolveImageObj(pdfPage, id);
      return obj ? { id, width: obj.width, height: obj.height } : null;
    })
    .filter(Boolean);
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} pdfPage
 * @param {string} imageId
 * @returns {Promise<Uint8Array>} PNG bytes of the decoded image.
 */
async function imageToPngBytes(pdfPage, imageId) {
  const obj = resolveImageObj(pdfPage, imageId);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = obj.width;
  outCanvas.height = obj.height;
  const octx = outCanvas.getContext('2d');
  if (obj.bitmap) {
    octx.drawImage(obj.bitmap, 0, 0);
  } else {
    const imageData = octx.createImageData(obj.width, obj.height);
    imageData.data.set(obj.data);
    octx.putImageData(imageData, 0, 0);
  }
  const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Scanning that PDF on this device…');

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

  const pageCount = pdfDoc.numPages;
  const baseName = file.name.replace(/\.pdf$/i, '');
  const padWidth = String(pageCount).length;
  const entries = {};
  let imageCount = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    setStatus(`Scanning page ${pageNum} of ${pageCount}…`);
    // eslint-disable-next-line no-await-in-loop -- sequential so the
    // status line's own page count stays meaningful, and so a very large
    // document doesn't try to decode every page's images at once.
    const pdfPage = await pdfDoc.getPage(pageNum);
    // eslint-disable-next-line no-await-in-loop
    const images = await findPageImages(pdfPage, pdfjs);
    const pagePad = String(pageNum).padStart(padWidth, '0');
    for (let i = 0; i < images.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const pngBytes = await imageToPngBytes(pdfPage, images[i].id);
      const imageNum = String(i + 1).padStart(2, '0');
      entries[`${baseName}-page-${pagePad}-image-${imageNum}.png`] = pngBytes;
      imageCount += 1;
    }
  }

  resultEl.innerHTML = '';

  if (imageCount === 0) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'No embedded images were found in that PDF.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('No embedded images were found in that PDF.');
    return;
  }

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${imageCount} image${imageCount === 1 ? '' : 's'} found`;
  head.appendChild(badge);
  block.appendChild(head);

  const list = document.createElement('ul');
  list.className = 'file-list';
  Object.keys(entries).forEach((name) => {
    const li = document.createElement('li');
    li.className = 'file-row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = name;
    li.appendChild(nameSpan);
    list.appendChild(li);
  });
  block.appendChild(list);

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  const zipName = `${baseName}-images.zip`;
  downloadBtn.textContent = `Download ${zipName}`;
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try {
      const { zipSync } = await import('../vendor/fflate/browser.js');
      downloadBlob(new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }), zipName);
    } catch (err) {
      downloadBtn.disabled = false;
      throw err;
    }
  });
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  appendSupportNote(block);
  resultEl.appendChild(block);
  resultEl.hidden = false;

  setState('done');
  setStatus(`Found ${imageCount} image${imageCount === 1 ? '' : 's'} across ${pageCount} page${pageCount === 1 ? '' : 's'}.`, 'success');
}
