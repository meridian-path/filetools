// Unix Timestamp Converter page controller. Like uuidGenerator.client.js/
// regexTester.client.js/wordCharacterCounter.client.js, this is a
// customPanelMode tool (src/pages/toolPage.js) -- no dropzone, no
// paste-convert button, loaded directly as the page's <script
// type="module">. Three independent live sections: a "right now" readout
// that ticks every second, a timestamp-to-date converter, and a
// date-to-timestamp converter -- each recomputes only its own section on
// input, never the whole panel.

import {
  detectUnit, epochToDate, dateInputToEpoch, nowSnapshot,
} from '../pure/unixTimestampConverter.mjs';

function makeStat(label) {
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = label;
  return badge;
}

function nowInputDefault() {
  // "YYYY-MM-DDTHH:mm", the exact shape <input type="datetime-local">
  // both requires as its value and reports back on read -- built from the
  // browser's own local clock fields (not toISOString(), which is UTC and
  // would silently shift the displayed default by the visitor's own
  // offset).
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  // --- "Right now" ticking readout -------------------------------------
  const nowBlock = document.createElement('div');
  nowBlock.className = 'table-block';
  const nowHead = document.createElement('div');
  nowHead.className = 'table-block-head';
  const nowTitle = document.createElement('strong');
  nowTitle.textContent = 'Right now';
  nowHead.appendChild(nowTitle);
  nowBlock.appendChild(nowHead);
  const nowStatsRow = document.createElement('div');
  nowStatsRow.className = 'table-block-head';
  nowBlock.appendChild(nowStatsRow);
  resultEl.appendChild(nowBlock);

  function renderNow() {
    const snap = nowSnapshot();
    nowStatsRow.innerHTML = '';
    nowStatsRow.appendChild(makeStat(`${snap.epochSeconds}s`));
    nowStatsRow.appendChild(makeStat(`${snap.epochMilliseconds}ms`));
    nowStatsRow.appendChild(makeStat(snap.utcLabel));
    nowStatsRow.appendChild(makeStat(`${snap.localLabel} (${snap.localTimeZone})`));
  }
  renderNow();
  setInterval(renderNow, 1000);

  // --- Timestamp -> Date -------------------------------------------------
  const toDateBlock = document.createElement('div');
  toDateBlock.className = 'table-block';
  const toDateHead = document.createElement('div');
  toDateHead.className = 'table-block-head';
  const toDateTitle = document.createElement('strong');
  toDateTitle.textContent = 'Timestamp to date';
  toDateHead.appendChild(toDateTitle);
  toDateBlock.appendChild(toDateHead);

  const inputRow = document.createElement('div');
  inputRow.className = 'table-block-head';
  const tsLabel = document.createElement('label');
  tsLabel.appendChild(document.createTextNode('Timestamp: '));
  const tsInput = document.createElement('input');
  tsInput.type = 'text';
  tsInput.inputMode = 'numeric';
  tsInput.placeholder = '1735689600';
  tsInput.setAttribute('aria-label', 'Unix timestamp');
  tsLabel.appendChild(tsInput);
  inputRow.appendChild(tsLabel);

  const unitLabel = document.createElement('label');
  unitLabel.appendChild(document.createTextNode('Unit: '));
  const unitSelect = document.createElement('select');
  [['auto', 'Auto-detect'], ['seconds', 'Seconds'], ['milliseconds', 'Milliseconds']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    unitSelect.appendChild(opt);
  });
  unitLabel.appendChild(unitSelect);
  inputRow.appendChild(unitLabel);
  toDateBlock.appendChild(inputRow);

  const toDateStatus = document.createElement('p');
  toDateStatus.className = 'paste-status';
  toDateStatus.setAttribute('role', 'status');
  toDateStatus.setAttribute('aria-live', 'polite');
  toDateBlock.appendChild(toDateStatus);

  const toDateOutput = document.createElement('div');
  toDateOutput.className = 'table-block-head';
  toDateBlock.appendChild(toDateOutput);
  resultEl.appendChild(toDateBlock);

  function runToDate() {
    const raw = tsInput.value.trim();
    toDateOutput.innerHTML = '';
    if (raw === '') {
      toDateStatus.textContent = 'Enter a timestamp.';
      return;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      toDateStatus.textContent = 'That is not a valid number.';
      return;
    }
    const unit = unitSelect.value === 'auto' ? detectUnit(numeric) : unitSelect.value;
    const result = epochToDate(numeric, unit);
    if (!result.ok) {
      toDateStatus.textContent = result.error;
      return;
    }
    toDateStatus.textContent = unitSelect.value === 'auto' ? `Detected as ${unit}.` : '';
    toDateOutput.appendChild(makeStat(result.utcLabel));
    toDateOutput.appendChild(makeStat(`${result.localLabel} (${result.localTimeZone})`));
  }
  tsInput.addEventListener('input', runToDate);
  unitSelect.addEventListener('change', runToDate);
  tsInput.value = '1735689600';
  runToDate();

  // --- Date -> Timestamp ---------------------------------------------------
  const toEpochBlock = document.createElement('div');
  toEpochBlock.className = 'table-block';
  const toEpochHead = document.createElement('div');
  toEpochHead.className = 'table-block-head';
  const toEpochTitle = document.createElement('strong');
  toEpochTitle.textContent = 'Date to timestamp';
  toEpochHead.appendChild(toEpochTitle);
  toEpochBlock.appendChild(toEpochHead);

  const dateRow = document.createElement('div');
  dateRow.className = 'table-block-head';
  const dateLabel = document.createElement('label');
  dateLabel.appendChild(document.createTextNode('Date and time: '));
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.step = '1';
  dateInput.setAttribute('aria-label', 'Date and time to convert');
  dateLabel.appendChild(dateInput);
  dateRow.appendChild(dateLabel);

  const interpretLabel = document.createElement('label');
  interpretLabel.appendChild(document.createTextNode('Interpret as: '));
  const interpretSelect = document.createElement('select');
  [['local', 'My local time'], ['utc', 'UTC']].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    interpretSelect.appendChild(opt);
  });
  interpretLabel.appendChild(interpretSelect);
  dateRow.appendChild(interpretLabel);
  toEpochBlock.appendChild(dateRow);

  const toEpochStatus = document.createElement('p');
  toEpochStatus.className = 'paste-status';
  toEpochStatus.setAttribute('role', 'status');
  toEpochStatus.setAttribute('aria-live', 'polite');
  toEpochBlock.appendChild(toEpochStatus);

  const toEpochOutput = document.createElement('div');
  toEpochOutput.className = 'table-block-head';
  toEpochBlock.appendChild(toEpochOutput);
  resultEl.appendChild(toEpochBlock);

  function runToEpoch() {
    toEpochOutput.innerHTML = '';
    const result = dateInputToEpoch(dateInput.value, interpretSelect.value);
    if (!result.ok) {
      toEpochStatus.textContent = result.error;
      return;
    }
    toEpochStatus.textContent = '';
    toEpochOutput.appendChild(makeStat(`${result.epochSeconds}s`));
    toEpochOutput.appendChild(makeStat(`${result.epochMilliseconds}ms`));
  }
  dateInput.addEventListener('input', runToEpoch);
  interpretSelect.addEventListener('change', runToEpoch);
  dateInput.value = nowInputDefault();
  runToEpoch();

  resultEl.hidden = false;
}
