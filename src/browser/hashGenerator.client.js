// Hash generator processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="hashGenerator") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./dedupeLines.client.js. This tool has two input paths that
// both land here as the same File[] shape: one or more files chosen/
// dropped through the normal drop zone (data-multiple="true" -- the
// task's own "batch file processing" edge case), or text typed into the
// "paste text" text box (dropzone.client.js wraps the pasted text in a
// single synthetic File before calling this module's run(), so a paste
// always produces exactly one File here).
//
// Unlike every other tool on this site, hashing genuinely needs the raw
// bytes, not a decoded text string -- file.arrayBuffer() rather than
// file.text(), so this works correctly on binary files too (an .exe or
// .zip someone wants to verify a checksum for), not just text.
//
// One block per input file/paste, each listing all five hashes
// (../pure/hashGenerator.mjs's computeHashes -- MD5 hand-computed, the
// SHA family via the browser's own SubtleCrypto) with its own copy
// button -- one row per algorithm rather than a table, since a hash is a
// long fixed-width string that would force a wide, cramped table on
// narrow viewports (see src/css.js's .hash-row comment).

function makeCopyButton(getText, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary';
  btn.textContent = label;
  let resetTimer = null;
  btn.addEventListener('click', async () => {
    if (resetTimer) clearTimeout(resetTimer);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no Clipboard API');
      await navigator.clipboard.writeText(getText());
      btn.textContent = 'Copied';
    } catch (err) {
      btn.textContent = 'Couldn’t copy';
    }
    resetTimer = setTimeout(() => { btn.textContent = label; }, 2000);
  });
  return btn;
}

/**
 * One file's (or the single paste's) result block: a filename/label
 * heading plus one row per algorithm.
 *
 * @param {string} title the source file's name, or "Pasted text" for the
 *   paste path.
 * @param {Array<{key:string, label:string, hash:string}>} hashes from
 *   ../pure/hashGenerator.mjs's computeHashes.
 */
function renderBlock(title, hashes) {
  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = title;
  head.appendChild(badge);
  block.appendChild(head);

  const list = document.createElement('div');
  list.className = 'hash-list';
  for (const { label, hash } of hashes) {
    const row = document.createElement('div');
    row.className = 'hash-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'hash-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);
    const valueEl = document.createElement('code');
    valueEl.className = 'hash-value';
    valueEl.textContent = hash;
    row.appendChild(valueEl);
    row.appendChild(makeCopyButton(() => hash, `Copy ${label}`));
    list.appendChild(row);
  }
  block.appendChild(list);

  return block;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  setState('working');
  setStatus(files.length > 1 ? `Hashing ${files.length} files on this device…` : 'Hashing that on this device…');

  const [{ computeHashes }] = await Promise.all([
    import('../pure/hashGenerator.mjs'),
  ]);

  resultEl.innerHTML = '';

  const nonEmptyFiles = [];
  for (const file of files) {
    if (file.size === 0) continue;
    nonEmptyFiles.push(file);
  }

  if (nonEmptyFiles.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some text or a file first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some text or a file first.', 'error');
    return;
  }

  const isPaste = files.length === 1 && files[0].name === 'pasted-input.txt';
  for (const file of nonEmptyFiles) {
    const buffer = await file.arrayBuffer();
    const hashes = await computeHashes(buffer);
    resultEl.appendChild(renderBlock(isPaste ? 'Pasted text' : file.name, hashes));
  }

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
  setState('done');
  setStatus(
    nonEmptyFiles.length > 1
      ? `Hashed ${nonEmptyFiles.length} files below. Copy whichever hash you need.`
      : 'Hashed below. Copy whichever hash you need.',
    'success'
  );
}
