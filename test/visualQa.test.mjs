import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isHttpUrl, pageNameFor, formatScoreSummary, findSiteRoot } from '../scripts/visual-qa.js';

// ---------------------------------------------------------------------------
// findSiteRoot: regression coverage for the real bug this fixed -- the
// throwaway local screenshot server used to be rooted at a target page's
// OWN parent directory, which broke this site's root-relative /js/...
// asset paths for any nested tool page. See this function's own header
// comment in scripts/visual-qa.js for the full story.
// ---------------------------------------------------------------------------

function makeTempSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-qa-test-'));
  fs.mkdirSync(path.join(root, 'js'));
  fs.mkdirSync(path.join(root, 'data', 'some-tool'), { recursive: true });
  fs.writeFileSync(path.join(root, 'js', 'foo.client.js'), '// stub');
  fs.writeFileSync(path.join(root, 'data', 'some-tool', 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
  return root;
}

test('findSiteRoot: walks up from a nested tool page to the ancestor directory that actually has a js/ sibling', () => {
  const root = makeTempSite();
  const nestedDir = path.join(root, 'data', 'some-tool');
  assert.equal(findSiteRoot(nestedDir), root);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findSiteRoot: a flat target (site root IS the page\'s own directory) returns that same directory unchanged -- no behavior change for the common case', () => {
  const root = makeTempSite();
  assert.equal(findSiteRoot(root), root);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findSiteRoot: falls back to the starting directory when no ancestor has a js/ sibling within 6 levels (e.g. an unrelated file, or another workspace with a different layout)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-qa-test-flat-'));
  const nested = path.join(root, 'a', 'b', 'c');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findSiteRoot(nested), nested);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findSiteRoot: stops walking at the filesystem root rather than throwing, if it somehow gets that far', () => {
  assert.doesNotThrow(() => findSiteRoot(path.parse(process.cwd()).root));
});

// ---------------------------------------------------------------------------
// Pre-existing coverage baseline (isHttpUrl/pageNameFor/formatScoreSummary) --
// kept minimal since this file's own primary job is findSiteRoot's fix.
// ---------------------------------------------------------------------------

test('isHttpUrl: true for http(s) URLs, false for a local path', () => {
  assert.equal(isHttpUrl('https://example.com/page'), true);
  assert.equal(isHttpUrl('http://example.com/page'), true);
  assert.equal(isHttpUrl('dist/index.html'), false);
});

test('pageNameFor: derives a filesystem-safe base name from a local path or a URL', () => {
  assert.equal(pageNameFor('dist/data/regex-tester/index.html'), 'index');
  assert.equal(pageNameFor('https://example.com/data/regex-tester/'), 'data-regex-tester');
});

test('formatScoreSummary: renders a percentage per category, "n/a" for a missing one', () => {
  const summary = formatScoreSummary({ performance: { title: 'Performance', score: 0.95 } });
  assert.match(summary, /Performance: 95\/100/);
  assert.match(summary, /accessibility: n\/a/);
});
