// JWT Decoder page controller. customPanelMode tool (src/pages/toolPage.js,
// see uuid-generator.js's own comment on this flag): a single paste-and-see
// input with no file/dropzone step at all, loaded directly as the page's
// <script type="module">. The actual decode -- base64url + JSON.parse, no
// signature verification -- is pure and lives in ../pure/jwtDecode.mjs so
// it stays unit-testable without a DOM; this file only builds the panel and
// re-runs on every keystroke (cheap enough to skip the debounce pattern
// text-diff.mjs/jsonDiff.client.js need for their own, much heavier LCS
// algorithms).

import { decodeJwt } from '../pure/jwtDecode.mjs';

// A real, syntactically valid example JWT (RFC 7519's own worked example,
// widely reproduced -- e.g. jwt.io's own default) -- header
// {"alg":"HS256","typ":"JWT"}, payload {"sub":"1234567890","name":"John
// Doe","iat":1516239022}. Shown pre-filled so a first-time visitor sees a
// real decoded result immediately, same convention as
// regexTester.client.js/qrCodeGenerator.client.js's own pre-filled
// defaults.
const DEFAULT_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function jsonPreview(value) {
  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  pre.textContent = JSON.stringify(value, null, 2);
  return pre;
}

function labeledBlock(title, contentEl) {
  const block = document.createElement('div');
  block.className = 'table-block';
  const head = document.createElement('div');
  head.className = 'table-block-head';
  const heading = document.createElement('strong');
  heading.textContent = title;
  head.appendChild(heading);
  block.appendChild(head);
  block.appendChild(contentEl);
  return block;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  const inputBlock = document.createElement('div');
  inputBlock.className = 'table-block';
  const inputLabel = document.createElement('label');
  inputLabel.appendChild(document.createTextNode('JWT to decode'));
  const textarea = document.createElement('textarea');
  textarea.className = 'paste-textarea';
  textarea.rows = 4;
  textarea.spellcheck = false;
  textarea.value = DEFAULT_JWT;
  textarea.setAttribute('aria-label', 'JWT to decode');
  inputLabel.appendChild(textarea);
  inputBlock.appendChild(inputLabel);

  const statusEl = document.createElement('p');
  statusEl.className = 'dz-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  inputBlock.appendChild(statusEl);

  resultEl.appendChild(inputBlock);

  const outputContainer = document.createElement('div');
  resultEl.appendChild(outputContainer);
  resultEl.hidden = false;

  // One page-badge per claim rather than the site's own .file-list/.file-row
  // (used elsewhere for actual file listings, where the truncate-with-
  // ellipsis filename is the long field and a short size/status is the
  // meta) -- here it's the reverse, a short fixed label next to a long ISO
  // date + note, which .file-name's own nowrap+ellipsis rule would cut off
  // on a narrow viewport instead of the date. A row of wrapping badges
  // (table-block-head is already flex-wrap) never needs to truncate either
  // field.
  function renderTimeClaims(timeClaims) {
    const row = document.createElement('div');
    row.className = 'table-block-head';
    const noteByKey = {
      exp: (isPast) => (isPast ? 'expired' : 'not yet expired'),
      nbf: (isPast) => (isPast ? 'already valid' : 'not yet valid'),
      iat: () => null,
    };
    timeClaims.forEach((c) => {
      const note = noteByKey[c.key](c.isPast);
      const badge = document.createElement('span');
      badge.className = 'page-badge';
      badge.textContent = note ? `${c.label} (${c.key}): ${c.iso} - ${note}` : `${c.label} (${c.key}): ${c.iso}`;
      row.appendChild(badge);
    });
    return row;
  }

  function render() {
    outputContainer.innerHTML = '';
    const result = decodeJwt(textarea.value);

    if (!result.ok) {
      if (result.error === 'empty') {
        statusEl.textContent = 'Paste a JWT to decode it.';
        delete statusEl.dataset.tone;
      } else {
        statusEl.textContent = result.error;
        statusEl.dataset.tone = 'error';
      }
      return;
    }

    statusEl.textContent = 'Decoded - nothing was sent anywhere.';
    statusEl.dataset.tone = 'success';

    outputContainer.appendChild(labeledBlock('Header', jsonPreview(result.header)));
    outputContainer.appendChild(labeledBlock('Payload', jsonPreview(result.payload)));

    if (result.timeClaims.length > 0) {
      outputContainer.appendChild(labeledBlock('Time claims', renderTimeClaims(result.timeClaims)));
    }

    const signaturePre = document.createElement('pre');
    signaturePre.className = 'json-preview';
    signaturePre.textContent = result.signature;
    const signatureNote = document.createElement('p');
    signatureNote.className = 'caption';
    signatureNote.textContent = 'Shown as-is, not verified - this tool has no key to check it against. See the FAQ below.';
    const signatureWrap = document.createElement('div');
    signatureWrap.append(signaturePre, signatureNote);
    outputContainer.appendChild(labeledBlock('Signature', signatureWrap));
  }

  textarea.addEventListener('input', render);
  render();
}
