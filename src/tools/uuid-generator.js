'use strict';

module.exports = {
  slug: 'uuid-generator',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-23',
  navLabel: 'UUID Generator',
  h1: 'Generate UUIDs',
  title: 'UUID / GUID Generator - v1, v4, v5, v7 | filetools',
  metaDescription: 'Generate UUID v1, v4, v5, and v7 identifiers, one at a time or up to 1,000 at once, free and in your browser. No upload, no sign-up.',
  deck: 'Pick a UUID version and how many you need, and get ready-to-use UUIDs instantly - one at a time or up to 1,000 at once.',
  clientEntry: 'uuidGenerator',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  // Craft-audit fix (item 7): was 'text' -- see regex-tester.js's own
  // comment on this same field for the full rationale.
  family: 'dev',
  folder: 'developer',
  mark: { verb: 'convert' },
  // customPanelMode (src/pages/toolPage.js): this tool has no FILE input
  // at all -- it produces UUIDs from options alone -- so the fields below
  // that every other (file/paste-driven) tool relies on are either unused
  // placeholders or simply not applicable. maxBytes/accepts/multiple stay
  // present only because src/browserClients.js requires a numeric maxBytes
  // for any tool that declares a clientEntry; toolPage.js's isCustomPanel
  // branch never renders the dropzone/file-input markup that would
  // otherwise read accepts/multiple/fileTypeLabel/pasteInput.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'uuid-generator',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Pick a UUID version - v4 for ordinary random IDs, v7 for time-ordered IDs that sort and index well, v1 for classic time-based IDs, or v5 to hash a namespace and name into a deterministic ID.',
    'Set how many you need, from 1 up to 1,000 at once. The list re-renders instantly whenever you change the version or count.',
    'Copy the whole list or download it as a .txt file, one UUID per line.',
  ],
  faqs: [
    {
      q: 'Is anything sent to a server?',
      answerHtml: 'No. Every UUID is generated entirely on your device using your browser’s own cryptographically secure random number generator, and nothing is sent anywhere. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Which UUID version should I use?',
      answerHtml: 'For most new IDs, v4 (fully random) or v7 (time-ordered, so IDs created later sort after IDs created earlier - useful as a database primary key) are the common defaults. Use v1 if you specifically need the older time-based format some existing systems expect. Use v5 if you need the exact same input (a namespace plus a name, like a URL or domain) to always produce the exact same UUID - useful for deduplicating or cross-referencing records by a stable identifier instead of generating a new random one every time.',
    },
    {
      q: 'How is the v1 UUID different from a "real" v1 generator?',
      answerHtml: 'RFC 4122’s v1 format was designed around a device’s real network (MAC) address and a clock sequence persisted across calls, to keep IDs unique even if the clock moves backward. This tool has neither a MAC address to read nor anywhere to persist state between page loads, so - as the RFC itself allows as an alternative - it uses a fresh, randomly generated node ID (with the bit set that marks it as not a real MAC address) and a fresh random clock sequence on every UUID. Combined with the timestamp, that still makes a collision astronomically unlikely, but it is not a drop-in replacement for a long-running server’s stateful v1 generator.',
    },
    {
      q: 'What namespace should I use for a v5 UUID?',
      answerHtml: 'RFC 4122 defines four standard namespaces for common input types - DNS (for domain names), URL, OID, and X.500 - all offered here as presets. If you’re hashing something else entirely (an internal system’s own identifier scheme, for example), enter that system’s own namespace UUID as a custom namespace instead; the important thing is that everyone hashing the same kind of name uses the same namespace, since the namespace is part of what gets hashed.',
    },
    {
      q: 'Are these UUIDs unique?',
      answerHtml: 'Practically, yes. A v4 UUID has 122 random bits - even generating billions of them, the odds of two ever matching are negligible. v1 and v7 add a real timestamp on top of similar randomness. v5 is the one deliberate exception: it’s a hash, so the exact same namespace and name always produce the exact same UUID on purpose, which is the point of using it.',
    },
  ],
  relatedSlugs: ['hash-generator', 'base64-encode-decode', 'url-encode-decode', 'qr-code-generator'],
};
