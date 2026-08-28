Local git hooks for this repo, wired automatically by `npm install`'s `prepare`
script (`git config core.hooksPath .githooks`). Not Git's default
`.git/hooks/` location -- that directory isn't tracked, so hooks placed there
don't survive a fresh clone; this one is tracked and applies to every
checkout that has run `npm install` at least once.

- `commit-msg`: runs `scripts/check-commit-message.js` against the message
  being committed. See that script's own header comment for why it exists.
