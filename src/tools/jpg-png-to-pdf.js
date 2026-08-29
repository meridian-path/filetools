'use strict';

module.exports = {
  slug: 'jpg-png-to-pdf',
  category: 'pdf',
  launchDate: '2026-08-25',
  navLabel: 'JPG/PNG to PDF',
  h1: 'Convert JPG/PNG to PDF',
  title: 'Convert JPG/PNG to PDF Free - In Your Browser | filetools',
  metaDescription: 'Combine JPG and PNG images into a single PDF, free, with no upload and no sign-up. Reorder images before converting. Your files never leave your device.',
  deck: 'Choose or drop one or more JPG/PNG images, put them in order, and download a single PDF - one page per image.',
  clientEntry: 'imagesToPdf',
  // Registration fragment -- see src/tools/pdf-merge.js's comment above
  // its own `family` field for what these mean.
  family: 'pdf',
  folder: 'pdf',
  // 'merge' (not 'convert'): combining multiple source files into one
  // output is the same real shape as merge-pdf's own operation, just with
  // image sources instead of PDF sources -- reusing that verb glyph reads
  // correctly rather than reaching for a new one.
  mark: { verb: 'merge' },
  maxBytes: 20 * 1024 * 1024,
  mode: 'images-to-pdf',
  fileTypeLabel: 'JPG or PNG image',
  accepts: 'image/jpeg,image/png,.jpg,.jpeg,.png',
  multiple: true,
  howSteps: [
    'Choose or drop one or more JPG/PNG images.',
    'Drag the images (or use the up/down buttons) to set the order they should appear as pages.',
    'Select “Convert to PDF” and the combined file downloads straight to your device.',
  ],
  faqs: [
    {
      q: 'Do you upload my images anywhere?',
      answerHtml: 'No. Every image is read and drawn into the PDF entirely on your device using your browser’s own processing power. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Can I mix JPG and PNG files in the same PDF?',
      answerHtml: 'Yes. Choose or drop any mix of .jpg and .png files - each becomes its own page, in the order you set, regardless of which format it started as.',
    },
    {
      q: 'What page size does each image get?',
      answerHtml: 'Each PDF page matches its own image’s aspect ratio exactly, sized at 144 DPI (144 image pixels per inch of page), so nothing is cropped, stretched, or padded with blank margins - a portrait photo gets a portrait page, a landscape photo gets a landscape page, sized reasonably for printing or viewing at actual size.',
    },
    {
      q: 'Is there a limit on how many images I can convert?',
      answerHtml: 'No hard limit from this tool - since everything runs in your browser rather than on a server, the only real limit is your device’s own memory. Each individual image is capped at 20MB.',
    },
    {
      q: 'Does converting reduce image quality?',
      answerHtml: 'No. Each image’s original pixel data is embedded in the PDF as-is - nothing is re-compressed or re-encoded, so the result looks identical to the source images.',
    },
  ],
  relatedSlugs: ['pdf-to-jpg-png', 'heic-to-jpg-png', 'merge-pdf', 'split-pdf'],
};
