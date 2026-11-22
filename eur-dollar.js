/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * CME XEURBI Chart. Öffnet unabhängig vom setUsaPage-Max (Credit-Muster).
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
      var after = card.querySelector('.usa-face-i') || card.querySelector('.usa-face-h') || card.querySelector('.usa-face-g');
      if (after && after.parentNode) after.after(face);
      else card.appendChild(face);
    }
    if (!face.querySelector('#xeurbiChart')) {
      face.innerHTML =
        '<div class="metric has-chart" id="xeurbiPanel" style="grid-column:1/-1">' +
        '<div class="name">CME XEURBI · EUR/USD Cross-Currency Basis Index</div>' +
        '<div class="value" id="xeurbiValue">—</div>' +
        '<div class="date" id="xeurbiDate">CME · Basispunkte</div>' +
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|XEURBI" title="Chart vergrößern" id="xeurbiChart"></div>' +
        '<div class="sofr-fwd-meta" id="xeurbiMeta">XEURBI in bp · Seite öffnet auch ohne Daten</div>' +
        '</div>';
    }
    return face;
  }

  function paint() {
    var face = ensureFace();
    if (!face) return;
    var pts = (typeof histories !== 'undefined' && histories['USA-xeurbi']) || [];
    var meta = (typeof data !== 'undefined' && data.USA && data.USA.xeurbi) || {};
    var last = pts.length ? pts[pts.length - 1] : null;
    var valEl = document.getElementById('xeurbiValue');
    var dateEl = document.getElementById('xeurbiDate');
    var host = document.getElementById('xeurbiChart');
    var metaEl = document.getElementById('xeurbiMeta');
    if (valEl) {
      valEl.textContent = last
        ? (Number(last.value) >= 0 ? '+' : '') + Number(last.value).toFixed(2) + ' bp'
        : '—';
    }
    if (dateEl) {
      dateEl.textContent = last
        ? 'Stand ' + last.period + ' · ' + (meta.source || 'CME XEURBI') + ' · ' + pts.length + ' Punkte'
        : 'Noch keine CME-Daten — Seite ist aktiv; Chart füllt sich nach erfolgreichem Abruf';
    }
    if (host) {
      if (!pts.length) {
        host.innerHTML =
          '<div class="sparkempty">Keine XEURBI-Historie bisher. Die Seite funktioniert; Daten kommen über den CME-Fetch (Index seit 2024-07-27).</div>';
      } else if (typeof renderLineChart === 'function') {
        host.innerHTML = renderLineChart(pts, {
          w: Math.min(640, host.clientWidth || 360),
          h: 120
        });
        host.setAttribute('data-chart', 'USA|xeurbi|XEURBI');
      }
    }
    if (metaEl) {
      metaEl.textContent =
        meta.note ||
        'CME XEURBI · EUR/USD Cross-Currency Basis (bp) · Index-Start 2024-07-27';
    }
  }

  function showPage() {
    try {
      localStorage.setItem(LS_PAGE, String(PAGE));
    } catch (e) {}
    ensureButtons();
    var face = ensureFace();
    if (!face) return;
    var card = face.closest('.country');
    card.querySelectorAll('.usa-face').forEach(function (f) {
      f.classList.toggle('hidden', f !== face);
    });
    document.querySelectorAll('#usaPageSelect button, .usa-page-select button').forEach(function (b) {
      b.classList.toggle('active', Number(b.getAttribute('data-page')) === PAGE);
    });
    paint();
  }

  // Wrap setUsaPage so page 9 always opens (ignores Math.min(7))
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

  // Also intercept clicks in capture phase (before other handlers clamp)
  if (!window.__eurDollarClickBound) {
    window.__eurDollarClickBound = true;
    document.addEventListener(
      'click',
      function (e) {
        var btn = e.target && e.target.closest && e.target.closest('#usaPageSelect button, .usa-page-select button');
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
    // Retry once after data/UI settle
    setTimeout(function () {
      ensureButtons();
      try {
        if (Number(localStorage.getItem(LS_PAGE)) === PAGE) showPage();
      } catch (e) {}
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // After main refresh/bindUsaPages
  setTimeout(boot, 1200);
})();
