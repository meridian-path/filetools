// Text diff / compare page controller. customPanelMode tool (src/pages/
// toolPage.js, see uuid-generator.js's own comment on this flag): this
// tool's whole point is paste-and-see with no upload step at all, so it has
// no FILE input and builds its own entire live panel client-side, same
// pattern as regexTester.client.js. maxBytes/accepts/multiple on the
// registration fragment are unused placeholders for the same reason
// uuid-generator.js's are.
//
// The actual diff algorithm -- line-level LCS, then word-level LCS for a
// changed line's own highlighting -- is pure and lives in
// ../pure/textDiff.mjs so it stays unit-testable without a DOM; this file's
// job is only to (a) read both textareas, (b) render the option controls,
// stats badge, and the two-pane diff grid, and (c) re-run the pure logic in
// place whenever a visitor types or changes an option.

import { diffText } from '../pure/textDiff.mjs';

const DEBOUNCE_MS = 200;

const DEFAULT_TEXT_A = 'The quick brown fox jumps over the lazy dog.\nThis line stays the same.\nThis line will be removed.\nA shared line at the end.';
const DEFAULT_TEXT_B = 'The quick brown fox leaps over the lazy dog.\nThis line stays the same.\nA brand new line goes here.\nA shared line at the end.';

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

/**
 * @param {Array<{type:'equal'|'delete'|'insert', text:string}>|null} wordOps
 * @param {'a'|'b'} side 'a' renders equal+delete (the original half of a
 *   changed pair), 'b' renders equal+insert (the changed half).
 * @param {string} fallbackText used when wordOps is null (the token grid
 *   was too large for word-level highlighting -- render the plain line
 *   with no sub-highlighting rather than nothing).
 * @returns {DocumentFragment}
 */
function buildWordDiffFragment(wordOps, side, fallbackText) {
  const frag = document.createDocumentFragment();
  if (!wordOps) {
    frag.appendChild(document.createTextNode(fallbackText));
    return frag;
  }
  const keepType = side === 'a' ? 'delete' : 'insert';
  const markClass = side === 'a' ? 'text-diff-del' : 'text-diff-ins';
  for (const op of wordOps) {
    if (op.type === 'equal') {
      frag.appendChild(document.createTextNode(op.text));
    } else if (op.type === keepType) {
      const mark = document.createElement('mark');
      mark.className = markClass;
      mark.textContent = op.text;
      frag.appendChild(mark);
    }
  }
  return frag;
}

/**
 * @param {string|null} text
 * @param {number|null} lineNo
 * @param {'unchanged'|'changed'|'added'|'removed'|'empty'} status
 * @param {Array|null} [wordOps]
 * @param {'a'|'b'} [side]
 */
function buildCell(text, lineNo, status, wordOps, side) {
  const cell = document.createElement('div');
  cell.className = `text-diff-cell text-diff-cell--${side || 'a'}`;
  cell.dataset.diffStatus = status;
  if (lineNo !== null) {
    const num = document.createElement('span');
    num.className = 'text-diff-linenum';
    num.textContent = String(lineNo);
    cell.appendChild(num);
  }
  const content = document.createElement('span');
  content.className = 'text-diff-text';
  if (status === 'changed' && wordOps !== undefined) {
    content.appendChild(buildWordDiffFragment(wordOps, side, text || ''));
  } else if (text !== null) {
    content.textContent = text.length ? text : ' ';
  }
  cell.appendChild(content);
  return cell;
}

/**
 * Builds a plain-text unified-diff-style report ("- old" / "+ new" / "  same")
 * for the copy button -- a widely recognized format to paste into an issue,
 * PR comment, or chat, independent of this page's own visual rendering.
 */
function buildUnifiedDiffText(outcome) {
  const lines = [];
  outcome.rows.forEach((r) => {
    if (r.status === 'unchanged') lines.push(`  ${r.a}`);
    else if (r.status === 'removed') lines.push(`- ${r.a}`);
    else if (r.status === 'added') lines.push(`+ ${r.b}`);
    else {
      lines.push(`- ${r.a}`);
      lines.push(`+ ${r.b}`);
    }
  });
  return lines.join('\n');
}

function summaryText(outcome) {
  if (outcome.overLimit) return `Too many lines to compare (${outcome.totalA} × ${outcome.totalB}) - try shorter texts.`;
  if (outcome.stats.changed === 0 && outcome.stats.added === 0 && outcome.stats.removed === 0) {
    return outcome.totalA === 0 && outcome.totalB === 0 ? 'Nothing to compare yet - paste text into both boxes.' : 'No differences found - the two texts match exactly.';
  }
  return `${outcome.stats.changed} changed, ${outcome.stats.added} added, ${outcome.stats.removed} removed, ${outcome.stats.unchanged} unchanged.`;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'table-block';

  const inputsRow = document.createElement('div');
  inputsRow.className = 'text-diff-inputs';

  const labelA = document.createElement('label');
  labelA.className = 'text-diff-input-label';
  labelA.appendChild(document.createTextNode('Original text'));
  const textareaA = document.createElement('textarea');
  textareaA.className = 'paste-textarea';
  textareaA.rows = 8;
  textareaA.spellcheck = false;
  textareaA.value = DEFAULT_TEXT_A;
  textareaA.setAttribute('aria-label', 'Original text');
  labelA.appendChild(textareaA);

  const labelB = document.createElement('label');
  labelB.className = 'text-diff-input-label';
  labelB.appendChild(document.createTextNode('Changed text'));
  const textareaB = document.createElement('textarea');
  textareaB.className = 'paste-textarea';
  textareaB.rows = 8;
  textareaB.spellcheck = false;
  textareaB.value = DEFAULT_TEXT_B;
  textareaB.setAttribute('aria-label', 'Changed text');
  labelB.appendChild(textareaB);

  inputsRow.append(labelA, labelB);
  panel.appendChild(inputsRow);

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  head.appendChild(badge);

  const swapBtn = document.createElement('button');
  swapBtn.type = 'button';
  swapBtn.className = 'btn-secondary';
  swapBtn.textContent = 'Swap A ↔ B';
  swapBtn.addEventListener('click', () => {
    const tmp = textareaA.value;
    textareaA.value = textareaB.value;
    textareaB.value = tmp;
    runDiff();
  });
  head.appendChild(swapBtn);

  const wsLabel = document.createElement('label');
  const wsToggle = document.createElement('input');
  wsToggle.type = 'checkbox';
  wsToggle.addEventListener('change', runDiff);
  wsLabel.appendChild(wsToggle);
  wsLabel.appendChild(document.createTextNode(' Ignore whitespace'));
  head.appendChild(wsLabel);

  const caseLabel = document.createElement('label');
  const caseToggle = document.createElement('input');
  caseToggle.type = 'checkbox';
  caseToggle.addEventListener('change', runDiff);
  caseLabel.appendChild(caseToggle);
  caseLabel.appendChild(document.createTextNode(' Ignore case'));
  head.appendChild(caseLabel);

  panel.appendChild(head);

  const statusEl = document.createElement('p');
  statusEl.className = 'dz-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  panel.appendChild(statusEl);

  const outputContainer = document.createElement('div');
  panel.appendChild(outputContainer);

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  panel.appendChild(btnRow);

  resultEl.appendChild(panel);
  resultEl.hidden = false;

  function render(outcome) {
    outputContainer.innerHTML = '';
    btnRow.innerHTML = '';
    badge.textContent = `${outcome.stats.changed} changed · ${outcome.stats.added} added · ${outcome.stats.removed} removed · ${outcome.stats.unchanged} unchanged`;

    if (outcome.overLimit) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-danger';
      msg.setAttribute('role', 'alert');
      msg.textContent = `These texts (${outcome.totalA} and ${outcome.totalB} lines) are too large to compare - try shorter texts.`;
      outputContainer.appendChild(msg);
      return;
    }

    if (outcome.rows.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-warn';
      msg.setAttribute('role', 'alert');
      msg.textContent = 'There’s nothing to compare - both boxes are empty.';
      outputContainer.appendChild(msg);
      return;
    }

    if (outcome.stats.changed === 0 && outcome.stats.added === 0 && outcome.stats.removed === 0) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-success';
      msg.setAttribute('role', 'alert');
      msg.textContent = 'No differences found - the two texts match exactly.';
      outputContainer.appendChild(msg);
    }

    const grid = document.createElement('div');
    grid.className = 'text-diff-grid';

    const headerA = document.createElement('div');
    headerA.className = 'text-diff-cell text-diff-cell--a text-diff-header';
    headerA.textContent = 'Original';
    const headerB = document.createElement('div');
    headerB.className = 'text-diff-cell text-diff-cell--b text-diff-header';
    headerB.textContent = 'Changed';
    grid.append(headerA, headerB);

    outcome.rows.forEach((r) => {
      if (r.status === 'unchanged') {
        grid.appendChild(buildCell(r.a, r.aLine, 'unchanged', undefined, 'a'));
        grid.appendChild(buildCell(r.b, r.bLine, 'unchanged', undefined, 'b'));
      } else if (r.status === 'removed') {
        grid.appendChild(buildCell(r.a, r.aLine, 'removed', undefined, 'a'));
        grid.appendChild(buildCell(null, null, 'empty', undefined, 'b'));
      } else if (r.status === 'added') {
        grid.appendChild(buildCell(null, null, 'empty', undefined, 'a'));
        grid.appendChild(buildCell(r.b, r.bLine, 'added', undefined, 'b'));
      } else {
        grid.appendChild(buildCell(r.a, r.aLine, 'changed', r.wordOps, 'a'));
        grid.appendChild(buildCell(r.b, r.bLine, 'changed', r.wordOps, 'b'));
      }
    });

    outputContainer.appendChild(grid);

    btnRow.appendChild(makeCopyButton(() => buildUnifiedDiffText(outcome), 'Copy as diff text'));
  }

  function runDiff() {
    const outcome = diffText(textareaA.value, textareaB.value, {
      ignoreWhitespace: wsToggle.checked,
      ignoreCase: caseToggle.checked,
    });
    render(outcome);
    statusEl.textContent = summaryText(outcome);
    statusEl.dataset.tone = outcome.overLimit ? 'error' : 'success';
  }

  let debounceHandle = null;
  function scheduleRun() {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(runDiff, DEBOUNCE_MS);
  }

  textareaA.addEventListener('input', scheduleRun);
  textareaB.addEventListener('input', scheduleRun);

  runDiff();
}
