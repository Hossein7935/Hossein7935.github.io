/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * Cross-Currency Basis Monitor
 * → CME XEURBI wenn da, sonst SOFR−€STR-Proxy in %-Punkten (ohne ×100)
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

    var pts = (typeof histories !== 'undefined' && histories['USA-xeurbi']) || [];
    var meta = (typeof data !== 'undefined' && data.USA && data.USA.xeurbi) || {};
    var last = pts.length ? pts[pts.length - 1] : null;
    var isProxy = !meta.source || String(meta.source).indexOf('Proxy') >= 0 || String(meta.source).indexOf('SOFR') >= 0;

    var val = '—';
    if (last) {
      val =
        (Number(last.value) >= 0 ? '+' : '') +
        Number(last.value).toFixed(2) +
        (isProxy ? ' %' : ' bp');
    }

    var title = isProxy
      ? 'EUR/USD Basis-Monitor · Proxy (SOFR − €STR, %-Punkte)'
      : 'CME XEURBI · EUR/USD Cross-Currency Basis';

    var dateLine = last
      ? 'Stand ' +
        last.period +
        ' · ' +
        (meta.source || '') +
        ' · ' +
        pts.length +
        ' Punkte'
      : 'Keine Daten';

    var chartHtml;
    if (!pts.length) {
      chartHtml =
        '<div class="sparkempty">Noch keine Daten — nächster Datenabruf.</div>';
    } else if (typeof renderLineChart === 'function') {
      chartHtml =
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|' +
        title +
        '" title="Chart vergrößern">' +
        renderLineChart(pts, { w: Math.min(640, 360), h: 140 }) +
        '</div>';
    } else {
      chartHtml = '<div class="sparkempty">' + pts.length + ' Punkte</div>';
    }

    var note =
      meta.note ||
      (isProxy
        ? 'Proxy aus SOFR − €STR in Prozentpunkten (ohne ×100). ' +
          'Nicht der offizielle CME XEURBI-Index; CME überschreibt, sobald verfügbar.'
        : 'Offizieller CME EUR/USD Cross-Currency Basis Index.');

    face.innerHTML =
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">' +
      title +
      '</div>' +
      '<div class="value">' +
      val +
      '</div>' +
      '<div class="date">' +
      dateLine +
      '</div>' +
      chartHtml +
      '<div class="sofr-fwd-meta">' +
      note +
      '</div>' +
      '</div>';
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
