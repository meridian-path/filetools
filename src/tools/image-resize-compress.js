'use strict';

module.exports = {
  slug: 'image-resize-compress',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-29',
  navLabel: 'Image Resize/Compress',
  h1: 'Resize or Compress an Image',
  title: 'Resize & Compress Images Free - In Your Browser | filetools',
  metaDescription: 'Resize a JPG, PNG, or WebP image and compress it with a live quality preview, free and in your browser. No upload, no sign-up required.',
  deck: 'Drop a JPG, PNG, or WebP image, set a new width or height, and adjust the output quality - the preview and file size update live as you go.',
  clientEntry: 'imageResizeCompress',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  //
  // TAXONOMY DECISION (soak-backlog pass 1, item 5's own flag): 'image' is
  // a new family/folder, not folded into 'dev' the way heic-to-jpg-png is.
  // This is this repo's first image-*manipulation* tool (it reshapes an
  // image's dimensions and file size); heic-to-jpg-png/jpg-png-to-pdf/
  // pdf-to-jpg-png are all image-*conversion* (one container format to
  // another, pixels untouched), a genuinely different operation. 'dev'
  // folding is a real, working pattern for a tool with no format family of
  // its own to draw from (see hash-generator.js's comment) -- but an image
  // that gets reshaped, with real future siblings named in the backlog
  // (crop, rotate, watermark) that would want the same home, earns its own
  // family/folder rather than being a second workaround layered on the
  // first. See src/families.js/src/folders.js/src/tokens.js/src/icons.js
  // for the rest of what this new family touches.
  family: 'image',
  folder: 'image',
  mark: { verb: 'resize' },
  maxBytes: 20 * 1024 * 1024,
  mode: 'image-resize-compress',
  fileTypeLabel: 'image',
  accepts: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  multiple: false,
  // sampleInput: see pdf-merge.js's comment above its own `family` field.
  sampleInput: {
    label: 'sample photo',
    files: [{ filename: 'sample-photo.jpg', mimeType: 'image/jpeg' }],
  },
  howSteps: [
    'Drop or choose a JPG, PNG, or WebP image.',
    'Set a new width or height (locked to the original aspect ratio by default), pick an output format, and adjust the quality slider.',
    'The preview and file size update live as you adjust the settings - download the result once you’re happy with it.',
  ],
  faqs: [
    {
      q: 'Is my photo sent anywhere?',
      answerHtml: 'No. Your image is decoded, resized, and re-encoded entirely on your device using your browser’s own canvas - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What does “lock aspect ratio” do?',
      answerHtml: 'With it on, changing the width automatically recalculates the height (and vice versa) to match your original photo’s proportions, so the result never looks stretched or squashed. Turn it off to set an exact width and height independently - useful for a fixed-size upload requirement, at the cost of possible distortion if the new proportions differ a lot from the original.',
    },
    {
      q: 'JPG, PNG, or WebP - which output format should I choose?',
      answerHtml: '“Keep original” re-encodes into the same format you dropped in, which is the safest default. JPG is the smallest choice for an ordinary photo but discards fine detail at lower quality settings. PNG is lossless - no quality slider needed - but produces a much larger file for a photo, better suited to screenshots or images with transparency. WebP typically beats JPG at the same visual quality and, unlike JPG, supports transparency too - the best choice when you know the place you’re using the image supports it.',
    },
    {
      q: 'What does the quality slider actually control?',
      answerHtml: 'For JPG and WebP (both lossy formats), quality controls how much detail is thrown away to shrink the file - higher keeps more detail and produces a larger file, lower discards more and produces a smaller one. It has no effect on PNG, which is always lossless, so the slider hides itself when PNG is selected rather than showing a control that would do nothing.',
    },
    {
      q: 'Is there a size or dimension limit?',
      answerHtml: 'Each image is capped at 20MB, and width/height are each capped at 8,000 pixels - generous for any real camera photo (even a 61-megapixel photo tops out around 9,504×6,336, and this tool only ever shrinks or holds steady, never enlarges past your original). The caps exist so a mistyped dimension can’t try to allocate a canvas large enough to freeze your browser tab.',
    },
    {
      q: 'Does resizing reduce image quality?',
      answerHtml: 'Shrinking a photo (fewer pixels) is effectively lossless in the sense that nothing is guessed or invented - you’re just keeping fewer of the original pixels, resampled smoothly. The lossy part, if any, comes from the output format and quality setting you choose afterward, not from the resize itself. This tool never enlarges an image past its original dimensions, since upscaling only stretches existing pixels rather than adding real detail.',
    },
  ],
  relatedSlugs: ['heic-to-jpg-png', 'jpg-png-to-pdf', 'pdf-to-jpg-png'],
};
