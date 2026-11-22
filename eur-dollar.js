/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * Charts:
 *  1) DXY (Historie)
 *  2) EUR/USD (Historie)
 *  3) US vs DE Zinskurve 3M–30Y (blau / rot)
 *  4) Basis-Monitor SOFR−€STR / XEURBI
 *  5) 25Δ Risk Reversal Proxy
 * Daten: data.json, Update per GitHub Actions (wie Seite 4)
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

  function series(key) {
    return (typeof histories !== 'undefined' && histories[key]) || [];
  }

  function metaUSA(key) {
    return (typeof data !== 'undefined' && data.USA && data.USA[key]) || {};
  }

  function lineCard(opts) {
    var pts = series(opts.histKey);
    var last = pts.length ? pts[pts.length - 1] : null;
    var val = '—';
    if (last) {
      var n = Number(last.value);
      val =
        (opts.signed && n >= 0 ? '+' : '') +
        n.toFixed(opts.digits != null ? opts.digits : 2) +
        (opts.suffix || '');
    }
    var dateLine = last
      ? 'Stand ' +
        last.period +
        (opts.source ? ' · ' + opts.source : '') +
        ' · ' +
        pts.length +
        ' Punkte'
      : 'Keine Daten — nächster Datenabruf';
    var chartHtml;
    if (!pts.length) {
      chartHtml = '<div class="sparkempty">Noch keine Daten</div>';
    } else if (typeof renderLineChart === 'function') {
      chartHtml =
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|' +
        opts.dlgKey +
        '|' +
        opts.title +
        '" title="Chart vergrößern">' +
        renderLineChart(pts, { w: Math.min(640, 360), h: 130 }) +
        '</div>';
    } else {
      chartHtml = '<div class="sparkempty">' + pts.length + ' Punkte</div>';
    }
    return (
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">' +
      opts.title +
      '</div>' +
      '<div class="value">' +
      val +
      '</div>' +
      '<div class="date">' +
      dateLine +
      '</div>' +
      chartHtml +
      (opts.note
        ? '<div class="sofr-fwd-meta">' + opts.note + '</div>'
        : '') +
      '</div>'
    );
  }

  /** Dual yield curve SVG: X = tenors, Y = %, blue USA, red DE */
  function dualCurveSvg(usaPts, dePts) {
    var order = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'];
    var uMap = {};
    var dMap = {};
    (usaPts || []).forEach(function (p) {
      uMap[String(p.period).toUpperCase()] = Number(p.value);
    });
    (dePts || []).forEach(function (p) {
      dMap[String(p.period).toUpperCase()] = Number(p.value);
    });
    var labels = [];
    var uVals = [];
    var dVals = [];
    order.forEach(function (t) {
      if (Number.isFinite(uMap[t]) || Number.isFinite(dMap[t])) {
        labels.push(t);
        uVals.push(Number.isFinite(uMap[t]) ? uMap[t] : null);
        dVals.push(Number.isFinite(dMap[t]) ? dMap[t] : null);
      }
    });
    if (!labels.length) return '<div class="sparkempty">Keine Kurvendaten</div>';

    var all = uVals.concat(dVals).filter(function (v) {
      return v != null && Number.isFinite(v);
    });
    var ymin = Math.min.apply(null, all);
    var ymax = Math.max.apply(null, all);
    var pad = Math.max(0.15, (ymax - ymin) * 0.12 || 0.3);
    ymin -= pad;
    ymax += pad;

    var W = 640;
    var H = 200;
    var L = 42;
    var R = 12;
    var T = 14;
    var B = 28;
    var iw = W - L - R;
    var ih = H - T - B;

    function xAt(i) {
      return L + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
    }
    function yAt(v) {
      return T + ((ymax - v) / (ymax - ymin || 1)) * ih;
    }

    function path(vals) {
      var d = '';
      var started = false;
      for (var i = 0; i < vals.length; i++) {
        if (vals[i] == null || !Number.isFinite(vals[i])) {
          started = false;
          continue;
        }
        var cmd = started ? 'L' : 'M';
        d += cmd + xAt(i).toFixed(1) + ' ' + yAt(vals[i]).toFixed(1) + ' ';
        started = true;
      }
      return d.trim();
    }

    var ticks = '';
    for (var i = 0; i < labels.length; i++) {
      ticks +=
        '<text x="' +
        xAt(i).toFixed(1) +
        '" y="' +
        (H - 8) +
        '" text-anchor="middle" font-size="11" fill="#9aa4b2">' +
        labels[i] +
        '</text>';
    }
    var yLabels = '';
    for (var k = 0; k < 4; k++) {
      var v = ymin + ((ymax - ymin) * k) / 3;
      var yy = yAt(v);
      yLabels +=
        '<text x="' +
        (L - 6) +
        '" y="' +
        (yy + 3).toFixed(1) +
        '" text-anchor="end" font-size="10" fill="#9aa4b2">' +
        v.toFixed(1) +
        '</text>';
      yLabels +=
        '<line x1="' +
        L +
        '" x2="' +
        (W - R) +
        '" y1="' +
        yy.toFixed(1) +
        '" y2="' +
        yy.toFixed(1) +
        '" stroke="#2a3340" stroke-width="1"/>';
    }

    return (
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" width="100%" height="' +
      H +
      '" role="img" aria-label="US DE Zinskurve">' +
      yLabels +
      '<path d="' +
      path(uVals) +
      '" fill="none" stroke="#3b82f6" stroke-width="2.5"/>' +
      '<path d="' +
      path(dVals) +
      '" fill="none" stroke="#ef4444" stroke-width="2.5"/>' +
      ticks +
      '<text x="' +
      (L + 4) +
      '" y="' +
      (T + 12) +
      '" font-size="11" fill="#3b82f6">USA</text>' +
      '<text x="' +
      (L + 44) +
      '" y="' +
      (T + 12) +
      '" font-size="11" fill="#ef4444">DE</text>' +
      '</svg>'
    );
  }

  function curveCard() {
    var meta = metaUSA('usDeCurve');
    var usa = meta.usa || series('USA-usDeCurveUsa');
    var de = meta.de || series('USA-usDeCurveDe');
    var svg = dualCurveSvg(usa, de);
    var dateLine =
      (meta.date ? 'Stand ' + meta.date : '—') +
      (meta.source ? ' · ' + meta.source : '') +
      ' · blau USA · rot DE';
    return (
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">Zinskurve USA vs Deutschland (3M · 1Y · 2Y · 5Y · 10Y · 30Y)</div>' +
      '<div class="value">Rendite %</div>' +
      '<div class="date">' +
      dateLine +
      '</div>' +
      '<div class="yield-chart-wrap">' +
      svg +
      '</div>' +
      '<div class="sofr-fwd-meta">' +
      (meta.note ||
        'X = Laufzeit, Y = Zinssatz %. USA (blau) aus FRED, DE (rot) aus TradingView. Wird mit dem Daten-Workflow aktualisiert.') +
      '</div>' +
      '</div>'
    );
  }

  function paint() {
    var face = ensureFace();
    if (!face) return;

    var html = '';

    // DXY
    html += lineCard({
      histKey: 'USA-dxy',
      dlgKey: 'dxy',
      title: 'DXY · US Dollar Index',
      digits: 2,
      suffix: '',
      source: (metaUSA('dxy').source || 'Yahoo DX-Y.NYB'),
      note: 'Historischer Dollar-Index, Update über bestehenden DXY-Fetcher (Workflow).'
    });

    // EURUSD
    html += lineCard({
      histKey: 'USA-eurusd',
      dlgKey: 'eurusd',
      title: 'EUR/USD',
      digits: 4,
      suffix: '',
      source: (metaUSA('eurusd').source || 'Marktdaten'),
      note: 'EUR/USD mit Historie, Update über Daten-Workflow.'
    });

    // US vs DE curve
    html += curveCard();

    // Basis monitor
    var basisMeta = metaUSA('xeurbi');
    var isProxy =
      !basisMeta.source ||
      String(basisMeta.source).indexOf('Proxy') >= 0 ||
      String(basisMeta.source).indexOf('SOFR') >= 0;
    html += lineCard({
      histKey: 'USA-xeurbi',
      dlgKey: 'xeurbi',
      title: isProxy
        ? 'EUR/USD Basis-Monitor · Proxy (SOFR − €STR, %-Punkte)'
        : 'CME XEURBI · EUR/USD Cross-Currency Basis',
      digits: 2,
      suffix: isProxy ? ' %' : ' bp',
      signed: true,
      source: basisMeta.source || '',
      note:
        basisMeta.note ||
        'Proxy SOFR−€STR; CME XEURBI überschreibt, sobald verfügbar.'
    });

    // RR25
    var rrMeta = metaUSA('rr25');
    html += lineCard({
      histKey: 'USA-rr25',
      dlgKey: 'rr25',
      title: 'FX-Optionen · 25Δ Risk Reversal (Proxy)',
      digits: 2,
      suffix: ' vol',
      signed: true,
      source: rrMeta.source || '',
      note:
        rrMeta.note ||
        'Proxy aus realisierter Up-/Down-Vol (kein OTC-Broker-RR).'
    });

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
