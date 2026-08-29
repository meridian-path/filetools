// Word & Character Counter page controller. Like uuidGenerator.client.js/
// regexTester.client.js, this is a customPanelMode tool (src/pages/
// toolPage.js) -- no dropzone, no paste-convert button, loaded directly
// as the page's <script type="module">. Unlike regexTester.client.js,
// counting is cheap, synchronous, and can never hang (no Worker needed --
// see that file's own header comment for why IT needs one and this
// doesn't).

import { countAll } from '../pure/wordCharacterCounter.mjs';

const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog. It happens every single day.';

function makeStat(label) {
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = label;
  return badge;
}

const toolSection = document.getElementById('tool');
if (toolSection) {
  const resultEl = toolSection.querySelector('.result');
  resultEl.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'table-block';

  const textareaLabel = document.createElement('label');
  textareaLabel.style.display = 'flex';
  textareaLabel.style.flexDirection = 'column';
  textareaLabel.style.gap = 'var(--space-1)';
  textareaLabel.appendChild(document.createTextNode('Your text'));
  const textarea = document.createElement('textarea');
  textarea.className = 'paste-textarea';
  textarea.rows = 10;
  textarea.spellcheck = true;
  textarea.value = DEFAULT_TEXT;
  textarea.setAttribute('aria-label', 'Text to count');
  textareaLabel.appendChild(textarea);
  panel.appendChild(textareaLabel);

  const statsRow = document.createElement('div');
  statsRow.className = 'table-block-head';
  statsRow.style.marginTop = 'var(--space-4)';
  panel.appendChild(statsRow);

  resultEl.appendChild(panel);
  resultEl.hidden = false;

  function render() {
    const stats = countAll(textarea.value);
    statsRow.innerHTML = '';
    statsRow.appendChild(makeStat(`${stats.words} word${stats.words === 1 ? '' : 's'}`));
    statsRow.appendChild(makeStat(`${stats.charactersWithSpaces} character${stats.charactersWithSpaces === 1 ? '' : 's'}`));
    statsRow.appendChild(makeStat(`${stats.charactersWithoutSpaces} without spaces`));
    statsRow.appendChild(makeStat(`${stats.sentences} sentence${stats.sentences === 1 ? '' : 's'}`));
    statsRow.appendChild(makeStat(stats.readingTime.label));
  }

  textarea.addEventListener('input', render);
  render();
}
