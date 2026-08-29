/**
 * Semantic structural diff between two parsed JSON values -- pure logic for
 * the "JSON diff / compare" tool. Genuinely different algorithm class from
 * ../pure/textDiff.mjs/csvDiff.mjs (both line/row-granularity LCS over
 * strings): this walks two JSON VALUES recursively, comparing objects by
 * key (union of both sides' keys, sorted -- key ORDER never matters, the
 * real differentiator per this tool's own demand evidence, since most
 * incumbents advertise exactly this as their headline feature) and arrays
 * by an LCS alignment over their elements (exact deep-equality as the
 * token comparator, same DP shape textDiff.mjs's line-level diff and
 * csvDiff.mjs's row-level diff already use, generalized from string
 * tokens to arbitrary JSON values) with the same replace-pairing pass
 * those two modules use, generalized from a string/cell similarity ratio
 * to a shared-leaf-count ratio.
 *
 * SCOPE CUT, disclosed on the tool's own FAQ, not silent: an array
 * insertion/removal is recognized correctly (the LCS alignment finds it,
 * same as text-diff finding an inserted line) as long as the shifted
 * elements on either side of it are not ALSO independently modified in a
 * way that drops their similarity below MIN_CHANGED_ELEMENT_SIMILARITY --
 * this is the same disclosed tradeoff csvDiff.mjs's own position mode
 * already accepts, generalized to arbitrary values.
 */

/**
 * @param {*} value a value from a parsed JSON document (object, array,
 *   string, number, boolean, or null -- JSON.parse never produces
 *   `undefined`, which is why `undefined` is safe to use internally, in
 *   this module only, as the "this side has no value here at all"
 *   sentinel -- distinct from a real `null` present in the document).
 * @returns {'object'|'array'|'primitive'} JSON's own three structural
 *   kinds -- string/number/boolean/null are all "primitive" here since
 *   none of them have children to recurse into.
 */
function classify(value) {
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'primitive';
}

/**
 * The array-element LCS DP table is (a.length+1) * (b.length+1) cells --
 * same cap and reasoning as textDiff.mjs's MAX_LINE_DIFF_CELLS/csvDiff.mjs's
 * MAX_POSITION_DIFF_CELLS: above this, refuse with an honest message rather
 * than let the tab hang on a pathologically large array.
 */
export const MAX_ARRAY_DIFF_CELLS = 9_000_000;

/**
 * Same threshold value as textDiff.mjs's MIN_CHANGED_LINE_SIMILARITY and
 * csvDiff.mjs's MIN_CHANGED_ROW_SIMILARITY -- deliberately the same number
 * (not independently re-tuned), since it means the same thing here: an
 * LCS-unmatched pair of array elements is only reported as one "changed"
 * element (with a real recursive diff of what's different inside it) when
 * they share enough content that "these are the same thing, modified" is
 * the more honest read than "these are two unrelated things that happened
 * to land at adjacent positions."
 */
export const MIN_CHANGED_ELEMENT_SIMILARITY = 0.34;

/**
 * Ceiling on how many levels deep this module will recurse into nested
 * objects/arrays. Real-world JSON essentially never nests this deep (a
 * typical API response or config file is well under 20 levels), but a
 * hand-written recursive walk over an adversarial or accidentally-
 * generated deeply-nested document is a genuine stack-overflow risk this
 * cap exists to prevent -- verified directly, not assumed: a 5,000-level-
 * deep object crashed an earlier, uncapped version of this exact function
 * with a real `RangeError: Maximum call stack size exceeded` (Node's own
 * limit sits between roughly 1,500 and 2,000 levels for this function's
 * own per-frame cost; a browser's own limit can be smaller still), while
 * JSON.parse() itself parses that same input without complaint -- so an
 * otherwise perfectly valid paste could crash the diff with no cap here.
 * 500 sits comfortably below every measured failure point while still
 * being far beyond any realistic document.
 */
export const MAX_COMPARE_DEPTH = 500;

/**
 * @typedef {object} DiffNode
 * @property {'unchanged'|'changed'|'added'|'removed'} status
 * @property {'object'|'array'|'primitive'} kind
 * @property {*} [a] the value on the "before" side -- absent (`undefined`)
 *   for a node that's `added`.
 * @property {*} [b] the value on the "after" side -- absent for `removed`.
 * @property {Array<{key: string|number, node: DiffNode}>} [children]
 *   present for `object`/`array` kinds only, one entry per key/index,
 *   `key` is a string for an object property or a number for an array
 *   index.
 */

/**
 * Builds a fully `added` or fully `removed` subtree for a whole value --
 * used both for a genuinely new/deleted top-level value and for one side
 * of an object/array whose key or array-LCS-alignment position has no
 * counterpart on the other side. Recurses into children so a newly added
 * nested object shows its FULL contents as added, not just its own top
 * key with an opaque value -- matching how a real diff reads a wholesale
 * addition.
 * @param {*} value
 * @param {'added'|'removed'} status
 * @param {number} [depth] see MAX_COMPARE_DEPTH's own comment -- past the
 *   cap, the subtree stops expanding (still correctly tagged `added`/
 *   `removed` as one opaque leaf) rather than risk a stack overflow.
 * @returns {DiffNode}
 */
function wholeValueNode(value, status, depth = 0) {
  const side = status === 'removed' ? { a: value } : { b: value };
  if (depth > MAX_COMPARE_DEPTH) return { status, kind: 'primitive', ...side };
  const kind = classify(value);
  if (kind === 'primitive') return { status, kind, ...side };
  if (kind === 'array') {
    const children = value.map((v, i) => ({ key: i, node: wholeValueNode(v, status, depth + 1) }));
    return {
      status, kind, ...side, children,
    };
  }
  const children = Object.keys(value).sort().map((key) => ({ key, node: wholeValueNode(value[key], status, depth + 1) }));
  return {
    status, kind, ...side, children,
  };
}

/**
 * @param {DiffNode} node an already-computed diff node.
 * @returns {{total: number, matched: number}} the number of PRIMITIVE
 *   leaves under this node, and how many of those are `unchanged` --
 *   the shared-content measure the array replace-pairing pass below uses
 *   to decide whether an LCS-unmatched pair of elements is similar enough
 *   to report as one recursively-diffed `changed` element.
 */
function countLeaves(node) {
  if (node.kind === 'primitive') {
    return { total: 1, matched: node.status === 'unchanged' ? 1 : 0 };
  }
  // An `overLimit` array has no `children` computed -- treated as one
  // opaque leaf-like unit rather than throwing on a missing array.
  if (!node.children) return { total: 1, matched: node.status === 'unchanged' ? 1 : 0 };
  let total = 0;
  let matched = 0;
  for (const { node: child } of node.children) {
    const c = countLeaves(child);
    total += c.total;
    matched += c.matched;
  }
  // An empty object/array pair (both sides []/{}) has zero leaves to
  // compare -- treated as fully similar (1) rather than 0/0, the same
  // "nothing to disagree about" convention textDiff.mjs's own
  // diffWords()/similarity computation uses for a pair of empty lines.
  return { total, matched };
}

/**
 * @param {DiffNode} node
 * @returns {number} matched/total leaf ratio, 1 for a leafless (empty
 *   object/array) pair.
 */
function similarityOf(node) {
  const { total, matched } = countLeaves(node);
  return total === 0 ? 1 : matched / total;
}

/**
 * Array-element LCS, exact shape of textDiff.mjs's diffLinesRaw/csvDiff.mjs's
 * diffByPosition, generalized from a string/row token comparator to
 * deep-equal JSON values.
 * @param {Array} a
 * @param {Array} b
 * @param {number} depth this array's own depth -- its ELEMENTS sit one
 *   level deeper, threaded into jsonDeepEqual's own cap below.
 * @returns {{overLimit: boolean, ops: Array}}
 */
function alignArrayElements(a, b, depth) {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_ARRAY_DIFF_CELLS) return { overLimit: true, ops: [] };

  // Exact deep-equality is the LCS token test -- computed once per pair up
  // front rather than inline in the DP loop's inner comparison, since
  // deep-equal on an arbitrary JSON value is not the O(1) string
  // comparison textDiff.mjs/csvDiff.mjs's own token equality is. This
  // still costs the same O(n*m) worst case (deep-equal is called once per
  // DP cell), the same complexity class the cap above already accounts
  // for.
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  const idx = (i, j) => i * width + j;
  const equalCache = new Map();
  const isEqual = (i, j) => {
    const k = i * m + j;
    if (equalCache.has(k)) return equalCache.get(k);
    const r = jsonDeepEqual(a[i], b[j], depth + 1);
    equalCache.set(k, r);
    return r;
  };
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[idx(i, j)] = isEqual(i, j)
        ? dp[idx(i + 1, j + 1)] + 1
        : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (isEqual(i, j)) {
      ops.push({ type: 'equal', ai: i, bj: j });
      i += 1;
      j += 1;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      ops.push({ type: 'delete', ai: i });
      i += 1;
    } else {
      ops.push({ type: 'insert', bj: j });
      j += 1;
    }
  }
  while (i < n) { ops.push({ type: 'delete', ai: i }); i += 1; }
  while (j < m) { ops.push({ type: 'insert', bj: j }); j += 1; }
  return { overLimit: false, ops };
}

/**
 * Post-processes a raw array-LCS op sequence: a delete immediately paired
 * with an insert (same position within a run of non-equal ops) becomes one
 * recursively-diffed `changed` element when similar enough, exact shape of
 * textDiff.mjs's/csvDiff.mjs's own pairReplaceBlocks.
 * @param {Array} ops
 * @param {Array} a
 * @param {Array} b
 * @param {number} depth this array's own depth -- its elements/children
 *   sit one level deeper.
 * @returns {Array<{key: number, node: DiffNode}>}
 */
function pairArrayReplaceBlocks(ops, a, b, depth) {
  const children = [];
  let outIndex = 0;
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      children.push({ key: outIndex, node: diffJsonValues(a[op.ai], b[op.bj], depth + 1) });
      outIndex += 1;
      i += 1;
      continue;
    }
    let j = i;
    const deletes = [];
    const inserts = [];
    while (j < ops.length && ops[j].type !== 'equal') {
      if (ops[j].type === 'delete') deletes.push(ops[j]);
      else inserts.push(ops[j]);
      j += 1;
    }
    const pairCount = Math.min(deletes.length, inserts.length);
    for (let k = 0; k < pairCount; k += 1) {
      const candidate = diffJsonValues(a[deletes[k].ai], b[inserts[k].bj], depth + 1);
      if (similarityOf(candidate) >= MIN_CHANGED_ELEMENT_SIMILARITY) {
        children.push({ key: outIndex, node: candidate });
      } else {
        children.push({ key: outIndex, node: wholeValueNode(a[deletes[k].ai], 'removed', depth + 1) });
        outIndex += 1;
        children.push({ key: outIndex, node: wholeValueNode(b[inserts[k].bj], 'added', depth + 1) });
      }
      outIndex += 1;
    }
    for (let k = pairCount; k < deletes.length; k += 1) {
      children.push({ key: outIndex, node: wholeValueNode(a[deletes[k].ai], 'removed', depth + 1) });
      outIndex += 1;
    }
    for (let k = pairCount; k < inserts.length; k += 1) {
      children.push({ key: outIndex, node: wholeValueNode(b[inserts[k].bj], 'added', depth + 1) });
      outIndex += 1;
    }
    i = j;
  }
  return children;
}

/**
 * @param {*} a
 * @param {*} b
 * @param {number} [depth] see MAX_COMPARE_DEPTH's own comment -- past the
 *   cap, two values are conservatively treated as NOT equal (safe either
 *   way for every real caller: it only ever widens a "changed" report
 *   into more of the tree being shown as different, never hides a real
 *   difference) rather than recursing further.
 * @returns {boolean} true if `a` and `b` are structurally identical --
 *   object key order never matters, array element order always does (an
 *   array is an ordered sequence; the same convention every real
 *   incumbent found during this tool's own demand-mining research uses).
 */
export function jsonDeepEqual(a, b, depth = 0) {
  if (depth > MAX_COMPARE_DEPTH) return false;
  const kindA = classify(a);
  const kindB = classify(b);
  if (kindA !== kindB) return false;
  if (kindA === 'primitive') return a === b;
  if (kindA === 'array') {
    if (a.length !== b.length) return false;
    return a.every((v, i) => jsonDeepEqual(v, b[i], depth + 1));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonDeepEqual(a[k], b[k], depth + 1));
}

/**
 * The single entry point: recursively diffs two already-parsed JSON
 * values.
 * @param {*} a the "before" value.
 * @param {*} b the "after" value.
 * @param {number} [depth] see MAX_COMPARE_DEPTH's own comment.
 * @returns {DiffNode & {overLimit?: boolean, depthLimited?: boolean}}
 *   `overLimit` is set (on an `array`-kind node) when that array's own
 *   element count exceeded MAX_ARRAY_DIFF_CELLS -- the caller renders that
 *   array as a single opaque `changed` leaf with an honest message rather
 *   than hang, the rest of the document (everything outside that one
 *   array) still diffed normally. `depthLimited` is set when `depth`
 *   exceeded MAX_COMPARE_DEPTH -- same idea, for pathological NESTING
 *   depth instead of array WIDTH.
 */
export function diffJsonValues(a, b, depth = 0) {
  const aMissing = a === undefined;
  const bMissing = b === undefined;
  if (aMissing && bMissing) return { status: 'unchanged', kind: 'primitive', a: undefined, b: undefined };
  if (depth > MAX_COMPARE_DEPTH) {
    // Too deep to safely recurse further -- report as a single opaque
    // "changed" leaf. Conservative (a real subtree this deep could
    // theoretically still be identical) but the only choice that never
    // itself risks a stack overflow: even a "just check equality" fallback
    // here would need to recurse through however much of the document
    // remains below this point, which is exactly what this cap exists to
    // avoid doing unconditionally.
    return {
      status: 'changed', kind: 'primitive', a, b, depthLimited: true,
    };
  }
  if (aMissing) return wholeValueNode(b, 'added', depth);
  if (bMissing) return wholeValueNode(a, 'removed', depth);

  const kindA = classify(a);
  const kindB = classify(b);
  if (kindA !== kindB) {
    // The type itself changed (e.g. a field went from a string to an
    // object) -- treated as one leaf-level change, not a diff of two
    // structurally incompatible trees. `kind: 'primitive'` here regardless
    // of either side's REAL kind is deliberate: this node has no
    // `children` to recurse into (the two sides aren't comparable
    // structurally), so it must count and render as a single leaf, the
    // same as diffStats()'s and the renderer's own `kind === 'primitive'`
    // branch already expects.
    return { status: 'changed', kind: 'primitive', a, b };
  }
  if (kindA === 'primitive') {
    return { status: a === b ? 'unchanged' : 'changed', kind: 'primitive', a, b };
  }
  if (kindA === 'array') {
    const { overLimit, ops } = alignArrayElements(a, b, depth);
    if (overLimit) {
      return {
        status: jsonDeepEqual(a, b, depth) ? 'unchanged' : 'changed', kind: 'array', a, b, overLimit: true,
      };
    }
    const children = pairArrayReplaceBlocks(ops, a, b, depth);
    const anyChange = children.some((c) => c.node.status !== 'unchanged');
    return {
      status: anyChange ? 'changed' : 'unchanged', kind: 'array', a, b, children,
    };
  }
  // object
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const children = keys.map((key) => {
    const hasA = Object.prototype.hasOwnProperty.call(a, key);
    const hasB = Object.prototype.hasOwnProperty.call(b, key);
    return { key, node: diffJsonValues(hasA ? a[key] : undefined, hasB ? b[key] : undefined, depth + 1) };
  });
  const anyChange = children.some((c) => c.node.status !== 'unchanged');
  return {
    status: anyChange ? 'changed' : 'unchanged', kind: 'object', a, b, children,
  };
}

/**
 * @param {DiffNode} node the root of an already-computed diff tree.
 * @returns {{unchanged: number, changed: number, added: number, removed: number}}
 *   counts every PRIMITIVE leaf's own status once -- a wholesale added/
 *   removed object counts each of its own leaves, the same granular
 *   per-value counting convention textDiff.mjs/csvDiff.mjs already use
 *   (an added multi-line block counts as N added lines, not one "block"),
 *   not a separate count for the container itself (which would double-
 *   count against its own children).
 */
export function diffStats(node) {
  const stats = {
    unchanged: 0, changed: 0, added: 0, removed: 0,
  };
  (function walk(n) {
    if (n.kind === 'primitive') {
      stats[n.status] += 1;
      return;
    }
    // An `overLimit` array has no `children` computed at all -- nothing
    // further to tally under it.
    if (!n.children) return;
    for (const { node: child } of n.children) walk(child);
  }(node));
  return stats;
}
