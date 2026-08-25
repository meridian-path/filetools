// Shared batch-progress reporting -- one canonical phrasing + wiring for
// every processor whose loop genuinely knows a real done/total count, so no
// tool's multi-item wait reads slightly differently from its sibling's
// (CRAFT_DOCTRINE.md 2.4's designed-edge-states ritual). The pure formatting
// function lives in ../pure/batchProgress.mjs (see that file's own header
// comment for why); this file is the thin ctx-wrapper convenience that calls
// both dropzone.client.js callbacks (setStatus for the aria-live text,
// setProgress for the determinate bar) together, since every real call site
// needs both.
//
// Deliberately NOT wired into every tool that touches multiple files/pages --
// only the ones a real timing check showed can actually cross Nielsen's
// thresholds for realistic input (measured, not assumed; see this repo's
// ROLLING_PLAN.md for the numbers). Most tools' work finishes in well under
// 1s even at generous batch sizes, so the existing generic "<Verb> on this
// device..." message stays exactly right for them -- adding a fake X-of-N
// counter to something that finishes in 300ms would be a "craft absence" of
// its own kind (a progress affordance nobody needed).

import { formatBatchStatus } from '../pure/batchProgress.mjs';

/**
 * Reports one unit of batch progress through both dropzone.client.js
 * callbacks at once. `done` is 1-based (the unit currently being started or
 * just finished -- callers pass whichever reads more naturally for their own
 * loop shape; formatBatchStatus doesn't care which convention, only that a
 * caller is consistent within its own loop).
 */
export function reportBatchProgress(ctx, verb, done, total, noun) {
  ctx.setStatus(formatBatchStatus(verb, done, total, noun));
  if (ctx.setProgress) ctx.setProgress(done, total);
}
