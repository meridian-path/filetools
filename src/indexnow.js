'use strict';

/**
 * IndexNow key, generated once (crypto.randomBytes(32).toString('hex')) and
 * committed permanently -- IndexNow identifies this site by the key file it
 * finds at https://usefiletools.com/<key>.txt, so this value can never
 * change without also updating that file and every future ping. One source
 * of truth, required by both src/build.js (writes dist/<key>.txt) and
 * scripts/indexnow-ping.js (submits it with every ping) so the two can
 * never drift.
 */
const INDEXNOW_KEY = '6338c4af5e89b17671ef32b04bb1b0edc87b5f37c116d07a3cac2b0b7f0a3ffb';

module.exports = { INDEXNOW_KEY };
