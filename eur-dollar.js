/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * Nur Cross-Currency Basis: CME XEURBI (bp)
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

    var val = '—';
    if (last) {
      val =
        (Number(last.value) >= 0 ? '+' : '') +
        Number(last.value).toFixed(2) +
        ' bp';
    }

    var dateLine = last
      ? 'Stand ' +
        last.period +
        ' · ' +
        (meta.source || 'CME XEURBI') +
        ' · ' +
        pts.length +
        ' Punkte'
      : 'Noch keine XEURBI-Daten — CME Cross-Currency Basis Index (kostenpflichtig/gesperrt)';

    var chartHtml;
    if (!pts.length) {
      chartHtml =
        '<div class="sparkempty" style="padding:12px 4px;line-height:1.45">' +
        '<b>CME XEURBI · EUR/USD Cross-Currency Basis Index</b><br>' +
        'Misst die Abweichung von Covered Interest Parity in <b>Basispunkten</b> ' +
        '(aus €STR-, SOFR- und EUR/USD-Futures).<br><br>' +
        'Offizielle Historie liegt bei CME DataMine. Der kostenlose Server-Abruf ist derzeit blockiert (403/401). ' +
        'Sobald Werte ankommen, erscheint hier der Chart automatisch.' +
        '</div>';
    } else if (typeof renderLineChart === 'function') {
      chartHtml =
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|XEURBI" title="Chart vergrößern">' +
        renderLineChart(pts, { w: Math.min(640, 360), h: 140 }) +
        '</div>';
    } else {
      chartHtml = '<div class="sparkempty">' + pts.length + ' Punkte</div>';
    }

    face.innerHTML =
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">CME XEURBI · EUR/USD Cross-Currency Basis</div>' +
      '<div class="value">' +
      val +
      '</div>' +
      '<div class="date">' +
      dateLine +
      '</div>' +
      chartHtml +
      '<div class="sofr-fwd-meta">' +
      (meta.note ||
        'Nur Cross-Currency Basis (bp) · kein EZB-Kassakurs · kein SOFR−€STR-Spread') +
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
