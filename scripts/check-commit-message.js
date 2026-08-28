'use strict';

/**
 * Enforces public-repo-hygiene.md rule 1 at the point rule 3 names
 * explicitly ("a commit-time habit, not just a /ship-time grep"): the
 * commit message itself. Reuses check-internal-ids.js's ID_RE/
 * DOC_FILENAME_RE/SERIES_LABEL_RE and check-copy-tells.js's
 * PROCESS_TALK_PHRASES rather than redefining them, so the two checkers'
 * pattern lists can't silently drift apart.
 *
 * Motivated by a real gap found during a hygiene-verification pass:
 * check-internal-ids.js and check-copy-tells.js both scan tracked files
 * and built output, but nothing ever scanned the commit message itself --
 * five already-published commits on this repo's own history leaked
 * task-/decision-ids or internal governing-doc filenames into their
 * message body despite every touched source file passing both checks
 * cleanly. Already-published history is intentionally left as-is
 * (public-repo-hygiene.md's own "does not require rewriting
 * already-published history" carve-out); this only stops a NEW commit
 * message from adding to that list.
 *
 * Installed as a `commit-msg` git hook via .githooks/commit-msg, wired by
 * the `prepare` npm script (`git config core.hooksPath .githooks`) -- see
 * .githooks/README.md. Also callable directly for a one-off check.
 *
 * Usage: node scripts/check-commit-message.js <path-to-message-file>
 * Exits 1 and prints what matched if the message leaks anything; exits 0
 * silently otherwise (a git hook should stay quiet on the success path).
 */

const fs = require('fs');
const { ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE } = require('./check-internal-ids.js');
const { PROCESS_TALK_PHRASES } = require('./check-copy-tells.js');

// Each RE above is a shared, module-level `g`-flagged object elsewhere in
// this codebase; re-deriving a fresh copy per call here avoids inheriting
// any other caller's `lastIndex` state (same reasoning as this repo's own
// check-internal-ids.test.mjs comment on why ID_RE needs a fresh copy per
// assertion).
function freshGlobal(re) {
  return new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
}

function findLeaksInMessage(message) {
  const hits = [];
  for (const re of [ID_RE, DOC_FILENAME_RE, SERIES_LABEL_RE]) {
    hits.push(...(message.match(freshGlobal(re)) || []));
  }
  const lower = message.toLowerCase();
  for (const phrase of PROCESS_TALK_PHRASES) {
    if (lower.includes(phrase)) hits.push(`process-talk phrase "${phrase}"`);
  }
  return [...new Set(hits)];
}

function main() {
  const msgFile = process.argv[2];
  if (!msgFile) {
    console.error('Usage: node scripts/check-commit-message.js <path-to-message-file>');
    process.exitCode = 1;
    return;
  }
  const message = fs.readFileSync(msgFile, 'utf8');
  const hits = findLeaksInMessage(message);
  if (hits.length > 0) {
    console.error(`Commit message leaks internal reference(s): ${hits.join(', ')}`);
    console.error(
      'See .claude/rules/public-repo-hygiene.md rule 1 -- state the reason a change was ' +
        'made, not the internal ticket/doc name that discovered it.'
    );
    process.exitCode = 1;
    return;
  }
}

if (require.main === module) {
  main();
}

module.exports = { findLeaksInMessage };
