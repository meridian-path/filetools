'use strict';

module.exports = {
  slug: 'hash-generator',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'Hash Generator',
  h1: 'Generate File and Text Hashes',
  title: 'MD5, SHA-1, SHA-256, SHA-512 Hash Generator | filetools',
  metaDescription: 'Paste text or drop one or more files and get MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes instantly, free and in your browser. No upload, no sign-up.',
  deck: 'Paste text, or drop one or more files, and get MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes for each one. Nothing is sent anywhere.',
  clientEntry: 'hashGenerator',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  mark: { verb: 'convert' },
  maxBytes: 200 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.txt', type: 'text/plain' },
  mode: 'hash-generator',
  fileTypeLabel: '',
  // Empty, not '*' -- src/browser/dropzone.client.js's fileMatchesAccept()
  // treats an empty accept list as "match anything" (`if (!accept.length)
  // return true`); there is no wildcard token it recognizes, so '*' would
  // fail to match every real file and reject everything.
  accepts: '',
  multiple: true,
  pasteInput: {
    label: 'Or paste text',
    placeholder: 'The quick brown fox jumps over the lazy dog',
    buttonLabel: 'Hash pasted text',
  },
  howSteps: [
    'Drop or choose one or more files of any type, or paste text directly into the text box.',
    'MD5, SHA-1, SHA-256, SHA-384, and SHA-512 all compute immediately for each file (or the pasted text) - one block per input, with every algorithm listed inside it.',
    'Copy whichever hash you need. Dropping several files at once hashes all of them, each in its own block, so you never have to repeat the process one file at a time.',
  ],
  faqs: [
    {
      q: 'Is my file or text sent anywhere?',
      answerHtml: 'No. Pasted text and every dropped file are hashed entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Which algorithms does this support, and which doesn’t it?',
      answerHtml: 'MD5, SHA-1, SHA-256, SHA-384, and SHA-512. SHA-3 is deliberately not included in this build - its underlying construction is meaningfully more complex to implement correctly than the other five, and getting a hash function wrong is worse than not offering it. If SHA-3 support would help you, that’s useful to know - the tool may add it in a future update.',
    },
    {
      q: 'Is MD5 safe to use?',
      answerHtml: 'MD5 is cryptographically broken - it should never be used to protect a password or verify something security-sensitive, since collisions (two different inputs producing the same hash) are well known and practical to construct. It’s included here because it’s still widely used for non-security purposes: verifying a download wasn’t corrupted, checking two files are identical, or matching against an MD5 checksum a tool or vendor already published. For anything security-sensitive, use SHA-256 or SHA-512 instead.',
    },
    {
      q: 'Can I hash more than one file at once?',
      answerHtml: 'Yes. Drop or choose multiple files together and each one gets its own labeled block with all five hashes, computed in the same pass - no need to upload one file, copy its hashes, then repeat for the next.',
    },
    {
      q: 'Will this match the hash a command-line tool like md5sum or sha256sum produces?',
      answerHtml: 'Yes, for the exact same file content - a cryptographic hash is a pure function of the bytes, so this tool and a command-line tool hashing the identical file always agree. Pasting text is different: this tool hashes exactly the characters you pasted (UTF-8 encoded), so make sure you’re comparing against a hash computed from the same exact text, including any trailing newline or whitespace.',
    },
  ],
  relatedSlugs: ['uuid-generator', 'base64-encode-decode', 'url-encode-decode'],
};
