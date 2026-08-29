/**
 * Plain-text line-and-word diff -- pure logic for the "Text diff / compare"
 * tool (src/browser/textDiff.client.js). Same shape of work as
 * ../pure/csvDiff.mjs's diffByPosition: a classic dynamic-programming LCS
 * over lines, then a replace-pairing pass that promotes a deleted+inserted
 * line pair to a single "changed" row (with word-level highlighting) when
 * they're similar enough. The one addition csvDiff.mjs doesn't need: a
 * SECOND, word-granularity LCS diff for a changed line's own sub-line
 * highlighting, since a plain-text line (unlike a CSV cell) is usually long
 * enough that showing "this whole line changed" is much less useful than
 * showing exactly which words did.
 *
 * Order-sensitive by construction: an LCS alignment cares about sequence,
 * so "the cat sat" vs "sat the cat" reports as a real change, not a match --
 * this is the same behavior as `diff`/git word-diff, and directly answers
 * this tool's own FAQ ("does word order matter").
 */

/**
 * The line-level DP table is (linesA.length+1) * (linesB.length+1) cells --
 * same cap and reasoning as csvDiff.mjs's MAX_POSITION_DIFF_CELLS: above
 * this, refuse with an honest message rather than let the tab hang.
 */
export const MAX_LINE_DIFF_CELLS = 9_000_000;

/**
 * The per-line-pair word-level DP table is (tokensA.length+1) *
 * (tokensB.length+1) cells. A single line is realistically short, but a
 * visitor could still paste one absurdly long unbroken line -- this cap
 * makes that a graceful "no sub-highlighting for this pair" instead of a
 * hang, independent of the (already-bounded) line-level cap above.
 */
export const MAX_WORD_DIFF_CELLS = 250_000;

/**
 * Same threshold and reasoning as csvDiff.mjs's MIN_CHANGED_ROW_SIMILARITY:
 * a deleted line directly next to an inserted line is only reported as one
 * "changed" line (with word-level highlighting) when the two are similar
 * enough that "changed" is the more honest read than a plain remove+add --
 * below this, showing them as unrelated content that happened to land next
 * to each other is more honest than forcing a comparison.
 */
export const MIN_CHANGED_LINE_SIMILARITY = 0.34;

/**
 * @param {string} text
 * @returns {string[]} lines, with a single trailing newline (if present)
 *   treated as ending the last line rather than creating a phantom extra
 *   blank line -- the same convention `diff`/git use, so a file that just
 *   ends in "\n" doesn't report a spurious final-line difference.
 */
export function splitLines(text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  if (normalized === '') return [];
  const trimmed = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return trimmed.split('\n');
}

/**
 * @param {string} line
 * @param {{ignoreWhitespace?: boolean, ignoreCase?: boolean}} opts
 * @returns {string} the comparison key used for LINE-level equality --
 *   ignoreWhitespace collapses leading/trailing/internal whitespace runs so
 *   two lines differing only by indentation or spacing count as equal;
 *   ignoreCase lowercases. Rendering always uses the real original line
 *   text regardless of these options -- only the equality DECISION changes.
 */
function lineKey(line, opts) {
  let key = line;
  if (opts.ignoreWhitespace) key = key.trim().replace(/\s+/g, ' ');
  if (opts.ignoreCase) key = key.toLowerCase();
  return key;
}

/**
 * @param {string} line
 * @returns {string[]} alternating non-whitespace and whitespace runs, e.g.
 *   "foo  bar" -> ["foo", "  ", "bar"] -- reversible (tokens.join('') ===
 *   line) so rendering never loses or invents a character, and coarse
 *   enough to read as "word diff" the way `diff --word-diff` does.
 */
export function tokenizeWords(line) {
  return line.match(/\S+|\s+/g) || [];
}

/**
 * Runs a token-level LCS between two lines and reports both the edit script
 * (for rendering) and a similarity ratio (for the line-pairing decision
 * above) from the SAME alignment, so the two never disagree with each
 * other.
 *
 * @param {string} lineA
 * @param {string} lineB
 * @param {{ignoreCase?: boolean}} [opts]
 * @returns {{ops: Array<{type:'equal'|'delete'|'insert', text:string}>|null, similarity: number}}
 *   ops is null when the token grid exceeds MAX_WORD_DIFF_CELLS -- the
 *   caller renders that pair as a plain whole-line replace with no
 *   sub-highlighting rather than hang. similarity is a Ratcliff/Obershelp-
 *   style ratio (2 * matched chars / total chars of both lines), computed
 *   from the token LCS even when ops itself had to bail out is not
 *   attempted in that case (no correct alignment exists to measure) --
 *   ops === null pairs are always treated as dissimilar (similarity 0)
 *   by the caller's own fallback below.
 */
export function diffWords(lineA, lineB, opts = {}) {
  if (lineA === lineB) {
    return { ops: lineA.length ? [{ type: 'equal', text: lineA }] : [], similarity: 1 };
  }
  const tokensA = tokenizeWords(lineA);
  const tokensB = tokenizeWords(lineB);
  const n = tokensA.length;
  const m = tokensB.length;
  if (n * m > MAX_WORD_DIFF_CELLS) {
    return { ops: null, similarity: 0 };
  }

  const keyA = opts.ignoreCase ? tokensA.map((t) => t.toLowerCase()) : tokensA;
  const keyB = opts.ignoreCase ? tokensB.map((t) => t.toLowerCase()) : tokensB;

  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  const idx = (i, j) => i * width + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[idx(i, j)] = keyA[i] === keyB[j]
        ? dp[idx(i + 1, j + 1)] + 1
        : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const rawOps = [];
  let i = 0;
  let j = 0;
  let matchedChars = 0;
  while (i < n && j < m) {
    if (keyA[i] === keyB[j]) {
      rawOps.push({ type: 'equal', text: tokensA[i] });
      matchedChars += tokensA[i].length;
      i += 1;
      j += 1;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      rawOps.push({ type: 'delete', text: tokensA[i] });
      i += 1;
    } else {
      rawOps.push({ type: 'insert', text: tokensB[j] });
      j += 1;
    }
  }
  while (i < n) { rawOps.push({ type: 'delete', text: tokensA[i] }); i += 1; }
  while (j < m) { rawOps.push({ type: 'insert', text: tokensB[j] }); j += 1; }

  // Merge consecutive same-type tokens (a word plus the whitespace run
  // beside it, both "equal" or both "delete") into one span -- purely a
  // rendering simplification, doesn't change what's reported as changed.
  const ops = [];
  for (const op of rawOps) {
    const last = ops[ops.length - 1];
    if (last && last.type === op.type) last.text += op.text;
    else ops.push({ ...op });
  }

  const totalLen = lineA.length + lineB.length;
  const similarity = totalLen === 0 ? 1 : (matchedChars * 2) / totalLen;
  return { ops, similarity };
}

/**
 * Line-level LCS -- identical shape to csvDiff.mjs's diffByPosition, at
 * line granularity instead of row granularity.
 */
function diffLinesRaw(linesA, linesB, opts) {
  const n = linesA.length;
  const m = linesB.length;
  if (n * m > MAX_LINE_DIFF_CELLS) return { overLimit: true, ops: [] };

  const tokensA = linesA.map((l) => lineKey(l, opts));
  const tokensB = linesB.map((l) => lineKey(l, opts));

  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  const idx = (i, j) => i * width + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[idx(i, j)] = tokensA[i] === tokensB[j]
        ? dp[idx(i + 1, j + 1)] + 1
        : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tokensA[i] === tokensB[j]) {
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
 * Post-processes a raw line-level LCS op sequence: any run of consecutive
 * delete/insert ops between two "equal" ops is a candidate for "replace"
 * pairing, same reasoning as csvDiff.mjs's pairReplaceBlocks.
 */
function pairReplaceBlocks(ops, linesA, linesB, opts) {
  const result = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      result.push(op);
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
      const lineA = linesA[deletes[k].ai];
      const lineB = linesB[inserts[k].bj];
      const wd = diffWords(lineA, lineB, opts);
      if (wd.similarity >= MIN_CHANGED_LINE_SIMILARITY) {
        result.push({
          type: 'replace', ai: deletes[k].ai, bj: inserts[k].bj, wordOps: wd.ops,
        });
      } else {
        result.push(deletes[k]);
        result.push(inserts[k]);
      }
    }
    for (let k = pairCount; k < deletes.length; k += 1) result.push(deletes[k]);
    for (let k = pairCount; k < inserts.length; k += 1) result.push(inserts[k]);
    i = j;
  }
  return result;
}

/**
 * The single entry point: splits both texts into lines, runs the line-level
 * diff, pairs replace blocks, and computes word-level ops for each changed
 * pair.
 *
 * @param {string} textA original text.
 * @param {string} textB changed text.
 * @param {{ignoreWhitespace?: boolean, ignoreCase?: boolean}} [opts]
 * @returns {{
 *   overLimit: boolean,
 *   rows: Array<{status:'unchanged'|'changed'|'added'|'removed', a:string|null, b:string|null, aLine:number|null, bLine:number|null, wordOps?:Array|null}>,
 *   stats: {unchanged:number, changed:number, added:number, removed:number},
 *   totalA: number, totalB: number,
 * }}
 */
export function diffText(textA, textB, opts = {}) {
  const { ignoreWhitespace = false, ignoreCase = false } = opts;
  const cellOpts = { ignoreWhitespace, ignoreCase };

  const linesA = splitLines(textA);
  const linesB = splitLines(textB);

  const { overLimit, ops: rawOps } = diffLinesRaw(linesA, linesB, cellOpts);
  if (overLimit) {
    return {
      overLimit: true,
      rows: [],
      stats: {
        unchanged: 0, changed: 0, added: 0, removed: 0,
      },
      totalA: linesA.length,
      totalB: linesB.length,
    };
  }

  const paired = pairReplaceBlocks(rawOps, linesA, linesB, cellOpts);

  const rows = paired.map((op) => {
    if (op.type === 'equal') {
      return {
        status: 'unchanged', a: linesA[op.ai], b: linesB[op.bj], aLine: op.ai + 1, bLine: op.bj + 1,
      };
    }
    if (op.type === 'delete') {
      return {
        status: 'removed', a: linesA[op.ai], b: null, aLine: op.ai + 1, bLine: null,
      };
    }
    if (op.type === 'insert') {
      return {
        status: 'added', a: null, b: linesB[op.bj], aLine: null, bLine: op.bj + 1,
      };
    }
    return {
      status: 'changed', a: linesA[op.ai], b: linesB[op.bj], aLine: op.ai + 1, bLine: op.bj + 1, wordOps: op.wordOps,
    };
  });

  const stats = {
    unchanged: 0, changed: 0, added: 0, removed: 0,
  };
  rows.forEach((r) => { stats[r.status] += 1; });

  return {
    overLimit: false, rows, stats, totalA: linesA.length, totalB: linesB.length,
  };
}
