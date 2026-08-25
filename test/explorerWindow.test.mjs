import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_KIND_LABELS, renderToolRow, renderFolderSidebarRow, renderWindowChrome,
  renderWindowStatusBar, renderExplorerWindow,
} from '../src/pages/explorerWindow.js';
import { TOOLS } from '../src/tools/index.js';
import { FOLDERS, toolsInFolder } from '../src/folders.js';
import { familyOf } from '../src/families.js';

/**
 * Pure-logic coverage for the shared explorer-window building blocks
 * (site-wide navigation/IA redesign, see the folder taxonomy/nav spec
 * section 1.5) -- the string-builders behind the homepage, folder pages,
 * and the 404 page. Real rendering/keyboard behavior is covered by the
 * e2e suites (test/homepage.e2e.test.mjs, test/filter.e2e.test.mjs,
 * test/quickOpen.e2e.test.mjs, test/notFound.e2e.test.mjs).
 */

test('renderToolRow: carries a Kind chip naming the tool\'s own family, not its folder', () => {
  const tool = TOOLS.find((t) => t.slug === 'merge-pdf');
  const row = renderToolRow(tool);
  assert.match(row, /class="tool-row-kind mark--pdf"/);
  assert.match(row, />PDF</);
});

test('renderToolRow: data-filter-text is the lowercased name + deck + slug', () => {
  const tool = TOOLS.find((t) => t.slug === 'merge-pdf');
  const row = renderToolRow(tool);
  const match = row.match(/data-filter-text="([^"]*)"/);
  assert.ok(match, 'expected a data-filter-text attribute');
  const text = match[1];
  assert.equal(text, text.toLowerCase());
  assert.ok(text.includes('merge pdf'));
  assert.ok(text.includes('merge-pdf'));
});

test('renderToolRow: escapes an HTML-shaped deck rather than emitting it raw', () => {
  const row = renderToolRow({
    slug: 'x', category: 'data', navLabel: 'X', deck: '<img src=x onerror=alert(1)>',
  });
  assert.ok(!row.includes('<img'));
  assert.ok(row.includes('&lt;img'));
});

test('FAMILY_KIND_LABELS: covers every family a real tool uses, plus the folder-only dev key', () => {
  const usedFamilies = new Set(TOOLS.map((t) => familyOf(t.slug)));
  for (const f of usedFamilies) assert.ok(FAMILY_KIND_LABELS[f], `missing a Kind label for family "${f}"`);
  assert.ok(FAMILY_KIND_LABELS.dev);
});

test('renderFolderSidebarRow: real link, real count, real label -- never hardcoded', () => {
  const folder = FOLDERS.find((f) => f.key === 'pdf');
  const count = toolsInFolder('pdf').length;
  const row = renderFolderSidebarRow(folder, count);
  assert.match(row, /href="\/pdf\/"/);
  assert.match(row, new RegExp(`>${count}<`));
  assert.match(row, />PDF</);
});

test('renderWindowChrome: renders the path text and count as visible text, not attributes', () => {
  const chrome = renderWindowChrome('~ / spreadsheets', 8, 'items');
  assert.match(chrome, />~ \/ spreadsheets</);
  assert.match(chrome, />8 items</);
  assert.match(chrome, /data-filter-slot/);
});

test('renderWindowStatusBar: aria-live polite region carries the given text', () => {
  const bar = renderWindowStatusBar('29 files · 0 uploads · works offline');
  assert.match(bar, /aria-live="polite"/);
  assert.match(bar, /data-window-status/);
  assert.match(bar, /29 files/);
});

test('renderExplorerWindow: with a sidebar renders a two-pane body; without, a full-width one', () => {
  const withSidebar = renderExplorerWindow({
    chrome: '<c/>', body: '<b/>', statusBar: '<s/>', sidebar: '<nav-content/>',
  });
  assert.match(withSidebar, /class="window-sidebar"/);
  assert.match(withSidebar, /class="window-main">/);

  const withoutSidebar = renderExplorerWindow({ chrome: '<c/>', body: '<b/>', statusBar: '<s/>' });
  assert.ok(!withoutSidebar.includes('class="window-sidebar"'));
  assert.match(withoutSidebar, /class="window-main window-main-full"/);
});
