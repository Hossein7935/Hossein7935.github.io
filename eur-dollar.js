/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * US/DE-Kurve: Vergrößern + Zeitachse (täglich) — Maus bewegt beide Kurven
 */
(function () {
  'use strict';

  var PAGE = 9;
  var LABEL = 'EUR/Dollar';
  var LS_PAGE = 'macrowatch-usa-page';
  var curveState = { idx: -1 };

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
      : 'Keine Daten';
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
      (opts.note ? '<div class="sofr-fwd-meta">' + opts.note + '</div>' : '') +
      '</div>'
    );
  }

  function getDailyPack() {
    var pack = metaUSA('usDeCurveDaily');
    if (pack && Array.isArray(pack.dates) && pack.dates.length) return pack;
    var snap = metaUSA('usDeCurve');
    if (snap && snap.usa) {
      return {
        dates: [snap.date || '—'],
        curves: [{ usa: snap.usa, de: snap.de }],
        source: snap.source
      };
    }
    return { dates: [], curves: [] };
  }

  function dualCurveSvg(usaPts, dePts, opts) {
    opts = opts || {};
    var W = opts.w || 640;
    var H = opts.h || 220;
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

    var L = 42;
    var R = 12;
    var T = 16;
    var B = 30;
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

    var hits = '';
    for (var i = 0; i < labels.length; i++) {
      if (uVals[i] != null && Number.isFinite(uVals[i])) {
        hits +=
          '<circle class="hit" cx="' +
          xAt(i).toFixed(1) +
          '" cy="' +
          yAt(uVals[i]).toFixed(1) +
          '" r="4" fill="#3b82f6" data-period="' +
          labels[i] +
          ' USA" data-value="' +
          Number(uVals[i]).toFixed(3) +
          '%"></circle>';
      }
      if (dVals[i] != null && Number.isFinite(dVals[i])) {
        hits +=
          '<circle class="hit" cx="' +
          xAt(i).toFixed(1) +
          '" cy="' +
          yAt(dVals[i]).toFixed(1) +
          '" r="4" fill="#ef4444" data-period="' +
          labels[i] +
          ' DE" data-value="' +
          Number(dVals[i]).toFixed(3) +
          '%"></circle>';
      }
    }

    var ticks = '';
    for (var j = 0; j < labels.length; j++) {
      ticks +=
        '<text x="' +
        xAt(j).toFixed(1) +
        '" y="' +
        (H - 8) +
        '" text-anchor="middle" font-size="11" fill="#9aa4b2">' +
        labels[j] +
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
        v.toFixed(2) +
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
      '<svg class="chart-hover usde-curve-svg" viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" width="100%" height="' +
      H +
      '" style="max-width:100%;height:auto;cursor:crosshair" role="img">' +
      yLabels +
      '<path d="' +
      path(uVals) +
      '" fill="none" stroke="#3b82f6" stroke-width="2.5"/>' +
      '<path d="' +
      path(dVals) +
      '" fill="none" stroke="#ef4444" stroke-width="2.5"/>' +
      hits +
      ticks +
      '<text x="' +
      (L + 4) +
      '" y="' +
      (T + 10) +
      '" font-size="11" fill="#3b82f6">USA</text>' +
      '<text x="' +
      (L + 44) +
      '" y="' +
      (T + 10) +
      '" font-size="11" fill="#ef4444">DE</text>' +
      '</svg>'
    );
  }

  function timeAxisHtml(pack, idx) {
    var n = pack.dates.length;
    if (!n) return '';
    var i = idx < 0 ? n - 1 : idx;
    if (i > n - 1) i = n - 1;
    var date = pack.dates[i] || '—';
    var first = pack.dates[0];
    var last = pack.dates[n - 1];
    return (
      '<div class="usde-time-axis" style="margin-top:8px;user-select:none">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:#9aa4b2;margin-bottom:4px">' +
      '<span>' +
      first +
      '</span>' +
      '<span class="usde-time-label" style="color:#e8eef7;font-weight:600">Tag: ' +
      date +
      ' · ' +
      (i + 1) +
      '/' +
      n +
      '</span>' +
      '<span>' +
      last +
      '</span>' +
      '</div>' +
      '<input type="range" class="usde-time-range" min="0" max="' +
      (n - 1) +
      '" value="' +
      i +
      '" step="1" style="width:100%;cursor:ew-resize" ' +
      'aria-label="Zeitachse tägliche Zinskurve"/>' +
      '<div style="font-size:11px;color:#9aa4b2;margin-top:4px">Zeitachse (täglich): Maus/Schieber bewegt USA- und DE-Kurve gemeinsam</div>' +
      '</div>'
    );
  }

  function renderCurveBlock(root, idx) {
    var pack = getDailyPack();
    if (!pack.dates.length) {
      root.innerHTML = '<div class="sparkempty">Keine Kurvendaten</div>';
      return;
    }
    var i = idx < 0 ? pack.dates.length - 1 : idx;
    if (i > pack.dates.length - 1) i = pack.dates.length - 1;
    curveState.idx = i;
    var cur = pack.curves[i] || { usa: [], de: [] };
    var big = root.getAttribute('data-big') === '1';
    var svg = dualCurveSvg(cur.usa, cur.de, {
      w: big ? 720 : 640,
      h: big ? 300 : 200
    });
    root.innerHTML =
      svg +
      timeAxisHtml(pack, i) +
      (big ? '<div class="chart-tip-inline" id="chartDlgTip"></div>' : '');

    var range = root.querySelector('.usde-time-range');
    if (range) {
      var onMove = function (ev) {
        var ni = Number(ev.target.value);
        if (ni === curveState.idx) return;
        renderCurveBlock(root, ni);
        if (big && typeof bindBigChartHover === 'function') {
          bindBigChartHover(root);
        }
      };
      range.addEventListener('input', onMove);
      range.addEventListener('change', onMove);
    }
  }

  function curveCard() {
    var pack = getDailyPack();
    var meta = metaUSA('usDeCurve');
    var dateLine =
      (pack.dates.length
        ? pack.dates.length +
          ' Tage Historie · ' +
          pack.dates[0] +
          ' → ' +
          pack.dates[pack.dates.length - 1]
        : '—') +
      (meta.source || pack.source ? ' · ' + (meta.source || pack.source) : '') +
      ' · blau USA · rot DE';

    return (
      '<div class="metric has-chart" style="grid-column:1/-1">' +
      '<div class="name">Zinskurve USA vs Deutschland (3M · 1Y · 2Y · 5Y · 10Y · 30Y)</div>' +
      '<div class="value">Rendite %</div>' +
      '<div class="date">' +
      dateLine +
      '</div>' +
      '<div class="yield-chart-wrap usde-curve-root" role="button" tabindex="0" data-chart="USA|usDeCurve|Zinskurve USA vs DE" title="Chart vergrößern">' +
      '</div>' +
      '<div class="sofr-fwd-meta">Obere X-Achse = Laufzeit. Untere Zeitachse = Kalendertag (täglich). Schieber bewegt beide Kurven.</div>' +
      '</div>'
    );
  }

  function paint() {
    var face = ensureFace();
    if (!face) return;

    var html = '';
    html += lineCard({
      histKey: 'USA-dxy',
      dlgKey: 'dxy',
      title: 'DXY · US Dollar Index',
      digits: 2,
      source: metaUSA('dxy').source || 'Yahoo',
      note: 'Dollar-Index Historie'
    });
    html += lineCard({
      histKey: 'USA-eurusd',
      dlgKey: 'eurusd',
      title: 'EUR/USD',
      digits: 4,
      source: metaUSA('eurusd').source || '',
      note: 'EUR/USD Historie'
    });
    html += curveCard();

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
        : 'CME XEURBI',
      digits: 2,
      suffix: isProxy ? ' %' : ' bp',
      signed: true,
      source: basisMeta.source || '',
      note: basisMeta.note || ''
    });
    html += lineCard({
      histKey: 'USA-rr25',
      dlgKey: 'rr25',
      title: 'FX-Optionen · 25Δ Risk Reversal (Proxy)',
      digits: 2,
      suffix: ' vol',
      signed: true,
      source: metaUSA('rr25').source || '',
      note: metaUSA('rr25').note || ''
    });

    face.innerHTML = html;

    var root = face.querySelector('.usde-curve-root');
    if (root) {
      root.addEventListener(
        'click',
        function (e) {
          if (
            e.target &&
            (e.target.classList.contains('usde-time-range') ||
              e.target.closest('.usde-time-axis'))
          ) {
            e.stopPropagation();
          }
        },
        true
      );
      renderCurveBlock(root, curveState.idx);
    }
  }

  function patchPaintChartDlg() {
    if (typeof paintChartDlg !== 'function' || paintChartDlg.__usDeCurve) return;
    var orig = paintChartDlg;
    var wrapped = function () {
      if (typeof chartCtx !== 'undefined' && chartCtx && chartCtx.key === 'usDeCurve') {
        var rangeBar = document.querySelector('#chartRange');
        if (rangeBar) rangeBar.style.display = 'none';
        var body = document.querySelector('#chartBody');
        var metaEl = document.querySelector('#chartMeta');
        if (!body) return;
        body.innerHTML = '';
        body.setAttribute('data-big', '1');
        body.classList.add('usde-curve-root');
        renderCurveBlock(body, curveState.idx);
        if (typeof bindBigChartHover === 'function') bindBigChartHover(body);
        if (metaEl) {
          var pack = getDailyPack();
          metaEl.textContent =
            'USA blau · DE rot · Zeitachse täglich · ' +
            (pack.dates.length || 0) +
            ' Tage · Schieber bewegt beide Kurven';
        }
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__usDeCurve = true;
    paintChartDlg = wrapped; // eslint-disable-line no-global-assign
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
    var wrappedSet = function (page) {
      ensureButtons();
      if (Number(page) === PAGE) {
        var ret = origSet.apply(this, arguments);
        showPage();
        setTimeout(showPage, 50);
        setTimeout(showPage, 300);
        return ret;
      }
      var f = document.querySelector('.usa-face-j');
      if (f) f.classList.add('hidden');
      return origSet.apply(this, arguments);
    };
    wrappedSet.__eurDollar = true;
    setUsaPage = wrappedSet; // eslint-disable-line no-global-assign
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
    patchPaintChartDlg();
    ensureButtons();
    var start = 0;
    try {
      start = Number(localStorage.getItem(LS_PAGE) || '0');
    } catch (e) {}
    if (start === PAGE) showPage();
    setTimeout(function () {
      patchPaintChartDlg();
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
