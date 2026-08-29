'use strict';

module.exports = {
  slug: 'pdf-to-jpg-png',
  category: 'pdf',
  launchDate: '2026-08-25',
  navLabel: 'PDF to JPG/PNG',
  h1: 'Convert PDF to JPG/PNG',
  title: 'Convert PDF to JPG/PNG Free - In Your Browser | filetools',
  metaDescription: 'Turn every page of a PDF into a JPG or PNG image, free, with no upload and no sign-up. Download all pages as one zip. Your file never leaves your device.',
  deck: 'Drop a PDF and render every page as a JPG or PNG image, previewed before you download. All pages come back together in one zip file.',
  clientEntry: 'pdfToImages',
  family: 'pdf',
  folder: 'pdf',
  // Same family/plate as merge-pdf/split-pdf/rotate-pdf (PDF has its own
  // family; the OUTPUT image formats don't, so ink stays the default
  // plate color rather than pointing at a family that doesn't exist).
  // 'convert' is a combo no other pdf-family tool currently uses (merge/
  // split/rotate are their own verbs; pdf-tables-to-csv and
  // bank-statement-to-csv both set ink:'csv'), so this doesn't collide
  // with an existing mark.
  mark: { verb: 'convert' },
  maxBytes: 200 * 1024 * 1024,
  mode: 'pdf-to-images',
  fileTypeLabel: 'PDF',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Drop or choose a PDF file.',
    'Preview every page, then pick JPG or PNG as the output format.',
    'Select “Convert to images” and a zip with one image per page downloads to your device.',
  ],
  faqs: [
    {
      q: 'Do you upload my PDF anywhere?',
      answerHtml: 'No. Every page is rendered to an image entirely on your device using your browser’s own rendering engine. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'JPG or PNG - which should I choose?',
      answerHtml: 'JPG is smaller and is the better default for pages that are mostly photos or scanned color content. PNG is lossless and better for pages with sharp text or line art, where JPG’s compression can blur fine detail - at the cost of a larger file.',
    },
    {
      q: 'Why does this download one zip instead of separate image files?',
      answerHtml: 'A browser can only trigger a handful of automatic downloads at once before it starts blocking them as spam - packaging every page into one zip sidesteps that limit entirely, no matter how many pages the PDF has.',
    },
    {
      q: 'What resolution are the images?',
      answerHtml: 'Each page renders at 2x its own default PDF point size (roughly 144 DPI) - sharp enough for on-screen use and most printing, while staying reasonably sized. There’s currently no option to choose a different resolution.',
    },
    {
      q: 'What happens to password-protected PDFs?',
      answerHtml: 'A password-protected file can’t be read in the browser without its password, so it’s reported as an error rather than silently producing blank images. Remove the password first, then convert.',
    },
  ],
  relatedSlugs: ['jpg-png-to-pdf', 'split-pdf', 'extract-images-from-pdf'],
};
