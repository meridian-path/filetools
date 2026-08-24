// Regex tester page controller. Like uuidGenerator.client.js, this is a
// customPanelMode tool (src/pages/toolPage.js) -- no dropzone, no paste-
// convert button, loaded directly as the page's <script type="module">.
// Unlike uuidGenerator.client.js, actual matching happens inside
// ./regexTester.worker.js (a Web Worker), not in this file or a directly-
// imported pure module -- see that worker's header comment for why: a
// pathological pattern (catastrophic backtracking) can make a single
// RegExp.exec() call block for a very long time, and only a Worker can be
// forcibly terminated mid-call to recover from that without freezing the
// whole tab.

const MATCH_TIMEOUT_MS = 2500;
const DEBOUNCE_MS = 200;

const DEFAULT_PATTERN = String.raw`(\w+)@(\w+\.\w+)`;
const DEFAULT_FLAGS = 'g';
const DEFAULT_TEST_STRING = 'Contact us at hello@example.com or support@example.org for help.';

function makeCopyButton(getText, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary';
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

/** Builds the highlighted test-string display as real DOM nodes (never string-concatenated HTML) so match text can never be mis-parsed as markup. */
function buildHighlightedText(testString, matches) {
  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  if (!testString) {
    pre.textContent = '';
    return pre;
  }
  let cursor = 0;
  for (const m of matches) {
    if (m.index > cursor) pre.appendChild(document.createTextNode(testString.slice(cursor, m.index)));
    if (m.end > m.index) {
      const mark = document.createElement('mark');
      mark.className = 'regex-match';
      mark.textContent = testString.slice(m.index, m.end);
      pre.appendChild(mark);
    } else {
      const caret = document.createElement('span');
      caret.className = 'regex-match--empty';
      caret.title = 'Zero-width match here';
      pre.appendChild(caret);
    }
    cursor = Math.max(cursor, m.end);
  }
  if (cursor < testString.length) pre.appendChild(document.createTextNode(testString.slice(cursor)));
  return pre;
}

function matchesReportText(matches) {
  return matches.map((m, i) => {
    const lines = [`Match ${i + 1}: "${m.match}" at ${m.index}-${m.end}`];
    for (const g of m.groups) {
      const label = g.name ? `${g.index} (${g.name})` : String(g.index);
      lines.push(`  Group ${label}: ${g.value === null ? '(did not participate)' : `"${g.value}"`}`);
    }
    return lines.join('\n');
  }).join('\n');
}

function buildGroupsTable(matches) {
  const hasAnyGroups = matches.some((m) => m.groups.length > 0);
  if (!hasAnyGroups) return null;

  const block = document.createElement('div');
  block.className = 'table-block';
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  table.className = 'extracted-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th scope="col">Match</th><th scope="col">Group</th><th scope="col">Value</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  matches.forEach((m, i) => {
    m.groups.forEach((g) => {
      const tr = document.createElement('tr');
      const matchCell = document.createElement('td');
      matchCell.textContent = String(i + 1);
      const groupCell = document.createElement('td');
      groupCell.textContent = g.name ? `${g.index} (${g.name})` : String(g.index);
      const valueCell = document.createElement('td');
      valueCell.textContent = g.value === null ? '(no match)' : g.value;
      tr.append(matchCell, groupCell, valueCell);
      tbody.appendChild(tr);
    });
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  block.appendChild(scroll);
  return block;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'table-block';

  const patternRow = document.createElement('div');
  patternRow.className = 'table-block-head';
  const patternLabel = document.createElement('label');
  patternLabel.style.flex = '1 1 100%';
  patternLabel.style.display = 'flex';
  patternLabel.style.flexDirection = 'column';
  patternLabel.style.gap = 'var(--space-1)';
  patternLabel.appendChild(document.createTextNode('Pattern'));
  const patternInputRow = document.createElement('span');
  patternInputRow.style.display = 'flex';
  patternInputRow.style.alignItems = 'center';
  patternInputRow.style.gap = 'var(--space-1)';
  const openSlash = document.createElement('span');
  openSlash.textContent = '/';
  openSlash.setAttribute('aria-hidden', 'true');
  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.value = DEFAULT_PATTERN;
  patternInput.setAttribute('aria-label', 'Regular expression pattern');
  patternInput.style.flex = '1 1 auto';
  patternInput.style.minWidth = '0';
  const closeSlash = document.createElement('span');
  closeSlash.textContent = '/';
  closeSlash.setAttribute('aria-hidden', 'true');
  patternInputRow.append(openSlash, patternInput, closeSlash);
  patternLabel.appendChild(patternInputRow);
  patternRow.appendChild(patternLabel);
  panel.appendChild(patternRow);

  const flagsRow = document.createElement('div');
  flagsRow.className = 'table-block-head';
  const flagCheckboxes = {};
  [
    ['g', 'Global (find every match)'],
    ['i', 'Case-insensitive'],
    ['m', 'Multiline (^ and $ match line boundaries)'],
    ['s', 'Dot matches newline'],
    ['u', 'Unicode'],
  ].forEach(([flag, description]) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = DEFAULT_FLAGS.includes(flag);
    checkbox.setAttribute('aria-label', description);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${flag}`));
    label.title = description;
    flagsRow.appendChild(label);
    flagCheckboxes[flag] = checkbox;
  });
  panel.appendChild(flagsRow);

  const testLabel = document.createElement('label');
  testLabel.textContent = 'Test string';
  testLabel.style.display = 'block';
  testLabel.style.marginTop = 'var(--space-3)';
  const testTextarea = document.createElement('textarea');
  testTextarea.className = 'paste-textarea';
  testTextarea.rows = 6;
  testTextarea.spellcheck = false;
  testTextarea.value = DEFAULT_TEST_STRING;
  testLabel.appendChild(testTextarea);
  panel.appendChild(testLabel);

  resultEl.appendChild(panel);

  const statusEl = document.createElement('p');
  statusEl.className = 'dz-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  resultEl.appendChild(statusEl);

  const outputContainer = document.createElement('div');
  resultEl.appendChild(outputContainer);

  resultEl.hidden = false;

  let worker = null;
  let requestSeq = 0;
  let timeoutHandle = null;

  function spawnWorker() {
    worker = new Worker(new URL('./regexTester.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { requestId, result } = event.data;
      if (requestId !== requestSeq) return;
      clearTimeout(timeoutHandle);
      renderResult(result);
    };
    worker.onerror = () => {
      clearTimeout(timeoutHandle);
      renderResult({ ok: false, error: 'Something went wrong running that pattern.' });
    };
  }
  spawnWorker();

  function renderResult(result) {
    outputContainer.innerHTML = '';
    if (!result.ok) {
      statusEl.textContent = result.error;
      statusEl.dataset.tone = 'error';
      return;
    }

    const testString = testTextarea.value;
    const highlighted = buildHighlightedText(testString, result.matches);
    outputContainer.appendChild(highlighted);

    const groupsTable = buildGroupsTable(result.matches);
    if (groupsTable) outputContainer.appendChild(groupsTable);

    if (result.matches.length > 0) {
      const btnRow = document.createElement('div');
      btnRow.className = 'download-btn-row';
      btnRow.appendChild(makeCopyButton(() => matchesReportText(result.matches), 'Copy match report'));
      outputContainer.appendChild(btnRow);
    }

    const count = result.matches.length;
    let statusText = count === 0 ? 'No matches.' : `${count} match${count === 1 ? '' : 'es'} found.`;
    if (result.truncated) statusText += ` Showing the first ${count} - the pattern matches even more than that.`;
    statusEl.textContent = statusText;
    delete statusEl.dataset.tone;
  }

  function runMatch() {
    const flags = Object.entries(flagCheckboxes).filter(([, cb]) => cb.checked).map(([f]) => f).join('');
    const pattern = patternInput.value;
    const testString = testTextarea.value;

    if (!pattern) {
      outputContainer.innerHTML = '';
      statusEl.textContent = 'Enter a pattern to test.';
      delete statusEl.dataset.tone;
      return;
    }

    const requestId = ++requestSeq;
    statusEl.textContent = 'Matching…';
    delete statusEl.dataset.tone;

    clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      if (requestId !== requestSeq) return;
      // The worker's own exec() call is stuck (almost certainly
      // catastrophic backtracking) -- terminate() is the only way to
      // recover a Worker mid-synchronous-call; a fresh one replaces it so
      // the NEXT pattern the visitor tries still works.
      worker.terminate();
      spawnWorker();
      renderResult({ ok: false, error: 'This pattern is taking too long to run against this text - it may have catastrophic backtracking (for example, nested repeating groups like (a+)+). Try simplifying it.' });
    }, MATCH_TIMEOUT_MS);

    worker.postMessage({ requestId, pattern, flags, testString });
  }

  let debounceHandle = null;
  function scheduleRun() {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(runMatch, DEBOUNCE_MS);
  }

  patternInput.addEventListener('input', scheduleRun);
  testTextarea.addEventListener('input', scheduleRun);
  Object.values(flagCheckboxes).forEach((cb) => cb.addEventListener('change', runMatch));

  runMatch();
}
