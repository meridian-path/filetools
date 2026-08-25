// Filter (inline, listing pages) + quick-open (every page) -- site-wide
// navigation/IA redesign, see the folder taxonomy/nav spec section 1.7.
// Loaded as a plain <script type="module"> on every page (module scripts
// defer automatically, so the DOM is already parsed once this runs).
//
// Both features are entirely JS-injected ("no dead control without JS" --
// spec 1.3b): a page with JS disabled renders exactly as it did before
// this file existed, just with an empty [data-filter-slot] div and no
// quick-open trigger button.
//
// SECURITY (spec section 4): the query string is untrusted visitor input.
// Every place it reaches the DOM below goes through .textContent or a
// plain string comparison -- never .innerHTML, never a template string
// assigned to innerHTML. See test/filterSecurity.e2e.test.mjs for the
// injection regression test this contract exists to satisfy.
(function () {
  'use strict';

  var ROW_SELECTOR = '[data-filter-row]';

  function isEditableTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  // -------------------------------------------------------------------
  // Inline filter (listing pages: home, folder pages, 404)
  // -------------------------------------------------------------------
  var inlineFilterInput = null;

  function initInlineFilter() {
    var slot = document.querySelector('[data-filter-slot]');
    if (!slot) return;

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'window-filter-input';
    input.placeholder = 'Filter files… (press /)';
    input.setAttribute('aria-label', 'Filter tools');
    slot.appendChild(input);

    var statusEl = document.querySelector('[data-window-status]');
    var defaultStatusText = statusEl ? statusEl.textContent : '';
    var rows = Array.prototype.slice.call(document.querySelectorAll(ROW_SELECTOR));
    var sections = Array.prototype.slice.call(document.querySelectorAll('.window-section'));
    var mainEl = document.querySelector('.window-main');

    var emptyRow = document.createElement('div');
    emptyRow.className = 'window-empty-row';
    emptyRow.hidden = true;
    var emptyText = document.createElement('span');
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'window-empty-clear';
    clearBtn.textContent = 'Clear';
    emptyRow.appendChild(emptyText);
    emptyRow.appendChild(clearBtn);
    if (mainEl) mainEl.appendChild(emptyRow);

    function applyFilter() {
      var raw = input.value;
      var query = raw.trim().toLowerCase();

      if (!query) {
        rows.forEach(function (r) { r.hidden = false; });
        sections.forEach(function (s) { s.hidden = false; });
        emptyRow.hidden = true;
        if (statusEl) statusEl.textContent = defaultStatusText;
        return;
      }

      var matchCount = 0;
      rows.forEach(function (r) {
        var text = r.getAttribute('data-filter-text') || '';
        var match = text.indexOf(query) !== -1;
        r.hidden = !match;
        if (match) matchCount += 1;
      });
      sections.forEach(function (s) {
        s.hidden = !s.querySelector(ROW_SELECTOR + ':not([hidden])');
      });

      emptyRow.hidden = matchCount !== 0;
      if (matchCount === 0) {
        // .textContent only -- never innerHTML with `raw` (untrusted).
        emptyText.textContent = 'No files match ‘' + raw + '’';
      }
      if (statusEl) statusEl.textContent = matchCount + ' of ' + rows.length + ' files match';
    }

    input.addEventListener('input', applyFilter);
    clearBtn.addEventListener('click', function () {
      input.value = '';
      applyFilter();
      input.focus();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // "Escape clears then blurs" (spec 1.7) -- one keypress does both.
        input.value = '';
        applyFilter();
        input.blur();
      }
    });

    inlineFilterInput = input;
  }

  // -------------------------------------------------------------------
  // Quick-open (every page) -- full APG combobox contract (spec 1.7/1.13).
  // -------------------------------------------------------------------
  var toolIndexCache = null;
  function getToolIndex() {
    if (toolIndexCache) return toolIndexCache;
    var el = document.getElementById('tool-index');
    if (!el) { toolIndexCache = []; return toolIndexCache; }
    try {
      toolIndexCache = JSON.parse(el.textContent);
    } catch (e) {
      toolIndexCache = [];
    }
    return toolIndexCache;
  }

  var qo = null; // lazily built on first use

  function buildQuickOpen() {
    var backdrop = document.createElement('div');
    backdrop.className = 'quickopen-backdrop';
    backdrop.hidden = true;

    var dialog = document.createElement('div');
    dialog.className = 'quickopen-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Quick open a tool');

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'quickopen-input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'quickopen-listbox');
    input.setAttribute('placeholder', 'Jump to a tool…');
    input.setAttribute('aria-label', 'Jump to a tool');

    var listbox = document.createElement('ul');
    listbox.id = 'quickopen-listbox';
    listbox.className = 'quickopen-listbox';
    listbox.setAttribute('role', 'listbox');

    dialog.appendChild(input);
    dialog.appendChild(listbox);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    var state = {
      backdrop: backdrop, dialog: dialog, input: input, listbox: listbox,
      items: [], activeIndex: -1, lastFocused: null,
    };

    function navigateTo(targetUrl) {
      window.location.href = targetUrl;
    }

    function updateActiveDescendant() {
      var options = listbox.querySelectorAll('.quickopen-option');
      for (var i = 0; i < options.length; i += 1) {
        if (i === state.activeIndex) {
          options[i].setAttribute('aria-selected', 'true');
          input.setAttribute('aria-activedescendant', options[i].id);
        } else {
          options[i].removeAttribute('aria-selected');
        }
      }
      if (state.activeIndex === -1) input.removeAttribute('aria-activedescendant');
    }

    function renderResults(query) {
      var q = query.trim().toLowerCase();
      var all = getToolIndex();
      var matches = q
        ? all.filter(function (t) {
          return (t.navLabel + ' ' + t.deck + ' ' + t.slug).toLowerCase().indexOf(q) !== -1;
        })
        : all;
      state.items = matches;
      state.activeIndex = matches.length ? 0 : -1;

      // listbox.textContent = '' clears safely (no innerHTML anywhere in
      // this function); every option below is built with createElement +
      // .textContent, never a template string of user input.
      listbox.textContent = '';
      matches.forEach(function (t, i) {
        var li = document.createElement('li');
        li.id = 'quickopen-option-' + i;
        li.className = 'quickopen-option';
        li.setAttribute('role', 'option');
        var name = document.createElement('span');
        name.className = 'quickopen-option-name';
        name.textContent = t.navLabel;
        var folder = document.createElement('span');
        folder.className = 'quickopen-option-folder';
        folder.textContent = t.folder;
        li.appendChild(name);
        li.appendChild(folder);
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          navigateTo(t.url);
        });
        listbox.appendChild(li);
      });
      if (!matches.length) {
        var empty = document.createElement('li');
        empty.className = 'quickopen-empty';
        empty.textContent = 'No tools match ‘' + query + '’';
        listbox.appendChild(empty);
      }
      updateActiveDescendant();
    }
    state.renderResults = renderResults;

    function move(delta) {
      if (!state.items.length) return;
      state.activeIndex = Math.max(0, Math.min(state.items.length - 1, state.activeIndex + delta));
      updateActiveDescendant();
      var el = document.getElementById('quickopen-option-' + state.activeIndex);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', function () { renderResults(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.activeIndex !== -1) navigateTo(state.items[state.activeIndex].url);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeQuickOpen();
      } else if (e.key === 'Tab') {
        // Single-focusable-element dialog (APG combobox-in-dialog shape):
        // the input is the only focusable control, so trapping focus is
        // just refusing to let Tab leave it.
        e.preventDefault();
      }
    });

    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop) closeQuickOpen();
    });

    qo = state;
    return state;
  }

  function setBackgroundInert(isInert) {
    ['header.site-header', 'main', 'footer.site-footer'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (isInert) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  function openQuickOpen() {
    var state = qo || buildQuickOpen();
    state.lastFocused = document.activeElement;
    state.backdrop.hidden = false;
    setBackgroundInert(true);
    state.input.value = '';
    state.renderResults('');
    state.input.focus();
  }

  function closeQuickOpen() {
    if (!qo || qo.backdrop.hidden) return;
    qo.backdrop.hidden = true;
    setBackgroundInert(false);
    var target = qo.lastFocused;
    qo.lastFocused = null;
    if (target && document.contains(target) && typeof target.focus === 'function') target.focus();
  }

  function insertQuickOpenTrigger() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quickopen-trigger';
    // The accessible name must contain the button's own visible text
    // ("Jump to...") as a substring -- WCAG 2.5.3 Label in Name, so a
    // screen-reader/voice-control visitor who sees "Jump to" can actually
    // refer to the control by that name.
    btn.setAttribute('aria-label', 'Jump to a tool (press slash)');
    var label = document.createElement('span');
    label.textContent = 'Jump to…';
    var hint = document.createElement('kbd');
    hint.textContent = '/';
    btn.appendChild(label);
    btn.appendChild(hint);
    btn.addEventListener('click', openQuickOpen);
    header.appendChild(btn);
  }

  // "/" is not a browser-owned shortcut in any major browser (unlike
  // Ctrl+K, which IS the Chrome address-bar binding -- spec 1.7's own
  // reasoning for choosing "/"), so intercepting it here never fights the
  // user agent. Ignored whenever focus is already in an editable control
  // (including the inline filter input itself, so "/" still types
  // normally there) or a modifier key is held.
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(document.activeElement)) return;
    e.preventDefault();
    if (inlineFilterInput) {
      inlineFilterInput.focus();
      inlineFilterInput.select();
    } else {
      openQuickOpen();
    }
  });

  initInlineFilter();
  insertQuickOpenTrigger();
})();
