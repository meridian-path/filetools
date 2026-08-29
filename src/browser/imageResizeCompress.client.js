// Image Resize/Compress processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="imageResizeCompress")
// on first file selection, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./imagesToPdf.client.js.
//
// Everything here runs against a real decoded `ImageBitmap` and a real
// canvas -- createImageBitmap(file) decodes the dropped JPG/PNG/WebP
// directly (no <img>/object-URL round trip needed), and canvas
// drawImage/toBlob does the actual resize and lossy re-encode. The
// dimension/format/filename MATH lives in ../pure/imageResizeCompress.mjs
// (pure, unit-testable); this file owns only the DOM/canvas wiring.
//
// The width/height/format/quality controls are built ONCE, up front (same
// shape as ./qrCodeGenerator.client.js's live panel) -- only the preview
// canvas, the before/after stats line, and the download button's own
// handler are rebuilt on each render(), so a visitor typing a new width
// keeps focus on that same <input> across every debounced re-render
// instead of it being torn down and rebuilt from scratch.

import {
  clampDimension, lockedCounterpart, outputMimeType, supportsQuality, outputFilename, MAX_DIMENSION_PX,
} from '../pure/imageResizeCompress.mjs';

const DEBOUNCE_MS = 200;
const DEFAULT_QUALITY_PERCENT = 82;

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

const FORMAT_OPTIONS = [
  ['original', 'Keep original'],
  ['jpeg', 'JPG'],
  ['png', 'PNG'],
  ['webp', 'WebP'],
];

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const {
    files, resultEl, setState, setStatus,
  } = ctx;
  const file = files[0];

  setState('working');
  setStatus('Reading your image on this device…');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error(`"${file.name}" doesn’t look like a valid image - try a different JPG, PNG, or WebP file.`);
  }

  const srcWidth = bitmap.width;
  const srcHeight = bitmap.height;

  resultEl.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'table-block';

  // Dimension controls -----------------------------------------------------
  const dimensionRow = document.createElement('div');
  dimensionRow.className = 'table-block-head';

  const widthLabel = document.createElement('label');
  widthLabel.append('Width ');
  const widthInput = document.createElement('input');
  widthInput.type = 'number';
  widthInput.id = 'resize-width';
  widthInput.min = '1';
  widthInput.max = String(MAX_DIMENSION_PX);
  widthInput.value = String(clampDimension(srcWidth));
  widthInput.setAttribute('aria-label', 'Width in pixels');
  widthLabel.appendChild(widthInput);
  dimensionRow.appendChild(widthLabel);

  const heightLabel = document.createElement('label');
  heightLabel.append('Height ');
  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.id = 'resize-height';
  heightInput.min = '1';
  heightInput.max = String(MAX_DIMENSION_PX);
  heightInput.value = String(clampDimension(srcHeight));
  heightInput.setAttribute('aria-label', 'Height in pixels');
  heightLabel.appendChild(heightInput);
  dimensionRow.appendChild(heightLabel);

  const lockLabel = document.createElement('label');
  const lockCheckbox = document.createElement('input');
  lockCheckbox.type = 'checkbox';
  lockCheckbox.id = 'lock-aspect-ratio';
  lockCheckbox.checked = true;
  lockLabel.appendChild(lockCheckbox);
  lockLabel.append(' Lock aspect ratio');
  dimensionRow.appendChild(lockLabel);

  panel.appendChild(dimensionRow);

  // Format/quality controls -------------------------------------------------
  const formatRow = document.createElement('div');
  formatRow.className = 'table-block-head';

  const formatLabel = document.createElement('label');
  formatLabel.append('Format ');
  const formatSelect = document.createElement('select');
  formatSelect.id = 'output-format';
  FORMAT_OPTIONS.forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    formatSelect.appendChild(opt);
  });
  formatLabel.appendChild(formatSelect);
  formatRow.appendChild(formatLabel);

  const qualityLabel = document.createElement('label');
  qualityLabel.className = 'quality-control';
  qualityLabel.append('Quality ');
  const qualityInput = document.createElement('input');
  qualityInput.type = 'range';
  qualityInput.min = '1';
  qualityInput.max = '100';
  qualityInput.value = String(DEFAULT_QUALITY_PERCENT);
  qualityInput.setAttribute('aria-label', 'Output quality, percent');
  const qualityValue = document.createElement('span');
  qualityValue.textContent = `${DEFAULT_QUALITY_PERCENT}%`;
  qualityLabel.appendChild(qualityInput);
  qualityLabel.appendChild(qualityValue);
  formatRow.appendChild(qualityLabel);

  panel.appendChild(formatRow);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn-secondary';
  resetBtn.textContent = 'Reset to original size';
  panel.appendChild(resetBtn);

  const canvas = document.createElement('canvas');
  canvas.className = 'image-preview-canvas';
  panel.appendChild(canvas);

  const statsEl = document.createElement('p');
  statsEl.className = 'image-resize-stats';
  panel.appendChild(statsEl);

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download';
  downloadBtn.disabled = true;
  btnRow.appendChild(downloadBtn);
  panel.appendChild(btnRow);

  resultEl.appendChild(panel);
  resultEl.hidden = false;

  let requestSeq = 0;
  let firstRenderDone = false;

  async function render() {
    const requestId = ++requestSeq;
    // Disabled for the full duration of this render (including the
    // debounce wait before it even starts, via scheduleRender() below) --
    // otherwise a click landing between an edit and the next completed
    // render would download the PREVIOUS settings' file, not what's
    // currently on screen.
    downloadBtn.disabled = true;

    const width = clampDimension(widthInput.value);
    const height = clampDimension(heightInput.value);
    widthInput.value = String(width);
    heightInput.value = String(height);

    const mime = outputMimeType(formatSelect.value, file.type);
    const qualityCapable = supportsQuality(mime);
    qualityLabel.hidden = !qualityCapable;
    const quality = Number(qualityInput.value) / 100;
    qualityValue.textContent = `${qualityInput.value}%`;

    canvas.width = width;
    canvas.height = height;
    const drawCtx = canvas.getContext('2d');
    drawCtx.clearRect(0, 0, width, height);
    drawCtx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      if (qualityCapable) canvas.toBlob(resolve, mime, quality);
      else canvas.toBlob(resolve, mime);
    });
    if (requestId !== requestSeq) return;

    if (!blob) {
      downloadBtn.disabled = true;
      setStatus('Couldn’t render that combination of settings - try a different format.', 'error');
      return;
    }

    const filename = outputFilename(file.name, mime);
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => downloadBlob(blob, filename);

    statsEl.textContent = '';
    const beforeSpan = document.createElement('span');
    beforeSpan.append('Original: ');
    const beforeStrong = document.createElement('strong');
    beforeStrong.textContent = `${srcWidth}×${srcHeight}`;
    beforeSpan.appendChild(beforeStrong);
    beforeSpan.append(`, ${humanSize(file.size)}`);
    statsEl.appendChild(beforeSpan);

    const afterSpan = document.createElement('span');
    afterSpan.append('New: ');
    const afterStrong = document.createElement('strong');
    afterStrong.textContent = `${width}×${height}`;
    afterSpan.appendChild(afterStrong);
    const savingsPercent = file.size > 0 ? Math.round((1 - blob.size / file.size) * 100) : 0;
    const savingsNote = savingsPercent > 0 ? `, ${savingsPercent}% smaller` : (savingsPercent < 0 ? `, ${Math.abs(savingsPercent)}% larger` : '');
    afterSpan.append(`, ${humanSize(blob.size)}${savingsNote}`);
    statsEl.appendChild(afterSpan);

    if (!firstRenderDone) {
      firstRenderDone = true;
      setState('done');
      setStatus('Ready - adjust the settings above, then download.');
    }
  }

  let debounceHandle = null;
  function scheduleRender() {
    downloadBtn.disabled = true;
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(render, DEBOUNCE_MS);
  }

  widthInput.addEventListener('input', () => {
    if (lockCheckbox.checked) {
      heightInput.value = String(lockedCounterpart(srcWidth, srcHeight, widthInput.value, 'width'));
    }
    scheduleRender();
  });
  heightInput.addEventListener('input', () => {
    if (lockCheckbox.checked) {
      widthInput.value = String(lockedCounterpart(srcWidth, srcHeight, heightInput.value, 'height'));
    }
    scheduleRender();
  });
  lockCheckbox.addEventListener('change', () => {
    if (lockCheckbox.checked) {
      heightInput.value = String(lockedCounterpart(srcWidth, srcHeight, widthInput.value, 'width'));
      render();
    }
  });
  formatSelect.addEventListener('change', render);
  qualityInput.addEventListener('input', scheduleRender);
  resetBtn.addEventListener('click', () => {
    widthInput.value = String(clampDimension(srcWidth));
    heightInput.value = String(clampDimension(srcHeight));
    render();
  });

  await render();
}
