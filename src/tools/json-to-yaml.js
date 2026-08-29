'use strict';

module.exports = {
  slug: 'json-to-yaml',
  category: 'data',
  launchDate: '2026-08-25',
  navLabel: 'JSON to YAML',
  h1: 'Convert JSON to YAML',
  title: 'Convert JSON to YAML - In Your Browser | filetools',
  metaDescription: 'Paste JSON or drop a .json file and get YAML back, free and in your browser - the reverse of this site’s own YAML to JSON tool.',
  deck: 'Paste JSON, or drop a .json file, and download it as YAML.',
  clientEntry: 'jsonToYaml',
  family: 'json',
  folder: 'data-formats',
  // Same plate/verb/ink combo as json-minify-beautify and yaml-to-json
  // (this tool's own reverse direction) - YAML has no family of its own
  // (see yaml-to-json.js's own family field, which falls back to its
  // OUTPUT format's family for the identical reason), so ink stays the
  // default plate color rather than pointing at a family that doesn't
  // exist. This tolerated mark reuse across a handful of json-family
  // tools already exists in this codebase (json-minify-beautify and
  // yaml-to-json render identically today); not introducing a new motif
  // for it here keeps this consistent with that existing precedent.
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.json', type: 'application/json' },
  mode: 'json-to-yaml',
  fileTypeLabel: 'JSON file',
  accepts: '.json,application/json,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste JSON',
    placeholder: '{\n  "name": "Widget",\n  "tags": ["hardware", "sale"]\n}',
    buttonLabel: 'Convert pasted JSON',
  },
  howSteps: [
    'Drop or choose a .json file, or paste JSON directly into the text box.',
    'Review the YAML preview.',
    'Download the result as a .yaml file.',
  ],
  faqs: [
    {
      q: 'Is my JSON sent anywhere?',
      answerHtml: 'No. Pasted JSON and uploaded files are both read and converted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What JSON shape does this expect?',
      answerHtml: 'Any valid JSON value - an object, an array, or even a bare string or number - all convert to their equivalent YAML representation.',
    },
    {
      q: 'Does converting to YAML and back produce the exact same JSON?',
      answerHtml: 'Yes, for any JSON this tool actually accepts. YAML is a superset of JSON’s own data model (objects, arrays, strings, numbers, booleans, null), so nothing about the value itself is lost - only the formatting changes, from braces and commas to YAML’s indentation-based syntax.',
    },
    {
      q: 'How are special number values like NaN or Infinity handled?',
      answerHtml: 'They can’t come up here - JSON.parse itself rejects <code>NaN</code>/<code>Infinity</code> as invalid JSON before this tool ever sees them, unlike <a href="/data/yaml-to-json/">YAML to JSON</a> (the reverse tool), where YAML’s own <code>.nan</code>/<code>.inf</code> syntax has to be handled explicitly on the way out to JSON.',
    },
    {
      q: 'Does this tool preserve key order?',
      answerHtml: 'Yes - object keys appear in the YAML output in the same order they appeared in the source JSON, matching how <code>JSON.parse</code> itself preserves insertion order for string keys.',
    },
  ],
  relatedSlugs: ['yaml-to-json', 'json-minify-beautify', 'flatten-json'],
};
