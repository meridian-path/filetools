/**
 * JSON to YAML shaping logic -- the shared math behind the "convert JSON
 * to YAML" tool. js-yaml's own dump() (loaded in
 * ../browser/jsonToYaml.client.js, see that file's header for the vendor/
 * loading details) does the actual YAML serialization; this module only
 * parses the input JSON with a friendly error message, the same "empty
 * input"/"invalid JSON" guard shape ../pure/jsonToCsv.mjs's own
 * parseJsonArray uses - not an import of it, this directory's own
 * established "no pure module here imports another" convention.
 *
 * Unlike the reverse direction (yamlToJson.mjs's own multi-document
 * combineDocuments()), JSON has no equivalent of YAML's `---`-separated
 * multi-document shape - a JSON file is always exactly one value - so
 * there is no analogous combining step here.
 */

/**
 * @param {string} text raw pasted/uploaded JSON text.
 * @returns {{ok:true, value:*} | {ok:false, error:string}} a friendly,
 *   specific error rather than letting a raw JSON.parse SyntaxError reach
 *   the visitor.
 */
export function parseJsonInput(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) {
    return { ok: false, error: 'That’s empty - paste or drop some JSON first.' };
  }
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, error: 'That isn’t valid JSON - check for a missing comma, bracket, or quote and try again.' };
  }
  return { ok: true, value };
}
