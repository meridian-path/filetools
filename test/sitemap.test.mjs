import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapPathsFor, buildSitemapEntries, renderSitemapXml, robotsTxtContent } from '../src/sitemap.js';

test('sitemapPathsFor lists the root, how-this-works, privacy, one path per folder, and one path per tool', () => {
  const tools = [
    { slug: 'merge-pdf', category: 'pdf' },
    { slug: 'base64-encode-decode', category: 'data' },
  ];
  assert.deepEqual(sitemapPathsFor(tools), [
    '', 'how-this-works/', 'privacy/',
    'pdf/', 'spreadsheets/', 'data-formats/', 'text/', 'developer/', 'image/',
    'pdf/merge-pdf/', 'data/base64-encode-decode/',
  ]);
});

test('sitemapPathsFor returns the static paths plus the 6 folder paths for an empty tool list', () => {
  assert.deepEqual(sitemapPathsFor([]), [
    '', 'how-this-works/', 'privacy/',
    'pdf/', 'spreadsheets/', 'data-formats/', 'text/', 'developer/', 'image/',
  ]);
});

test('sitemapPathsFor never includes the noindex /data/ helper page', () => {
  assert.ok(!sitemapPathsFor([]).includes('data/'));
});

test('buildSitemapEntries filters out 404.html and sorts the remaining paths', () => {
  const entries = buildSitemapEntries(['pdf/merge-pdf/', '404.html', '']);
  assert.deepEqual(entries.map((e) => e.path), ['', 'pdf/merge-pdf/']);
  assert.equal(entries[1].loc, 'https://usefiletools.com/pdf/merge-pdf/');
});

test('renderSitemapXml and robotsTxtContent stay consistent with each other and with sitemapPathsFor', () => {
  const paths = sitemapPathsFor([{ slug: 'merge-pdf', category: 'pdf' }]);
  const xml = renderSitemapXml(paths);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/usefiletools\.com\/pdf\/merge-pdf\/<\/loc>/);
  assert.match(robotsTxtContent(), /Sitemap: https:\/\/usefiletools\.com\/sitemap\.xml/);
});
