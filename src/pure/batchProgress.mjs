// Pure formatting for the shared batch-progress reporting pattern (see
// ../browser/batchProgress.js's own header comment for the full rationale
// and which tools actually use this). Split out from that file because
// src/browser/*.js files load as plain ES modules with no bundler and this
// project's package.json is "type": "commonjs" -- a bare .js file there
// can't be `import`ed directly by a Node test the way an .mjs pure module
// can (see this repo's own src/pure/ convention for every other tool's pure
// logic). No DOM/ctx dependency here at all, unlike the wrapper.

/** "Converting image 3 of 12…" / "Rendering page 47 of 150…" */
export function formatBatchStatus(verb, done, total, noun) {
  return `${verb} ${noun} ${done} of ${total}…`;
}
