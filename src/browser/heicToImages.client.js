// HEIC/HEIF-to-JPG/PNG processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="heicToImages") on
// first file selection, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./pdfPages.client.js.
//
// heic2any (MIT, self-hosted from this same origin -- vendor/, copied from
// node_modules at build time by scripts/copy-vendor.js, never a CDN) does
// the actual HEIC decode. Its own published bundle is a UMD build, not an
// ES module -- it has no `export` statement for import() to bind, only the
// side effect of setting `window.heic2any` once it runs. Same reasoning as
// ./xlsxToJson.client.js's own header comment on exceljs: this file loads
// it as a classic <script> tag and waits for that to finish before
// touching the resulting global, rather than import()-ing a non-ESM file
// for its side effect alone. The actual libheif WASM decode runs inside a
// Worker heic2any itself spins up from an embedded Blob URL -- no separate
// .wasm file, no CDN fetch, so "turn off your Wi-Fi and this page still
// works" holds here too.
//
// Known, disclosed limitation (heic2any's own): a multi-image HEIC
// container (a burst shot, or the motion half of a Live Photo) only
// produces its first frame -- see this tool's own FAQ.

import { reportBatchProgress } from './batchProgress.js';

let heic2anyPromise = null;
function loadHeic2Any() {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  if (!heic2anyPromise) {
    heic2anyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/heic2any/heic2any.min.js', import.meta.url).href;
      script.onload = () => {
        if (window.heic2any) resolve(window.heic2any);
        else reject(new Error('The photo converter loaded but didn’t initialize correctly.'));
      };
      script.onerror = () => reject(new Error('The tool’s code hasn’t finished downloading yet - reconnect for a moment, then try again.'));
      document.head.appendChild(script);
    }).catch((err) => {
      heic2anyPromise = null;
      throw err;
    });
  }
  return heic2anyPromise;
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
 * @param {File} file
 * @param {'image/jpeg'|'image/png'} mimeType
 * @param {*} heic2any the loaded window.heic2any function
 * @returns {Promise<Uint8Array>} throws a visitor-facing Error naming the
 *   specific file for one that isn't a real/decodable HEIC.
 */
async function convertOne(file, mimeType, heic2any) {
  let result;
  try {
    result = await heic2any({ blob: file, toType: mimeType, quality: 0.92 });
  } catch (err) {
    throw new Error(`"${file.name}" doesn’t look like a valid HEIC/HEIF photo.`);
  }
  // heic2any resolves an array only when called with `multiple: true`
  // (extracting every frame of a burst/animation), which this tool doesn't
  // request -- kept as a defensive fallback (take the first frame) rather
  // than an assumption, since real-world HEIC containers vary.
  const blob = Array.isArray(result) ? result[0] : result;
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;

  resultEl.innerHTML = '';

  const formatRow = document.createElement('div');
  formatRow.innerHTML = `
    <div>
      <label><input type="radio" name="image-format" value="image/jpeg" checked> JPG</label><br>
      <label><input type="radio" name="image-format" value="image/png"> PNG</label>
    </div>`;
  resultEl.appendChild(formatRow);

  const convertBtn = document.createElement('button');
  convertBtn.type = 'button';
  convertBtn.className = 'btn-primary';
  convertBtn.style.marginTop = 'var(--space-4)';
  convertBtn.textContent = 'Convert';
  convertBtn.addEventListener('click', async () => {
    const mimeType = formatRow.querySelector('input[name="image-format"]:checked').value;
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    setState('working');
    setStatus(`Converting ${files.length} photo${files.length === 1 ? '' : 's'} on this device…`);
    try {
      const heic2any = await loadHeic2Any();
      const entries = {};
      let firstBytes = null;
      let firstName = null;
      let done = 0;
      for (const file of files) {
        done += 1;
        if (files.length > 1) reportBatchProgress(ctx, 'Converting', done, files.length, 'photo');
        // eslint-disable-next-line no-await-in-loop -- sequential so the
        // status line's own count stays meaningful, and so a large batch
        // doesn't try to decode every photo's full-resolution bitmap in
        // memory at once (same reasoning as imagesToPdf.client.js's loop).
        const bytes = await convertOne(file, mimeType, heic2any);
        const baseName = file.name.replace(/\.(heic|heif)$/i, '');
        const outName = `${baseName}.${ext}`;
        entries[outName] = bytes;
        if (!firstBytes) { firstBytes = bytes; firstName = outName; }
      }
      if (files.length === 1) {
        downloadBlob(new Blob([firstBytes], { type: mimeType }), firstName);
        setState('done');
        setStatus(`Saved ${firstName}.`, 'success');
      } else {
        const { zipSync } = await import('../vendor/fflate/browser.js');
        const zipName = 'converted-images.zip';
        downloadBlob(new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }), zipName);
        setState('done');
        setStatus(`Saved ${zipName} - ${files.length} photo${files.length === 1 ? '' : 's'} inside.`, 'success');
      }
      appendSupportNote(resultEl);
    } catch (err) {
      setState('error');
      setStatus(err && err.message ? err.message : 'Could not convert those photos.', 'error');
    }
  });
  resultEl.appendChild(convertBtn);
  resultEl.hidden = false;
  setState('idle');
  setStatus(`${files.length} photo${files.length === 1 ? '' : 's'} ready. Pick a format, then convert.`);
}
