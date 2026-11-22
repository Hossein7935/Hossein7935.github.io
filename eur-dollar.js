/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * Charts:
 *  - EUR/USD (EZB) – lange Historie
 *  - XEURBI (CME) – wenn vorhanden
 *  - SOFR−€STR (bp) – Kontext
 */
(function () {
  'use strict';

  var PAGE = 9;
  var LABEL = 'EUR/Dollar';
  var LS_PAGE = 'macrowatch-usa-page';

  function ensureButtons() {
    document.querySelectorAll('#usaPageSelect, .usa-page-select').forEach(function (sel) {
      if (sel.querySelector('button[data-page="' + PAGE + '"]')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-page', String(PAGE));
      b.textContent = LABEL;
      sel.appendChild(b);
    });
  }

  function chartSvg(key, label, h) {
    var pts = (typeof histories !== 'undefined' && histories['USA-' + key]) || [];
    if (!pts.length) {
      return '<div class="sparkempty">Keine Daten für ' + label + '</div>';
    }
    if (typeof renderLineChart === 'function') {
      return (
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|' +
        key +
        '|' +
        label +
        '" title="Chart vergrößern">' +
        renderLineChart(pts, { w: Math.min(640, 360), h: h || 110 }) +
        '</div>'
      );
    }
    return '<div class="sparkempty">' + pts.length + ' Punkte</div>';
  }

  function card(title, key, metaKey, unit) {
    var pts = (typeof histories !== 'undefined' && histories['USA-' + key]) || [];
    var meta =
      (typeof data !== 'undefined' && data.USA && data.USA[metaKey || key]) || {};
    var last = pts.length ? pts[pts.length - 1] : null;
    var val = '—';
    if (last) {
      if (unit === 'bp') {
        val =
          (Number(last.value) >= 0 ? '+' : '') +
          Number(last.value).toFixed(2) +
          ' bp';
      } else {
        val = Number(last.value).toFixed(4);
      }
    }
    var date =
      last && last.period
        ? 'Stand ' +
          last.period +
          ' · ' +
          (meta.source || '') +
          ' · ' +
          pts.length +
          ' Punkte'
        : meta.note || 'Keine Daten';
    return (
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">' +
      title +
      '</div>' +
      '<div class="value">' +
      val +
      '</div>' +
      '<div class="date">' +
      date +
      '</div>' +
      chartSvg(key, title, 120) +
      '<div class="sofr-fwd-meta">' +
      (meta.note || '') +
      '</div>' +
      '</div>'
    );
  }

  function ensureFace() {
    var faceA = document.querySelector('.country .usa-face-a');
    if (!faceA) return null;
    var card = faceA.closest('.country');
    var face = card.querySelector('.usa-face-j');
    if (!face) {
      face = document.createElement('div');
      face.className = 'metrics usa-face usa-face-j hidden';
      face.setAttribute('data-usa-face', String(PAGE));
      var after =
        card.querySelector('.usa-face-i') ||
        card.querySelector('.usa-face-h') ||
        card.querySelector('.usa-face-g');
      if (after && after.parentNode) after.after(face);
      else card.appendChild(face);
    }
    return face;
  }

  function paint() {
    var face = ensureFace();
    if (!face) return;
    var html = '';
    html += card(
      'EUR/USD · EZB-Referenzkurs',
      'eurusd',
      'eurusd',
      'fx'
    );
    html += card(
      'CME XEURBI · Cross-Currency Basis',
      'xeurbi',
      'xeurbi',
      'bp'
    );
    html += card(
      'SOFR − €STR · Finanzierungsspread',
      'sofrEstr',
      'sofrEstr',
      'bp'
    );
    face.innerHTML = html;
  }

  function showPage() {
    try {
      localStorage.setItem(LS_PAGE, String(PAGE));
    } catch (e) {}
    ensureButtons();
    var face = ensureFace();
    if (!face) return;
    var cardEl = face.closest('.country');
    cardEl.querySelectorAll('.usa-face').forEach(function (f) {
      f.classList.toggle('hidden', f !== face);
    });
    document.querySelectorAll('#usaPageSelect button, .usa-page-select button').forEach(function (b) {
      b.classList.toggle('active', Number(b.getAttribute('data-page')) === PAGE);
    });
    paint();
  }

  if (typeof setUsaPage === 'function' && !setUsaPage.__eurDollar) {
    var origSet = setUsaPage;
    var wrapped = function (page) {
      ensureButtons();
      if (Number(page) === PAGE) return showPage();
      var f = document.querySelector('.usa-face-j');
      if (f) f.classList.add('hidden');
      return origSet.apply(this, arguments);
    };
    wrapped.__eurDollar = true;
    setUsaPage = wrapped; // eslint-disable-line no-global-assign
  }

  if (!window.__eurDollarClickBound) {
    window.__eurDollarClickBound = true;
    document.addEventListener(
      'click',
      function (e) {
        var btn =
          e.target &&
          e.target.closest &&
          e.target.closest('#usaPageSelect button, .usa-page-select button');
        if (!btn) return;
        if (Number(btn.getAttribute('data-page')) !== PAGE) return;
        e.preventDefault();
        e.stopPropagation();
        showPage();
      },
      true
    );
  }

  function boot() {
    ensureButtons();
    var start = 0;
    try {
      start = Number(localStorage.getItem(LS_PAGE) || '0');
    } catch (e) {}
    if (start === PAGE) showPage();
    setTimeout(function () {
      ensureButtons();
      try {
        if (Number(localStorage.getItem(LS_PAGE)) === PAGE) showPage();
      } catch (e) {}
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 1200);
})();
