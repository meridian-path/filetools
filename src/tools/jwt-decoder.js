'use strict';

module.exports = {
  slug: 'jwt-decoder',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'JWT Decoder',
  h1: 'Decode a JWT',
  title: 'JWT Decoder - Decode JSON Web Tokens Online | filetools',
  metaDescription: 'Paste a JWT and see its decoded header, payload, and expiry, free and in your browser. No upload, no signature check, nothing sent anywhere.',
  deck: 'Paste a JWT and see its header, payload, and expiry decoded instantly. This tool reads a token - it never verifies one, and says so plainly.',
  clientEntry: 'jwtDecode',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'dev',
  folder: 'developer',
  // No dedicated verb glyph exists for "decode" - reusing 'convert', the
  // same generic transformation pip base64-encode-decode.js (this tool's
  // own closest sibling) already uses for the same reason: a JWT's encoded
  // form becomes its decoded form, which is what 'convert' already reads as.
  mark: { verb: 'convert' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): paste-and-see, no file input, no upload step -
  // this tool builds its own live single-textarea panel client-side.
  // maxBytes/accepts/multiple below are unused placeholders for the same
  // reason uuid-generator.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'jwt-decoder',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Paste a JWT into the box (or start from the pre-filled example) - the three dot-separated parts are header, payload, and signature.',
    'The header and payload decode immediately as you type, along with a plain-English read on any expires/issued-at/not-valid-before claims.',
    'The signature segment is shown as-is - this tool has no key to check it against, so it is never marked valid or invalid.',
  ],
  faqs: [
    {
      q: 'Is my token sent anywhere?',
      answerHtml: 'No. The token is decoded entirely on your device, and nothing is sent to a server - there’s no upload step at all. Turn off your Wi-Fi after the page loads and it still works. That said, a JWT often carries real identity or session claims, so avoid pasting a live production token into any tool - including this one - if you don’t need to.',
    },
    {
      q: 'What do "alg" and "typ" in the header mean?',
      answerHtml: '<code>typ</code> just labels the token’s type, almost always <code>JWT</code>. <code>alg</code> names the signing algorithm the issuer used - commonly <code>HS256</code> (a shared secret) or <code>RS256</code> (a public/private key pair). Neither field is checked or acted on by this tool - they’re shown exactly as decoded.',
    },
    {
      q: 'Does this verify the signature?',
      answerHtml: 'No, and this is the most important thing to understand about this tool. A JWT’s header and payload are just base64url-encoded text with no secret involved, so reading them back needs no key - anyone can decode them, which is also why a JWT should never be used to hold a secret directly. The signature exists specifically so a party holding the right key can confirm the token wasn’t tampered with. This tool has no key and makes no attempt to check it - the signature segment is shown as raw text, never labeled valid or invalid.',
    },
    {
      q: 'What does an expired token look like here?',
      answerHtml: 'If the payload has an <code>exp</code> claim, it’s shown with its real date and time alongside a plain “expired” or “not yet expired” label, computed against your device’s own clock at the moment you view it. The same treatment applies to <code>nbf</code> (not valid before) and <code>iat</code> (issued at) when present. These are Unix time in SECONDS, not milliseconds - a common source of off-by-1000x mistakes when checking one by hand, which is exactly what this decoding avoids.',
    },
    {
      q: 'What happens if I paste something that is not a valid JWT?',
      answerHtml: 'You get a specific message naming the real problem - wrong number of dot-separated parts, invalid base64url text, or a segment that decodes but isn’t valid JSON - rather than a blank result or a generic error.',
    },
  ],
  relatedSlugs: ['base64-encode-decode', 'json-diff', 'url-encode-decode'],
};
