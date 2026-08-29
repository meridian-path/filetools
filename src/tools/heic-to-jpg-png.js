'use strict';

module.exports = {
  slug: 'heic-to-jpg-png',
  category: 'data',
  launchDate: '2026-08-28',
  navLabel: 'HEIC to JPG/PNG',
  h1: 'Convert HEIC to JPG or PNG',
  title: 'Convert HEIC to JPG/PNG Free - In Your Browser | filetools',
  metaDescription: 'Convert iPhone HEIC photos to JPG or PNG, free, with no upload and no sign-up. Batch-convert multiple photos at once. Your photos never leave your device.',
  deck: 'Drop one or more HEIC photos from your iPhone and convert them to JPG or PNG, right in your browser. Nothing is uploaded, so there’s no daily limit and no account.',
  clientEntry: 'heicToImages',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  // 'image' (craft-audit fix, 2026-08-29 reference-library audit):
  // originally filed under 'dev' as the same encoding/format-conversion
  // shape as base64/url-encode/html-entity, but this tool's own real
  // audience is an iPhone photo owner, not a developer, and its own deck
  // already says so ("Drop one or more HEIC photos from your iPhone...") -
  // a visitor scanning folders for an image tool was never going to open
  // Developer to find it. Moved alongside image-resize-compress.js, this
  // site's other genuine image-manipulation tool. Display/breadcrumb only -
  // the page's own URL (/data/heic-to-jpg-png/) is unchanged, no redirect
  // risk.
  family: 'image',
  folder: 'image',
  mark: { verb: 'convert' },
  // HEIC's whole point is efficient compression, so a real iPhone photo is
  // usually well under this -- same generous single-image ceiling
  // jpg-png-to-pdf.js already uses for JPG/PNG input.
  maxBytes: 20 * 1024 * 1024,
  mode: 'heic-to-images',
  fileTypeLabel: 'HEIC image',
  // MIME type is unreliable for HEIC across browser/OS combinations (many
  // report an empty file.type for it) -- extensions are the real backstop,
  // same reasoning as dropzone.client.js's own fileMatchesAccept() header
  // comment. .heif covers the same container format under its other common
  // extension.
  accepts: 'image/heic,image/heif,.heic,.heif',
  multiple: true,
  howSteps: [
    'Drop or choose one or more .heic/.heif photos.',
    'Pick JPG or PNG as the output format.',
    'Select “Convert” and your image (or a zip of all of them) downloads to your device.',
  ],
  faqs: [
    {
      q: 'Do you upload my photos anywhere?',
      answerHtml: 'No. Every photo is decoded and converted entirely on your device, in your browser. Turn off your Wi-Fi after the page loads and it still works - nothing is sent to a server, so there’s no daily conversion limit and no account to create.',
    },
    {
      q: 'What is HEIC, and why do my iPhone photos use it?',
      answerHtml: 'HEIC (High Efficiency Image Container) is the photo format iPhones have saved to by default since iOS 11 - it stores the same image quality as a JPG in roughly half the file size. Most non-Apple software, and many older apps and websites, can’t open it directly, which is the usual reason to convert.',
    },
    {
      q: 'JPG or PNG - which should I choose?',
      answerHtml: 'JPG is smaller and is the right default for ordinary photos. PNG is lossless (no compression artifacts) but produces a much larger file for a photo - better suited to screenshots or images with sharp text or line art than to camera photos.',
    },
    {
      q: 'Does this keep my photo’s metadata (location, date taken)?',
      answerHtml: 'No. The converted JPG/PNG has none of the original HEIC’s metadata - this tool is built for viewing/sharing compatibility, not for archiving. Keep the original HEIC file if you need to preserve that information.',
    },
    {
      q: 'Why does converting several photos at once download a zip instead of separate files?',
      answerHtml: 'A browser can only trigger a handful of automatic downloads at once before it starts blocking them as spam - packaging every converted photo into one zip sidesteps that limit entirely, no matter how many you convert.',
    },
    {
      q: 'What about "Live Photos" or burst shots saved as HEIC?',
      answerHtml: 'This tool converts the single still image in each file. A HEIC file that bundles multiple frames (a burst or the motion part of a Live Photo) only produces its first frame as JPG/PNG - the rest isn’t currently extracted.',
    },
  ],
  relatedSlugs: ['jpg-png-to-pdf', 'pdf-to-jpg-png', 'image-resize-compress'],
};
