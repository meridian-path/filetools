'use strict';

/**
 * Pings IndexNow (indexnow.org) with every URL this site publishes, so
 * Bing/Yandex/Naver/Seznam/Yep can crawl a deploy immediately instead of
 * waiting on their own periodic schedule. One POST fans out to all of them.
 * No account, API key request, or sign-up is involved -- IndexNow proves
 * ownership entirely through the key file src/build.js writes to
 * dist/<key>.txt (src/indexnow.js is the one place the key itself lives).
 *
 * Never fails the calling process on a bad HTTP response or a network
 * error -- an instant-index nudge is a nice-to-have on top of the normal
 * crawl schedule, not something that should ever block or red-X a deploy.
 * Always logs the outcome so a real submission is confirmable from the
 * workflow log.
 *
 * Usage:
 *   node scripts/indexnow-ping.js [--dry-run]
 *
 * --dry-run builds and prints the exact request (URL list included)
 * without sending it -- use this to check the payload locally, since a
 * real run submits real production URLs to live third-party services.
 */

const { TOOLS } = require('../src/tools/index.js');
const { SITE_ORIGIN, absoluteUrl } = require('../src/site.js');
const { sitemapPathsFor, buildSitemapEntries } = require('../src/sitemap.js');
const { INDEXNOW_KEY } = require('../src/indexnow.js');

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

function buildPayload() {
  const paths = sitemapPathsFor(TOOLS);
  const urlList = buildSitemapEntries(paths).map((e) => e.loc);
  return {
    host: new URL(SITE_ORIGIN).host,
    key: INDEXNOW_KEY,
    keyLocation: absoluteUrl(`${INDEXNOW_KEY}.txt`),
    urlList,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const payload = buildPayload();

  if (dryRun) {
    console.log(`Dry run -- would POST ${INDEXNOW_ENDPOINT} with ${payload.urlList.length} URL(s):`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`IndexNow: submitting ${payload.urlList.length} URL(s) to ${INDEXNOW_ENDPOINT}`);
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text();
    console.log(`IndexNow: HTTP ${res.status} ${res.statusText}${bodyText ? ` -- ${bodyText.slice(0, 500)}` : ''}`);
    if (!res.ok) {
      console.log('IndexNow: non-2xx response, not failing the workflow -- see indexnow.org/documentation for status code meanings.');
    }
  } catch (err) {
    console.log(`IndexNow: request failed, not failing the workflow -- ${err.message}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildPayload, INDEXNOW_ENDPOINT };
