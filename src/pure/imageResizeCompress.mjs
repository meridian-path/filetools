/**
 * Pure resize/compress math for the Image Resize/Compress tool -- no DOM,
 * no canvas. The actual pixel drawing (canvas drawImage/toBlob) lives in
 * ../browser/imageResizeCompress.client.js; this module holds everything
 * about that flow that's real computation rather than DOM manipulation, so
 * it stays unit-testable without a browser.
 */

/**
 * Ceiling on a resized dimension, per side. A canvas this large already
 * holds a 256-megapixel RGBA buffer (8000 x 8000 x 4 bytes = ~256MB) --
 * generous for any real photo (even a 61MP camera photo tops out around
 * 9504x6336, and this tool only ever shrinks or holds steady, never
 * upscales past the source) while still refusing an unbounded value (a
 * stray extra digit typed into the width field) that would otherwise try
 * to allocate an oversized canvas and freeze the tab -- the same class of
 * explicit input-size cap SECURITY_STANDARDS.md's hand-written-parser rule
 * asks for, applied here to a canvas allocation instead of a text parser.
 */
export const MAX_DIMENSION_PX = 8000;
export const MIN_DIMENSION_PX = 1;

const FORMAT_MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * @param {number} n
 * @returns {number} `n` rounded to the nearest whole pixel and clamped to
 *   [MIN_DIMENSION_PX, MAX_DIMENSION_PX]. A non-finite input (an emptied
 *   number field, `NaN` from a bad paste) falls back to
 *   MIN_DIMENSION_PX rather than propagating NaN into a canvas call.
 */
export function clampDimension(n) {
  const rounded = Math.round(Number(n));
  if (!Number.isFinite(rounded)) return MIN_DIMENSION_PX;
  return Math.min(MAX_DIMENSION_PX, Math.max(MIN_DIMENSION_PX, rounded));
}

/**
 * @param {number} srcWidth the source image's natural width.
 * @param {number} srcHeight the source image's natural height.
 * @param {number} value the dimension the visitor just edited.
 * @param {'width'|'height'} axis which dimension `value` is.
 * @returns {number} the OTHER dimension, scaled to preserve the source
 *   image's own aspect ratio, clamped/rounded via clampDimension().
 */
export function lockedCounterpart(srcWidth, srcHeight, value, axis) {
  const ratio = srcHeight / srcWidth;
  const v = clampDimension(value);
  return axis === 'width' ? clampDimension(v * ratio) : clampDimension(v / ratio);
}

/**
 * @param {'original'|'jpeg'|'png'|'webp'} formatChoice the visitor's output
 *   format choice.
 * @param {string} sourceMimeType the dropped file's own `File.type`.
 * @returns {string} the real MIME type to pass to canvas.toBlob().
 *   'original' resolves to the source's own type when it's one this tool
 *   recognizes (PNG or WebP), falling back to JPEG otherwise -- the
 *   fallback is never actually reachable for a file that passed the
 *   dropzone's own `accepts` restriction to jpeg/png/webp, but keeps this
 *   function total for any input rather than returning undefined.
 */
export function outputMimeType(formatChoice, sourceMimeType) {
  if (formatChoice === 'original') {
    return sourceMimeType === 'image/png' || sourceMimeType === 'image/webp' ? sourceMimeType : 'image/jpeg';
  }
  return FORMAT_MIME[formatChoice] || 'image/jpeg';
}

/**
 * @param {string} mimeType a resolved output MIME type.
 * @returns {boolean} whether a quality slider is meaningful for this
 *   format. PNG is always lossless -- canvas.toBlob() silently ignores a
 *   quality argument for it, so the UI hides the control rather than
 *   showing one that does nothing.
 */
export function supportsQuality(mimeType) {
  return mimeType === 'image/jpeg' || mimeType === 'image/webp';
}

/** See ../pure/splitCsv.mjs's own MAX_BASE_NAME_LENGTH comment -- same
 * reasoning, duplicated here rather than imported (this codebase's
 * standing convention for small per-tool helpers -- see
 * src/pages/toolPage.js's MAX_BYTES_BY_CLIENT comment for the same
 * accepted-duplication reasoning applied elsewhere). */
const MAX_BASE_NAME_LENGTH = 60;

/** Lowest character code kept by sanitizeBaseName's control-character
 * filter -- a plain space is 32, so this drops everything below it (the
 * C0 control block) without needing a regex escape-range literal in this
 * file's source. */
const MIN_KEPT_CHAR_CODE = 32;

/** The one control character above the C0 block that also needs
 * stripping (DEL). */
const DEL_CHAR_CODE = 127;

/**
 * @param {string} name a visitor-supplied file name -- untrusted input.
 * @returns {string} a name safe to use as the base of a generated download
 *   filename: extension removed, path separators and '..' sequences and
 *   control characters stripped, length capped, with a plain fallback when
 *   nothing usable remains. Same behavior as ../pure/splitCsv.mjs's own
 *   sanitizeBaseName -- the stripping is deliberate security hygiene
 *   (SECURITY_STANDARDS.md: "download filenames generated from untrusted
 *   input strip path separators, '..', and control characters, and cap
 *   length"), not cosmetics.
 */
export function sanitizeBaseName(name) {
  let base = String(name == null ? '' : name);
  const lastDot = base.lastIndexOf('.');
  if (lastDot >= 0) base = base.slice(0, lastDot);
  base = base
    .replace(/[/\\]/g, '-')
    .replace(/\.\./g, '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= MIN_KEPT_CHAR_CODE && code !== DEL_CHAR_CODE;
    })
    .join('')
    .trim();
  if (base.length > MAX_BASE_NAME_LENGTH) base = base.slice(0, MAX_BASE_NAME_LENGTH);
  return base || 'image';
}

/**
 * @param {string} originalName the dropped file's own `File.name`.
 * @param {string} mimeType the resolved output MIME type.
 * @returns {string} a safe, descriptive download filename.
 */
export function outputFilename(originalName, mimeType) {
  const base = sanitizeBaseName(originalName);
  const ext = MIME_EXT[mimeType] || 'jpg';
  return `${base}-resized.${ext}`;
}
