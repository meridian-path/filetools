'use strict';

module.exports = {
  slug: 'qr-code-generator',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'QR Code Generator',
  h1: 'Generate a QR Code',
  title: 'QR Code Generator - Free, No Sign-Up | filetools',
  metaDescription: 'Turn a URL, text, or Wi-Fi network into a QR code instantly, free and in your browser. Download as PNG or SVG. Nothing is uploaded.',
  deck: 'Type a URL, plain text, or Wi-Fi network details and get a QR code instantly - no upload, no sign-up, no ads. Download it as a PNG or a scalable SVG.',
  clientEntry: 'qrCodeGenerator',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  // 'dev' (not 'text'): a genuine utility tool with no file-format input or
  // output of its own, same reasoning as uuid-generator.js/hash-generator.js.
  family: 'dev',
  folder: 'developer',
  // 'convert' is the standing default verb for every 'dev'-family utility
  // tool with no literal format-to-format conversion of its own (regex
  // tester, UUID generator, hash generator, and the rest) -- see
  // regex-tester.js's own comment on this. A bespoke "generate a QR code"
  // verb glyph would need its own hand-drawn SVG path in icons.js's
  // VERB_PATHS table, a real design addition out of this single tool
  // page's own scope.
  mark: { verb: 'convert' },
  // customPanelMode (src/pages/toolPage.js, see uuid-generator.js's own
  // comment on this flag): no file input at all, live paste-and-see
  // encoding, so this tool builds its own entire panel client-side.
  // maxBytes/accepts/multiple below are unused placeholders for the same
  // reason uuid-generator.js's are.
  customPanelMode: true,
  maxBytes: 1024,
  mode: 'qr-code-generator',
  fileTypeLabel: '',
  accepts: '',
  multiple: false,
  howSteps: [
    'Choose “Text or URL” and type or paste what you want to encode, or choose “Wi-Fi network” and fill in the network name, security type, and password.',
    'The QR code updates live as you type - no button to click. Pick an error-correction level if you need the code to keep working with a logo overlay or minor damage.',
    'Download the result as a PNG (fixed size, works everywhere) or an SVG (scales to any size with no quality loss - better for print).',
  ],
  faqs: [
    {
      q: 'Is what I type sent anywhere?',
      answerHtml: 'No. The QR code is generated entirely on your device, and nothing is sent to a server - this matters most for the Wi-Fi option, since your network password never leaves your browser. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Can I put Wi-Fi credentials in a QR code?',
      answerHtml: 'Yes - phones scan a QR code in this format and offer to join the network directly, no typing required. Because this runs entirely client-side, your password is never transmitted anywhere to generate the code - some online QR generators send the data you’re encoding to their own server first, which is a real concern for something as sensitive as a Wi-Fi password.',
    },
    {
      q: 'What do the error-correction levels (L/M/Q/H) mean?',
      answerHtml: 'A QR code stores extra, redundant data so it can still be read even if part of it is smudged, scratched, or covered by a logo. Low keeps about 7% of the code recoverable, Medium about 15%, Quartile about 25%, and High about 30%. Higher levels tolerate more damage but need a denser code (more modules) to hold the same content, which can make the code harder to scan at very small print sizes - Medium is a reasonable default for most uses; High is worth it only if you plan to add a logo or expect wear.',
    },
    {
      q: 'Is there a size limit on what I can encode?',
      answerHtml: 'A QR code tops out at 2,953 bytes even at the largest size and lowest error-correction level, and this tool caps input below that so a refusal always comes with a clear message rather than a confusing library error. In practice, a URL or a short message uses only a small fraction of that - if you’re hitting the limit, a shortened URL usually solves it.',
    },
    {
      q: 'Will this scan reliably if I print it small?',
      answerHtml: 'A denser code (more content, or a higher error-correction level) needs more physical size to stay scannable, since each individual module has to stay large enough for a camera to resolve clearly - as a rule of thumb, keep the printed code at least an inch across for a short URL, and larger for longer content or a busier error-correction level. The SVG download is the safer choice for print, since it scales to any size with no blur.',
    },
    {
      q: 'PNG or SVG - which should I download?',
      answerHtml: 'PNG is a fixed-resolution image - simplest for pasting into a slide deck, chat, or anywhere a plain image works. SVG is a vector format that scales to any size (a business card or a poster) with perfectly sharp edges, which matters more for a QR code than most images since a blurry module can make it unscannable.',
    },
  ],
  relatedSlugs: ['uuid-generator', 'hash-generator', 'url-encode-decode'],
};
