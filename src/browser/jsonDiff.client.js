// JSON diff / compare page controller. customPanelMode tool (src/pages/
// toolPage.js, see uuid-generator.js's own comment on this flag): paste-
// and-see with no upload step, same reasoning as textDiff.client.js. This
// file's job is only to (a) read both textareas, (b) JSON.parse each with
// a friendly per-side error, (c) render the diff tree and stats badge, and
// (d) re-run whenever a visitor types. The actual diff algorithm --
// recursive object/array structural diff -- is pure and lives in
// ../pure/jsonDiff.mjs so it stays unit-testable without a DOM.

import { diffJsonValues, diffStats } from '../pure/jsonDiff.mjs';

const DEBOUNCE_MS = 200;

const DEFAULT_JSON_A = JSON.stringify({
  user: {
    id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer'],
  },
  meta: { page: 1 },
}, null, 2);
const DEFAULT_JSON_B = JSON.stringify({
  meta: { page: 2 },
  user: {
    id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer', 'reviewer'],
  },
}, null, 2);

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
 * @param {*} value normally a primitive JSON value (string/number/boolean/
 *   null), or `undefined` for a node with no value on this side -- but see
 *   the try/catch below for the one real exception.
 * @returns {string} its literal JSON text, e.g. `"hello"`, `42`, `null`.
 */
function literalText(value) {
  if (value === undefined) return '';
  try {
    // Normally a plain, shallow JSON.stringify of a real primitive -- the
    // one case this can still throw is a `depthLimited` (or type-mismatch)
    // node's own `a`/`b`, which ../pure/jsonDiff.mjs deliberately leaves as
    // the FULL, untruncated original value even past its own recursion
    // cap (only the DIFFING stops there, not the stored reference) -- a
    // value that's pathologically deep enough to have hit that cap can
    // still be too deep for JSON.stringify's own (higher, but still
    // finite) recursion limit. Caught here, not avoided upstream, since
    // this is the one place that ever tries to serialize such a value.
    return JSON.stringify(value);
  } catch (err) {
    return '"(too deeply nested to display)"';
  }
}

/**
 * Flattens a diff tree (../pure/jsonDiff.mjs's DiffNode) into an ordered
 * list of display lines, git-diff-style: a plain line for anything
 * unchanged, a removed line directly followed by an added line for a
 * changed value, and every line inside a wholesale added/removed subtree
 * tinted that same status (built via a real recursive walk, not just the
 * subtree's own top line, so a big added object shows its full contents
 * as added).
 * @param {string|null} keyLabel `"key": ` for an object property, '' for
 *   an array element (array elements render unlabeled, the same
 *   convention `JSON.stringify(arr, null, 2)` itself uses).
 * @param {import('../pure/jsonDiff.mjs').DiffNode} node
 * @param {number} depth
 * @param {boolean} isLast whether this is the last child of its parent
 *   (controls the trailing comma).
 * @param {Array<{depth:number, status:'unchanged'|'added'|'removed', text:string}>} lines
 *   appended to in place.
 */
function flattenNode(keyLabel, node, depth, isLast, lines) {
  const comma = isLast ? '' : ',';
  if (node.kind === 'primitive') {
    if (node.status === 'changed') {
      lines.push({ depth, status: 'removed', text: `${keyLabel}${literalText(node.a)}${comma}` });
      lines.push({ depth, status: 'added', text: `${keyLabel}${literalText(node.b)}${comma}` });
    } else {
      const value = node.status === 'removed' ? node.a : node.b;
      lines.push({ depth, status: node.status, text: `${keyLabel}${literalText(value)}${comma}` });
    }
    return;
  }

  // overLimit: this one array's own element count was too large to diff --
  // rendered as a single opaque line rather than expanding it (or, worse,
  // throwing on missing `children`).
  if (!node.children) {
    lines.push({ depth, status: 'unchanged', text: `${keyLabel}"(too large to compare in detail)"${comma}` });
    return;
  }

  const openChar = node.kind === 'array' ? '[' : '{';
  const closeChar = node.kind === 'array' ? ']' : '}';
  // A wholesale added/removed container tints its OWN open/close lines
  // that status too; a merely-`changed` container (some children differ,
  // the container itself was present on both sides) renders its own
  // open/close lines plain -- the status lives on the specific lines that
  // actually changed, not smeared across every ancestor bracket.
  const ownLineStatus = node.status === 'added' || node.status === 'removed' ? node.status : 'unchanged';
  lines.push({ depth, status: ownLineStatus, text: `${keyLabel}${openChar}` });
  node.children.forEach(({ key, node: child }, i) => {
    const childKeyLabel = node.kind === 'array' ? '' : `${JSON.stringify(String(key))}: `;
    flattenNode(childKeyLabel, child, depth + 1, i === node.children.length - 1, lines);
  });
  lines.push({ depth, status: ownLineStatus, text: `${closeChar}${comma}` });
}

function summaryText(stats, hasError) {
  if (hasError) return '';
  if (stats.changed === 0 && stats.added === 0 && stats.removed === 0) {
    return 'No differences found - these two JSON values are structurally identical.';
  }
  return `${stats.changed} changed, ${stats.added} added, ${stats.removed} removed, ${stats.unchanged} unchanged.`;
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
  labelA.appendChild(document.createTextNode('Original JSON'));
  const textareaA = document.createElement('textarea');
  textareaA.className = 'paste-textarea';
  textareaA.rows = 10;
  textareaA.spellcheck = false;
  textareaA.value = DEFAULT_JSON_A;
  textareaA.setAttribute('aria-label', 'Original JSON');
  labelA.appendChild(textareaA);

  const labelB = document.createElement('label');
  labelB.className = 'text-diff-input-label';
  labelB.appendChild(document.createTextNode('Changed JSON'));
  const textareaB = document.createElement('textarea');
  textareaB.className = 'paste-textarea';
  textareaB.rows = 10;
  textareaB.spellcheck = false;
  textareaB.value = DEFAULT_JSON_B;
  textareaB.setAttribute('aria-label', 'Changed JSON');
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

  /**
   * @param {string} text
   * @returns {{ok:true, value:*}|{ok:false, error:string}}
   */
  function tryParse(text) {
    if (!text.trim()) return { ok: false, error: 'empty' };
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function renderTree(node) {
    const lines = [];
    flattenNode('', node, 0, true, lines);
    const tree = document.createElement('pre');
    tree.className = 'json-diff-tree';
    lines.forEach((line) => {
      // .json-diff-line is display:block (src/css.js), which already
      // forces one line per span -- no separate newline text node needed
      // between them (this <pre>'s own white-space:pre would otherwise
      // preserve an appended "\n" verbatim too, doubling every line gap).
      const span = document.createElement('span');
      span.className = 'json-diff-line';
      span.dataset.status = line.status;
      span.textContent = `${'  '.repeat(line.depth)}${line.text}`;
      tree.appendChild(span);
    });
    return tree;
  }

  function buildUnifiedDiffText(node) {
    const lines = [];
    flattenNode('', node, 0, true, lines);
    return lines.map((l) => {
      const prefix = l.status === 'added' ? '+ ' : l.status === 'removed' ? '- ' : '  ';
      return `${prefix}${'  '.repeat(l.depth)}${l.text}`;
    }).join('\n');
  }

  function runDiff() {
    outputContainer.innerHTML = '';
    btnRow.innerHTML = '';

    const parsedA = tryParse(textareaA.value);
    const parsedB = tryParse(textareaB.value);

    if (!parsedA.ok || !parsedB.ok) {
      badge.textContent = '';
      if (parsedA.error === 'empty' && parsedB.error === 'empty') {
        statusEl.textContent = 'Nothing to compare yet - paste JSON into both boxes.';
        delete statusEl.dataset.tone;
      } else if (parsedA.error === 'empty' || parsedB.error === 'empty') {
        statusEl.textContent = `Paste JSON into the ${parsedA.error === 'empty' ? 'left' : 'right'} box too.`;
        statusEl.dataset.tone = 'error';
      } else {
        const sides = [];
        if (!parsedA.ok) sides.push(`left (${parsedA.error})`);
        if (!parsedB.ok) sides.push(`right (${parsedB.error})`);
        statusEl.textContent = `That’s not valid JSON - ${sides.join(', and the ')}.`;
        statusEl.dataset.tone = 'error';
      }
      return;
    }

    const node = diffJsonValues(parsedA.value, parsedB.value);
    const stats = diffStats(node);
    badge.textContent = `${stats.changed} changed · ${stats.added} added · ${stats.removed} removed · ${stats.unchanged} unchanged`;
    statusEl.textContent = summaryText(stats, false);
    statusEl.dataset.tone = 'success';

    outputContainer.appendChild(renderTree(node));
    btnRow.appendChild(makeCopyButton(() => buildUnifiedDiffText(node), 'Copy as diff text'));
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
