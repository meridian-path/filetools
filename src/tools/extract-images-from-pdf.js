'use strict';

module.exports = {
  slug: 'extract-images-from-pdf',
  category: 'pdf',
  launchDate: '2026-08-25',
  navLabel: 'Extract Images from PDF',
  h1: 'Extract Images from PDF',
  title: 'Extract Images from PDF Free - In Your Browser | filetools',
  metaDescription: 'Pull every embedded photo or image out of a PDF and download them as PNG files, free, with no upload and no sign-up. Your file never leaves your device.',
  deck: 'Drop a PDF and every embedded image comes back as its own PNG file, all zipped together. Nothing is uploaded.',
  clientEntry: 'pdfImageExtract',
  family: 'pdf',
  folder: 'pdf',
  // Pulling multiple images out of one PDF is the same real shape as
  // pdf-split's own one-input-many-outputs operation, just extracting
  // embedded images instead of page ranges - reusing that verb glyph
  // reads correctly. Tolerated collision with pdf-split (same
  // plate/verb/ink), matching the existing precedent this codebase
  // already has for json-minify-beautify/yaml-to-json.
  mark: { verb: 'split' },
  maxBytes: 200 * 1024 * 1024,
  mode: 'extract-images',
  fileTypeLabel: 'PDF',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Drop or choose a PDF file.',
    'Wait while every page is scanned for embedded images.',
    'Select “Download images.zip” to save every extracted image as a PNG.',
  ],
  faqs: [
    {
      q: 'Do you upload my PDF anywhere?',
      answerHtml: 'No. The PDF is scanned and every image is extracted entirely on your device using your browser’s own rendering engine. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Why are the extracted images always PNG, even if the original was a JPEG?',
      answerHtml: 'A browser only ever exposes an embedded image’s already-decoded pixels, not its original compressed bytes - so there’s no way to hand back the exact original JPEG file. Saving as PNG (lossless) captures those decoded pixels exactly, rather than re-compressing them through JPEG a second time and losing more quality on top of whatever compression the image already had.',
    },
    {
      q: 'Why does this download one zip instead of separate image files?',
      answerHtml: 'A browser can only trigger a handful of automatic downloads at once before it starts blocking them as spam - packaging every image into one zip sidesteps that limit entirely, no matter how many images the PDF has.',
    },
    {
      q: 'What if a PDF has no embedded images?',
      answerHtml: 'You’ll see a plain message saying none were found, rather than an empty or broken download - a PDF made entirely of vector graphics or text (most PDFs converted straight from a word processor) usually has no embedded raster images at all.',
    },
    {
      q: 'Does this extract every kind of image?',
      answerHtml: 'It extracts every regular embedded image (the common case: photos, scans, logos placed on a page). Repeated/tiled image patterns and inline images drawn directly in the page’s own content stream are not currently extracted - a real but narrower scope cut, disclosed here rather than silently skipped.',
    },
  ],
  relatedSlugs: ['split-pdf', 'jpg-png-to-pdf', 'pdf-to-jpg-png'],
};
