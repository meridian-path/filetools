// Regex-matching Web Worker. Runs OFF the main thread specifically so it
// can be forcibly killed: a native RegExp.prototype.exec() call is a
// single, synchronous, uninterruptible JavaScript operation, so a
// pathological pattern with catastrophic backtracking (e.g. /(a+)+b/
// against a long non-matching string) cannot be time-limited from within
// the call itself -- the only real mitigation is running it somewhere that
// CAN be terminated mid-call from the outside, which is exactly what a
// Worker is and a same-thread setTimeout is not. See
// src/pure/regexTester.mjs's header comment for the fuller version of this
// reasoning, and regexTester.client.js for the timeout + terminate() logic
// that pairs with this file.
//
// Copied into dist/js/ by src/build.js's ALWAYS_COPY_CLIENT_FILES list
// (not the per-tool CLIENT_FILES list -- it's never referenced by a
// <script> tag, only by regexTester.client.js's own `new Worker(...)`
// call), same fixed-file treatment as dropzone.client.js/newsletter.client.js.

import { findMatches } from '../pure/regexTester.mjs';

self.onmessage = (event) => {
  const { requestId, pattern, flags, testString } = event.data;
  let result;
  try {
    result = findMatches(pattern, flags, testString);
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : 'Something went wrong matching that pattern.' };
  }
  self.postMessage({ requestId, result });
};
