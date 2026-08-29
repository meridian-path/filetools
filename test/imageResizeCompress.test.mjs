import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDimension, lockedCounterpart, outputMimeType, supportsQuality,
  sanitizeBaseName, outputFilename, MAX_DIMENSION_PX, MIN_DIMENSION_PX,
} from '../src/pure/imageResizeCompress.mjs';

test('clampDimension rounds and clamps into [MIN_DIMENSION_PX, MAX_DIMENSION_PX]', () => {
  assert.equal(clampDimension(500.4), 500);
  assert.equal(clampDimension(500.6), 501);
  assert.equal(clampDimension(0), MIN_DIMENSION_PX);
  assert.equal(clampDimension(-100), MIN_DIMENSION_PX);
  assert.equal(clampDimension(999999), MAX_DIMENSION_PX);
  assert.equal(clampDimension(MAX_DIMENSION_PX), MAX_DIMENSION_PX);
});

test('clampDimension falls back to MIN_DIMENSION_PX for a non-finite input, never throws or returns NaN', () => {
  assert.equal(clampDimension(NaN), MIN_DIMENSION_PX);
  assert.equal(clampDimension(Infinity), MIN_DIMENSION_PX);
  assert.equal(clampDimension(undefined), MIN_DIMENSION_PX);
  assert.equal(clampDimension(''), MIN_DIMENSION_PX);
});

test('lockedCounterpart preserves the source aspect ratio when width is edited', () => {
  // 4000x2000 source (2:1) -- setting width to 1000 should compute height 500.
  assert.equal(lockedCounterpart(4000, 2000, 1000, 'width'), 500);
});

test('lockedCounterpart preserves the source aspect ratio when height is edited', () => {
  assert.equal(lockedCounterpart(4000, 2000, 500, 'height'), 1000);
});

test('lockedCounterpart handles a portrait (taller-than-wide) source correctly', () => {
  // 1080x1920 source (portrait, 9:16) -- width 540 should compute height 960.
  assert.equal(lockedCounterpart(1080, 1920, 540, 'width'), 960);
});

test('lockedCounterpart clamps its computed result the same as clampDimension does', () => {
  // A 1:100 source with a huge requested width would compute an
  // out-of-range height -- must clamp, not overflow the canvas cap.
  assert.equal(lockedCounterpart(10, 1000, 7000, 'width'), MAX_DIMENSION_PX);
});

test('outputMimeType: "original" passes through a recognized source type unchanged', () => {
  assert.equal(outputMimeType('original', 'image/png'), 'image/png');
  assert.equal(outputMimeType('original', 'image/webp'), 'image/webp');
});

test('outputMimeType: "original" falls back to JPEG for a source type this tool does not treat as PNG/WebP', () => {
  assert.equal(outputMimeType('original', 'image/jpeg'), 'image/jpeg');
  assert.equal(outputMimeType('original', ''), 'image/jpeg');
});

test('outputMimeType: an explicit format choice always wins over the source type', () => {
  assert.equal(outputMimeType('png', 'image/jpeg'), 'image/png');
  assert.equal(outputMimeType('webp', 'image/png'), 'image/webp');
  assert.equal(outputMimeType('jpeg', 'image/png'), 'image/jpeg');
});

test('supportsQuality: true only for the two lossy formats, false for lossless PNG', () => {
  assert.equal(supportsQuality('image/jpeg'), true);
  assert.equal(supportsQuality('image/webp'), true);
  assert.equal(supportsQuality('image/png'), false);
});

test('sanitizeBaseName strips the extension, path separators, and ".." traversal sequences', () => {
  assert.equal(sanitizeBaseName('photo.jpg'), 'photo');
  assert.equal(sanitizeBaseName('my vacation photo.JPG'), 'my vacation photo');
  // No trailing "extension" dot for lastIndexOf('.') to split on beyond the
  // traversal sequence itself -- the important guarantee is that neither a
  // path separator nor a ".." sequence survives, not the exact leftover
  // shape, which is why this test also checks a real extension case below.
  assert.equal(sanitizeBaseName('../../etc/passwd'), '-.');
  assert.ok(!sanitizeBaseName('../../etc/passwd').includes('..'));
  assert.ok(!sanitizeBaseName('../../etc/passwd').includes('/'));
  assert.equal(sanitizeBaseName('a/b\\c.png'), 'a-b-c');
});

test('sanitizeBaseName strips control characters and caps length, with a plain fallback for nothing usable', () => {
  assert.equal(sanitizeBaseName(`bad${String.fromCharCode(7)}name.png`), 'badname');
  assert.equal(sanitizeBaseName(''), 'image');
  assert.equal(sanitizeBaseName('...'), 'image');
  const long = `${'x'.repeat(80)}.png`;
  assert.equal(sanitizeBaseName(long).length, 60);
});

test('outputFilename combines the sanitized base name with the correct extension for each output MIME type', () => {
  assert.equal(outputFilename('vacation.jpeg', 'image/jpeg'), 'vacation-resized.jpg');
  assert.equal(outputFilename('photo.png', 'image/png'), 'photo-resized.png');
  assert.equal(outputFilename('photo.jpg', 'image/webp'), 'photo-resized.webp');
  assert.equal(outputFilename('../evil.jpg', 'image/png'), '-evil-resized.png');
});
