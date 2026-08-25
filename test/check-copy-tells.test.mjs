import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCopyTells } from '../scripts/check-copy-tells.js';

// ---------------------------------------------------------------------------
// Simple literal phrases (design-standards.md item 3's canonical list)
// ---------------------------------------------------------------------------

test('findCopyTells: catches "seamlessly" in a <p> element', () => {
  const html = '<p>Convert your files seamlessly, right in your browser.</p>';
  const hits = findCopyTells(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /seamlessly/);
});

test('findCopyTells: catches "effortlessly"', () => {
  const html = '<p>Merge PDFs effortlessly.</p>';
  const hits = findCopyTells(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /effortlessly/);
});

test('findCopyTells: catches "robust" as filler', () => {
  const html = '<p>A robust conversion pipeline you can rely on.</p>';
  const hits = findCopyTells(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /robust/);
});

test('findCopyTells: catches "delve"', () => {
  const html = "<p>Let's delve into what makes this tool different.</p>";
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /delve/.test(h)));
});

test('findCopyTells: catches "unlock the power of"', () => {
  const html = '<p>Unlock the power of client-side conversion.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /unlock the power of/.test(h)));
});

test('findCopyTells: catches "cutting-edge"', () => {
  const html = '<p>Built on cutting-edge browser APIs.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /cutting-edge/.test(h)));
});

test('findCopyTells: catches "when it comes to"', () => {
  const html = '<p>When it comes to privacy, nothing leaves your device.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /when it comes to/.test(h)));
});

test('findCopyTells: passes clean, plain-voiced copy', () => {
  const html = '<p>Drop a file to convert it. Nothing leaves your device.</p>';
  assert.deepEqual(findCopyTells(html), []);
});

// ---------------------------------------------------------------------------
// Regex-shaped tells
// ---------------------------------------------------------------------------

test('findCopyTells: catches "plays a crucial/vital/pivotal role"', () => {
  const html = '<p>Compression plays a crucial role in fast uploads.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /crucial\/vital\/pivotal role/.test(h)));
});

test('findCopyTells: catches "whether you\'re X or Y" framing', () => {
  const html = "<p>Whether you're a student or a professional, this tool works for you.</p>";
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /whether you're X or Y/.test(h)));
});

test('findCopyTells: catches "it\'s not X, it\'s Y" antithesis framing', () => {
  const html = "<p>It's not just a converter, it's a whole workflow.</p>";
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /antithesis framing/.test(h)));
});

test('findCopyTells: does not false-positive an unrelated "it\'s" sentence', () => {
  const html = "<p>It's free and it runs entirely in your browser.</p>";
  const hits = findCopyTells(html);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Exclamation-point enthusiasm (page-wide accumulation)
// ---------------------------------------------------------------------------

test('findCopyTells: catches multiple "!" across a page as exclamation enthusiasm', () => {
  const html = '<p>Fast! Free! Private!</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /exclamation-point enthusiasm/.test(h)));
});

test('findCopyTells: does not flag a single "!" on an otherwise plain page', () => {
  const html = '<p>Drop a file to get started!</p>';
  const hits = findCopyTells(html);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Hedge-stacking
// ---------------------------------------------------------------------------

test('findCopyTells: catches two-or-more hedge words piled into one chunk', () => {
  const html = '<p>This might potentially help, but results could possibly vary.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /hedge-stacking/.test(h)));
});

test('findCopyTells: does not flag a single hedge word used normally', () => {
  const html = '<p>This might not work in every browser.</p>';
  const hits = findCopyTells(html);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Process-talk markers
// ---------------------------------------------------------------------------

test('findCopyTells: catches an internal task-id leaked into rendered copy', () => {
  const html = '<p>Fixed per task-mt6jcfwr-ed62cc last week.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /internal id "task-mt6jcfwr-ed62cc"/.test(h)));
});

test('findCopyTells: catches a leaked decision-id', () => {
  const html = '<p>See decision-mt3eshmp-4a3058 for the reasoning.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /internal id "decision-mt3eshmp-4a3058"/.test(h)));
});

test('findCopyTells: catches internal role-vocabulary phrases', () => {
  const html = '<p>Escalated to chief-of-staff for a decision brief.</p>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /process-talk marker "chief-of-staff"/.test(h)));
  assert.ok(hits.some((h) => /process-talk marker "decision brief"/.test(h)));
});

test('findCopyTells: does not false-positive on the ordinary word "builder" alone', () => {
  const html = '<p>Use our PDF builder to combine files.</p>';
  const hits = findCopyTells(html);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Head/meta surfaces (title + content=/alt=/aria-label= attributes)
// ---------------------------------------------------------------------------

test('findCopyTells: catches a tell in <title> text content', () => {
  const html = '<html><head><title>filetools - effortlessly convert files</title></head><body></body></html>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /\(title\)/.test(h)));
});

test('findCopyTells: catches a tell in a meta description content= attribute', () => {
  const html = '<meta name="description" content="Seamlessly convert files, free and private.">';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /\(attribute\)/.test(h)));
});

test('findCopyTells: catches a tell in an alt= attribute', () => {
  const html = '<img src="/screenshot.png" alt="A robust conversion workflow, step by step">';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /\(attribute\)/.test(h)));
});

test('findCopyTells: catches a tell in an aria-label= attribute', () => {
  const html = '<button aria-label="Effortlessly close this dialog">X</button>';
  const hits = findCopyTells(html);
  assert.ok(hits.some((h) => /\(attribute\)/.test(h)));
});

// ---------------------------------------------------------------------------
// Multiple hits, one per offending location
// ---------------------------------------------------------------------------

test('findCopyTells: reports one hit per offending location, not per file', () => {
  const html = [
    '<title>Seamlessly convert files</title>',
    '<p>Effortlessly merge PDFs.</p>',
    '<meta name="description" content="A robust free tool.">',
  ].join('\n');
  assert.equal(findCopyTells(html).length, 3);
});
