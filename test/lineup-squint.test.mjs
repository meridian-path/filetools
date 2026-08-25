import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readCompetitorScreenshots,
  toDataUri,
  buildLineupHtml,
  buildSquintHtml,
  escapeHtml,
  escapeAttr,
  DEFAULT_BLUR_PX,
} from '../scripts/lineup-squint.js';

// ---------------------------------------------------------------------------
// readCompetitorScreenshots
// ---------------------------------------------------------------------------

function makeTempDirWithFiles(names) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-squint-test-'));
  for (const name of names) fs.writeFileSync(path.join(dir, name), 'stub');
  return dir;
}

test('readCompetitorScreenshots: throws when the directory does not exist', () => {
  assert.throws(
    () => readCompetitorScreenshots(path.join(os.tmpdir(), 'definitely-does-not-exist-xyz')),
    /not found/,
  );
});

test('readCompetitorScreenshots: throws when fewer than 2 images are present', () => {
  const dir = makeTempDirWithFiles(['one.png']);
  assert.throws(() => readCompetitorScreenshots(dir), /at least 2/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readCompetitorScreenshots: returns a sorted, humanized label per image, ignoring non-image files', () => {
  const dir = makeTempDirWithFiles([
    'zzz-tool.png',
    'aaa-tool.jpg',
    'readme.md',
    'notes.txt',
  ]);
  const result = readCompetitorScreenshots(dir);
  assert.equal(result.length, 2);
  assert.equal(result[0].label, 'aaa tool');
  assert.equal(result[1].label, 'zzz tool');
  assert.ok(result[0].absPath.endsWith('aaa-tool.jpg'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readCompetitorScreenshots: does not recurse into subdirectories', () => {
  const dir = makeTempDirWithFiles(['a.png', 'b.png']);
  fs.mkdirSync(path.join(dir, 'nested'));
  fs.writeFileSync(path.join(dir, 'nested', 'c.png'), 'stub');
  const result = readCompetitorScreenshots(dir);
  assert.equal(result.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// toDataUri
// ---------------------------------------------------------------------------

test('toDataUri: encodes a PNG file as a base64 data: URI with the right MIME type', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-squint-test-'));
  const file = path.join(dir, 'x.png');
  fs.writeFileSync(file, Buffer.from([1, 2, 3]));
  const uri = toDataUri(file);
  assert.match(uri, /^data:image\/png;base64,/);
  assert.equal(uri, `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('toDataUri: uses image/jpeg for .jpg and .jpeg files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lineup-squint-test-'));
  const file = path.join(dir, 'x.jpeg');
  fs.writeFileSync(file, Buffer.from([9]));
  assert.match(toDataUri(file), /^data:image\/jpeg;base64,/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// buildLineupHtml / buildSquintHtml
// ---------------------------------------------------------------------------

test('buildLineupHtml: renders one grid column per entry, in the given order', () => {
  const html = buildLineupHtml([
    { label: 'ours', src: 'data:image/png;base64,AAAA' },
    { label: 'competitor one', src: 'data:image/png;base64,BBBB' },
    { label: 'competitor two', src: 'data:image/png;base64,CCCC' },
  ]);
  assert.match(html, /grid-template-columns: repeat\(3, 1fr\)/);
  assert.match(html, /alt="ours"/);
  assert.match(html, /alt="competitor one"/);
  assert.match(html, /alt="competitor two"/);
  // Order preserved: "ours" appears before "competitor two" in the markup.
  assert.ok(html.indexOf('alt="ours"') < html.indexOf('alt="competitor two"'));
});

test('buildLineupHtml: escapes a label containing HTML-significant characters', () => {
  const html = buildLineupHtml([{ label: '<script>alert(1)</script> & "quote"', src: 'data:image/png;base64,AA' }]);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});

test('buildSquintHtml: applies the default blur radius when none is given', () => {
  const html = buildSquintHtml('data:image/png;base64,AAAA');
  assert.match(html, new RegExp(`filter: blur\\(${DEFAULT_BLUR_PX}px\\)`));
});

test('buildSquintHtml: applies a custom blur radius', () => {
  const html = buildSquintHtml('data:image/png;base64,AAAA', 42);
  assert.match(html, /filter: blur\(42px\)/);
});

// ---------------------------------------------------------------------------
// escapeHtml / escapeAttr
// ---------------------------------------------------------------------------

test('escapeHtml: escapes &, <, > only', () => {
  assert.equal(escapeHtml('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d "e"');
});

test('escapeAttr: escapes &, ", <, > for safe use inside a double-quoted attribute', () => {
  assert.equal(escapeAttr('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
});
