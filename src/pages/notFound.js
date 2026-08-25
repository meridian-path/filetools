'use strict';

/**
 * The 404 page, restyled as the explorer's not-found state (site-wide
 * navigation/IA redesign, see the folder taxonomy/nav spec section 1.9):
 * path bar "~ / not found", the standard window listing the five folders
 * as rows (not a full tool list -- there is no "current folder" for a
 * missing path), and a status bar naming the real tool count. Stays
 * noindex, same as before this redesign.
 *
 * Moved out of src/shell.js (where it used to live as render404Page())
 * because it now needs src/pages/explorerWindow.js, which itself needs
 * shell.js for escapeHtml -- shell.js importing explorerWindow.js back
 * would be circular. Every other page already lives in src/pages/*.js;
 * 404 living inside shell.js was the one exception, not a rule this
 * follows.
 */

const { renderPage, HOME_CRUMB } = require('../shell.js');
const { absoluteUrl, SITE_NAME } = require('../site.js');
const { TOOLS } = require('../tools/index.js');
const { FOLDERS, toolsInFolder } = require('../folders.js');
const {
  renderFolderSidebarRow, renderWindowChrome, renderWindowStatusBar, renderExplorerWindow,
} = require('./explorerWindow.js');

function render404Page() {
  const title = `Page not found | ${SITE_NAME}`;
  const description = `The page you followed a link to doesn’t exist on ${SITE_NAME}. Here are the tools you might have been looking for.`;
  const toolCount = TOOLS.length;

  const folderRows = FOLDERS.map((f) => renderFolderSidebarRow(f, toolsInFolder(f.key).length)).join('\n        ');
  const window = renderExplorerWindow({
    chrome: renderWindowChrome('~ / not found', 0, 'items', false),
    body: `<nav class="window-sidebar window-sidebar-full" aria-label="Folders">${folderRows}</nav>`,
    statusBar: renderWindowStatusBar(`0 of ${toolCount} files at this path`),
  });

  // A visually-hidden h2 keeps the real heading order h1 -> h2 -> (footer's
  // h3s) intact -- without it this page's body has no h2 at all and skips
  // straight to h3, the same Lighthouse-caught heading-order regression
  // folder.js's own sr-only h2 already exists to prevent (see .sr-only in
  // src/css.js).
  const mainHtml = `<h1>File not found</h1>
    <p class="deck">The link you followed may be out of date, or the page may have moved. Here is everything on the site:</p>
    <h2 id="notfound-folders-h" class="sr-only">Browse folders</h2>
    <div aria-labelledby="notfound-folders-h">
    ${window}
    </div>
`;

  return renderPage({
    slug: null,
    title,
    metaDescription: description,
    breadcrumb: [HOME_CRUMB, { name: 'not found' }],
    mainHtml,
    canonical: absoluteUrl('404.html'),
    noindex: true,
  });
}

module.exports = { render404Page };
