// QR Code Generator page controller. customPanelMode tool (src/pages/
// toolPage.js, see uuid-generator.js's own comment on this flag): no file
// input at all, paste-and-see live encoding, so this builds its own entire
// panel client-side. maxBytes/accepts/multiple on the registration
// fragment are unused placeholders for the same reason uuid-generator.js's
// are.
//
// The actual QR encoding runs directly against the vendored
// `qrcode-generator` library (self-hosted from this same origin --
// vendor/, copied from node_modules at build time by
// scripts/copy-vendor.js, never a CDN, same reasoning as
// pdfPages.client.js/yamlToJson.client.js) -- dynamically imported so its
// bytes are fetched in parallel rather than blocking this file's own
// parse/eval. This file overrides the library's own `stringToBytes` with
// a real UTF-8 encoder (../pure/qrCodeGenerator.mjs's stringToUtf8Bytes) --
// the library's built-in default only masks each UTF-16 code unit to its
// low byte, which corrupts any accented or non-Latin character. The
// Wi-Fi-payload building and input validation are also pure and live in
// that same module so they stay unit-testable without a DOM.

import {
  stringToUtf8Bytes, buildWifiPayload, validateEncodableText,
} from '../pure/qrCodeGenerator.mjs';

const qrModulePromise = import('../vendor/qrcode-generator/qrcode.mjs');

const DEBOUNCE_MS = 200;
const DISPLAY_TARGET_PX = 280;
const DOWNLOAD_CELL_SIZE = 10;

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
 * @param {string} text the exact content to encode.
 * @param {'L'|'M'|'Q'|'H'} errorCorrectionLevel
 * @returns {Promise<object>} a made qrcode-generator instance, or throws
 *   the library's own overflow error if `text` doesn't fit at any QR
 *   version even at the lowest error-correction level -- callers should
 *   only reach this after validateEncodableText's own size cap has
 *   already passed, so this is a genuine "still too dense" case, not a
 *   duplicate of that check.
 */
async function buildQr(text, errorCorrectionLevel) {
  const { default: qrcodeFactory } = await qrModulePromise;
  qrcodeFactory.stringToBytes = stringToUtf8Bytes;
  const qr = qrcodeFactory(0, errorCorrectionLevel);
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'table-block';

  // Mode select ----------------------------------------------------------
  const modeRow = document.createElement('div');
  modeRow.className = 'table-block-head';
  const modeLabel = document.createElement('label');
  modeLabel.appendChild(document.createTextNode('Content type '));
  const modeSelect = document.createElement('select');
  [['text', 'Text or URL'], ['wifi', 'Wi-Fi network']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    modeSelect.appendChild(opt);
  });
  modeLabel.appendChild(modeSelect);
  modeRow.appendChild(modeLabel);

  const ecLabel = document.createElement('label');
  ecLabel.appendChild(document.createTextNode('Error correction '));
  const ecSelect = document.createElement('select');
  [['L', 'Low (~7%)'], ['M', 'Medium (~15%)'], ['Q', 'Quartile (~25%)'], ['H', 'High (~30%)']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (value === 'M') opt.selected = true;
    ecSelect.appendChild(opt);
  });
  ecLabel.appendChild(ecSelect);
  modeRow.appendChild(ecLabel);
  panel.appendChild(modeRow);

  // Text/URL input ---------------------------------------------------------
  const textLabel = document.createElement('label');
  textLabel.appendChild(document.createTextNode('Text or URL'));
  const textArea = document.createElement('textarea');
  textArea.className = 'paste-textarea';
  textArea.rows = 3;
  textArea.spellcheck = false;
  textArea.value = 'https://example.com';
  textLabel.appendChild(textArea);
  panel.appendChild(textLabel);

  // Wi-Fi form -------------------------------------------------------------
  const wifiForm = document.createElement('div');
  wifiForm.hidden = true;

  const ssidLabel = document.createElement('label');
  ssidLabel.appendChild(document.createTextNode('Network name (SSID)'));
  const ssidInput = document.createElement('input');
  ssidInput.type = 'text';
  ssidInput.value = 'MyHomeNetwork';
  ssidLabel.appendChild(ssidInput);
  wifiForm.appendChild(ssidLabel);

  const securityLabel = document.createElement('label');
  securityLabel.appendChild(document.createTextNode('Security'));
  const securitySelect = document.createElement('select');
  [['WPA', 'WPA/WPA2/WPA3'], ['WEP', 'WEP'], ['nopass', 'None (open network)']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    securitySelect.appendChild(opt);
  });
  securityLabel.appendChild(securitySelect);
  wifiForm.appendChild(securityLabel);

  const passwordLabel = document.createElement('label');
  passwordLabel.appendChild(document.createTextNode('Password'));
  const passwordInput = document.createElement('input');
  passwordInput.type = 'text';
  passwordInput.value = 'correcthorsebatterystaple';
  passwordLabel.appendChild(passwordInput);
  wifiForm.appendChild(passwordLabel);

  const hiddenLabel = document.createElement('label');
  const hiddenCheckbox = document.createElement('input');
  hiddenCheckbox.type = 'checkbox';
  hiddenLabel.appendChild(hiddenCheckbox);
  hiddenLabel.appendChild(document.createTextNode(' Hidden network'));
  wifiForm.appendChild(hiddenLabel);

  panel.appendChild(wifiForm);

  const statusEl = document.createElement('p');
  statusEl.className = 'dz-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  panel.appendChild(statusEl);

  const outputContainer = document.createElement('div');
  panel.appendChild(outputContainer);

  resultEl.appendChild(panel);
  resultEl.hidden = false;

  function currentContent() {
    if (modeSelect.value === 'wifi') {
      return buildWifiPayload({
        ssid: ssidInput.value,
        password: passwordInput.value,
        security: securitySelect.value,
        hidden: hiddenCheckbox.checked,
      });
    }
    return textArea.value;
  }

  let requestSeq = 0;

  async function render() {
    const requestId = ++requestSeq;
    const content = currentContent();
    const validation = validateEncodableText(content);

    outputContainer.innerHTML = '';

    if (!validation.ok) {
      statusEl.textContent = validation.error;
      statusEl.dataset.tone = 'error';
      return;
    }

    let qr;
    try {
      qr = await buildQr(content, ecSelect.value);
    } catch (err) {
      if (requestId !== requestSeq) return;
      statusEl.textContent = 'That’s too much data for a QR code, even at the lowest error-correction level - try shorter text or a lower error-correction setting.';
      statusEl.dataset.tone = 'error';
      return;
    }
    if (requestId !== requestSeq) return;

    const moduleCount = qr.getModuleCount();
    const cellSize = Math.max(2, Math.floor(DISPLAY_TARGET_PX / moduleCount));

    const canvas = document.createElement('canvas');
    canvas.width = moduleCount * cellSize;
    canvas.height = moduleCount * cellSize;
    canvas.className = 'qr-preview-canvas';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    qr.renderTo2dContext(ctx, cellSize);
    outputContainer.appendChild(canvas);

    const encodedCaption = document.createElement('p');
    encodedCaption.className = 'caption';
    encodedCaption.textContent = `Encoding: ${content}`;
    outputContainer.appendChild(encodedCaption);

    const btnRow = document.createElement('div');
    btnRow.className = 'download-btn-row';

    const pngBtn = document.createElement('button');
    pngBtn.type = 'button';
    pngBtn.className = 'btn-primary';
    pngBtn.textContent = 'Download PNG';
    pngBtn.addEventListener('click', () => {
      const downloadCanvas = document.createElement('canvas');
      downloadCanvas.width = moduleCount * DOWNLOAD_CELL_SIZE;
      downloadCanvas.height = moduleCount * DOWNLOAD_CELL_SIZE;
      const downloadCtx = downloadCanvas.getContext('2d');
      downloadCtx.fillStyle = '#ffffff';
      downloadCtx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
      qr.renderTo2dContext(downloadCtx, DOWNLOAD_CELL_SIZE);
      downloadCanvas.toBlob((blob) => downloadBlob(blob, 'qrcode.png'), 'image/png');
    });
    btnRow.appendChild(pngBtn);

    const svgBtn = document.createElement('button');
    svgBtn.type = 'button';
    svgBtn.className = 'btn-secondary';
    svgBtn.textContent = 'Download SVG';
    svgBtn.addEventListener('click', () => {
      const svgText = qr.createSvgTag({ scalable: true });
      downloadBlob(new Blob([svgText], { type: 'image/svg+xml' }), 'qrcode.svg');
    });
    btnRow.appendChild(svgBtn);

    outputContainer.appendChild(btnRow);

    statusEl.textContent = `QR code ready (${moduleCount}×${moduleCount} modules).`;
    delete statusEl.dataset.tone;
  }

  let debounceHandle = null;
  function scheduleRender() {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(render, DEBOUNCE_MS);
  }

  modeSelect.addEventListener('change', () => {
    const isWifi = modeSelect.value === 'wifi';
    wifiForm.hidden = !isWifi;
    textLabel.hidden = isWifi;
    render();
  });
  ecSelect.addEventListener('change', render);
  textArea.addEventListener('input', scheduleRender);
  ssidInput.addEventListener('input', scheduleRender);
  passwordInput.addEventListener('input', scheduleRender);
  securitySelect.addEventListener('change', render);
  hiddenCheckbox.addEventListener('change', render);

  render();
}
