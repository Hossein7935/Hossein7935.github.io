/*
 * MacroWatch – USA-Seite „EUR/Dollar“ (Seite 9)
 * US/DE-Kurve + Spread + optionale EFFR/SOFR/IORB Mini-Charts
 */
(function () {
  'use strict';

  var PAGE = 9;
  var LABEL = 'EUR/Dollar';
  var LS_PAGE = 'macrowatch-usa-page';
  var curveState = { idx: -1, pickA: null, pickB: null, extra: { effr: false, sofr: false, iorb: false } };

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

  function histMap(key) {
    var pts = series(key);
    var m = {};
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p && p.period != null && Number.isFinite(Number(p.value)))
        m[String(p.period).slice(0, 10)] = Number(p.value);
    }
    return m;
  }

  function buildPackFromHistories() {
    var tenors = [
      { t: '3M', us: 'USA-us3m', de: 'DEU-y3m' },
      { t: '1Y', us: 'USA-us1y', de: 'DEU-y1y' },
      { t: '2Y', us: 'USA-us2y', de: 'DEU-y2y' },
      { t: '5Y', us: 'USA-us5y', de: 'DEU-y5y' },
      { t: '10Y', us: 'USA-us10y', de: 'DEU-y10y' },
      { t: '30Y', us: 'USA-us30y', de: 'DEU-y30y' }
    ];
    var maps = tenors.map(function (x) {
      return { t: x.t, us: histMap(x.us), de: histMap(x.de) };
    });
    var dateSet = {};
    maps.forEach(function (m) {
      Object.keys(m.us).forEach(function (d) { dateSet[d] = 1; });
      Object.keys(m.de).forEach(function (d) { dateSet[d] = 1; });
    });
    var dates = Object.keys(dateSet).sort();
    if (!dates.length) return { dates: [], curves: [] };
    var lastU = {};
    var lastD = {};
    var outDates = [];
    var outCurves = [];
    for (var i = 0; i < dates.length; i++) {
      var day = dates[i];
      for (var j = 0; j < maps.length; j++) {
        if (maps[j].us[day] != null) lastU[maps[j].t] = maps[j].us[day];
        if (maps[j].de[day] != null) lastD[maps[j].t] = maps[j].de[day];
      }
      var usa = [];
      var de = [];
      for (var k = 0; k < tenors.length; k++) {
        var tt = tenors[k].t;
        if (lastU[tt] != null) usa.push({ period: tt, value: lastU[tt] });
        if (lastD[tt] != null) de.push({ period: tt, value: lastD[tt] });
      }
      if (usa.length >= 3 && de.length >= 3) {
        outDates.push(day);
        outCurves.push({ usa: usa, de: de });
      }
    }
    if (outDates.length > 2200) {
      outDates = outDates.slice(-2200);
      outCurves = outCurves.slice(-2200);
    }
    return {
      dates: outDates,
      curves: outCurves,
      source: 'Historien USA-us* / DEU-y*',
      note: 'Aus Einzelserien rekonstruiert'
    };
  }

  function getDailyPack() {
    var pack = metaUSA('usDeCurveDaily');
    if (pack && Array.isArray(pack.dates) && pack.dates.length && Array.isArray(pack.curves) && pack.curves.length)
      return pack;
    if (typeof data !== 'undefined' && data.USA) {
      if (data.USA.usDeCurveDaily && data.USA.usDeCurveDaily.dates && data.USA.usDeCurveDaily.dates.length)
        return data.USA.usDeCurveDaily;
      if (data.USA.usDeCurve && data.USA.usDeCurve.usa) {
        return {
          dates: [data.USA.usDeCurve.date || '—'],
          curves: [{ usa: data.USA.usDeCurve.usa, de: data.USA.usDeCurve.de || [] }],
          source: data.USA.usDeCurve.source
        };
      }
    }
    var built = buildPackFromHistories();
    if (built.dates.length) {
      try {
        if (typeof data !== 'undefined') {
          data.USA = data.USA || {};
          data.USA.usDeCurveDaily = built;
          data.USA.usDeCurve = {
            usa: built.curves[built.curves.length - 1].usa,
            de: built.curves[built.curves.length - 1].de,
            date: built.dates[built.dates.length - 1],
            source: built.source
          };
        }
      } catch (e) {}
      return built;
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
    order.forEach(function (tn) {
      if (Number.isFinite(uMap[tn]) || Number.isFinite(dMap[tn])) {
        labels.push(tn);
        uVals.push(Number.isFinite(uMap[tn]) ? uMap[tn] : null);
        dVals.push(Number.isFinite(dMap[tn]) ? dMap[tn] : null);
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
      '<div style="font-size:11px;color:#9aa4b2;margin-top:4px">Zeitachse: Schieber/Maus · ← → (Shift=5 Tage) · Mausrad · Hover = USA/DE %</div>' +
      '</div>'
    );
  }

  function mapTenors(pts) {
    var m = {};
    (pts || []).forEach(function (p) {
      m[String(p.period).toUpperCase()] = Number(p.value);
    });
    return m;
  }

  function spreadPanelHtml(cur) {
    var order = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'];
    var uMap = mapTenors(cur.usa);
    var dMap = mapTenors(cur.de);
    var a = curveState.pickA;
    var b = curveState.pickB;

    var btns = order
      .map(function (tn) {
        var has = Number.isFinite(uMap[tn]) || Number.isFinite(dMap[tn]);
        if (!has) return '';
        var cls = 'usde-tenor-btn';
        if (a === tn) cls += ' is-a';
        if (b === tn) cls += ' is-b';
        return (
          '<button type="button" class="' +
          cls +
          '" data-tenor="' +
          tn +
          '" style="' +
          'min-width:48px;min-height:40px;padding:8px 12px;margin:3px;border-radius:10px;' +
          'border:1px solid #3a4556;background:#1a2332;color:#e8eef7;font-size:14px;font-weight:600;' +
          'touch-action:manipulation;-webkit-tap-highlight-color:transparent;' +
          (a === tn ? 'background:#1e3a5f;border-color:#3b82f6;' : '') +
          (b === tn ? 'background:#3f1d1d;border-color:#ef4444;' : '') +
          '">' +
          tn +
          '</button>'
        );
      })
      .join('');

    function fmt(v) {
      if (!Number.isFinite(v)) return '—';
      return (v >= 0 ? '+' : '') + v.toFixed(3) + ' %';
    }

    var rows = '';
    if (a && b && a !== b) {
      var uA = uMap[a],
        uB = uMap[b],
        dA = dMap[a],
        dB = dMap[b];
      var usaDiff = Number.isFinite(uA) && Number.isFinite(uB) ? uA - uB : NaN;
      var deDiff = Number.isFinite(dA) && Number.isFinite(dB) ? dA - dB : NaN;
      rows =
        '<div style="margin-top:8px;font-size:13px;line-height:1.5">' +
        '<div><span style="color:#3b82f6">USA ' +
        a +
        ' − ' +
        b +
        '</span>: <b>' +
        fmt(usaDiff) +
        '</b></div>' +
        '<div><span style="color:#ef4444">DE ' +
        a +
        ' − ' +
        b +
        '</span>: <b>' +
        fmt(deDiff) +
        '</b></div>' +
        '</div>';
    } else if (a && !b) {
      rows =
        '<div style="margin-top:8px;font-size:13px;color:#9aa4b2">Zweite Laufzeit tippen (A = ' +
        a +
        ')</div>';
    } else {
      rows =
        '<div style="margin-top:8px;font-size:13px;color:#9aa4b2">Zwei Laufzeiten tippen → Spread A − B</div>';
    }

    var cross = '';
    if (a && Number.isFinite(uMap[a]) && Number.isFinite(dMap[a])) {
      cross =
        '<div style="font-size:13px;margin-top:4px">USA−DE @ ' +
        a +
        ': <b>' +
        fmt(uMap[a] - dMap[a]) +
        '</b></div>';
    }
    if (b && a !== b && Number.isFinite(uMap[b]) && Number.isFinite(dMap[b])) {
      cross +=
        '<div style="font-size:13px">USA−DE @ ' +
        b +
        ': <b>' +
        fmt(uMap[b] - dMap[b]) +
        '</b></div>';
    }

    return (
      '<div class="usde-spread-panel" style="margin-top:10px;padding:10px;border:1px solid #2a3340;border-radius:12px;background:#121a26">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:6px">Spread-Rechner (touch-freundlich)</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:2px">' +
      btns +
      '</div>' +
      rows +
      cross +
      '<div style="margin-top:8px">' +
      '<button type="button" class="usde-spread-reset" style="min-height:36px;padding:6px 12px;border-radius:8px;border:1px solid #3a4556;background:#1a2332;color:#9aa4b2;font-size:12px;touch-action:manipulation">Auswahl zurücksetzen</button>' +
      '</div>' +
      '</div>'
    );
  }

  function bindSpreadPanel(root, cur) {
    var panel = root.querySelector('.usde-spread-panel');
    if (!panel) return;
    panel.querySelectorAll('.usde-tenor-btn').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var tn = btn.getAttribute('data-tenor');
        if (!curveState.pickA || (curveState.pickA && curveState.pickB)) {
          curveState.pickA = tn;
          curveState.pickB = null;
        } else if (curveState.pickA === tn) {
          curveState.pickA = null;
        } else {
          curveState.pickB = tn;
        }
        var host = root.querySelector('.usde-spread-panel');
        if (host) {
          var fresh = document.createElement('div');
          fresh.innerHTML = spreadPanelHtml(cur);
          var neu = fresh.firstChild;
          host.replaceWith(neu);
          bindSpreadPanel(root, cur);
        }
      });
    });
    var reset = panel.querySelector('.usde-spread-reset');
    if (reset) {
      reset.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        curveState.pickA = null;
        curveState.pickB = null;
        var host = root.querySelector('.usde-spread-panel');
        if (host) {
          var fresh = document.createElement('div');
          fresh.innerHTML = spreadPanelHtml(cur);
          host.replaceWith(fresh.firstChild);
          bindSpreadPanel(root, cur);
        }
      });
    }
  }

  function extraChartsHtml() {
    var opts = [
      { key: 'effr', label: 'EFFR', hist: 'USA-effr', color: '#22c55e' },
      { key: 'sofr', label: 'SOFR', hist: 'USA-sofr', color: '#f59e0b' },
      { key: 'iorb', label: 'IORB', hist: 'USA-iorb', color: '#a78bfa' }
    ];
    if (!curveState.extra) curveState.extra = { effr: false, sofr: false, iorb: false };
    var boxes = opts
      .map(function (o) {
        var on = !!curveState.extra[o.key];
        return (
          '<label class="usde-extra-cb" style="display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 12px;margin:3px;border-radius:10px;border:1px solid ' +
          (on ? o.color : '#3a4556') +
          ';background:' +
          (on ? '#1a2332' : '#121a26') +
          ';color:#e8eef7;font-size:13px;font-weight:600;touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent">' +
          '<input type="checkbox" data-extra="' +
          o.key +
          '" ' +
          (on ? 'checked ' : '') +
          'style="width:18px;height:18px;accent-color:' +
          o.color +
          '"/>' +
          o.label +
          '</label>'
        );
      })
      .join('');

    var charts = '';
    opts.forEach(function (o) {
      if (!curveState.extra[o.key]) return;
      var pts = series(o.hist);
      var last = pts.length ? pts[pts.length - 1] : null;
      var val = last ? Number(last.value).toFixed(3) + '%' : '—';
      var dateLine = last
        ? 'Stand ' + last.period + ' · ' + pts.length + ' Punkte'
        : 'Keine Daten';
      var chartInner;
      if (!pts.length) {
        chartInner = '<div class="sparkempty">Keine ' + o.label + '-Daten</div>';
      } else if (typeof renderLineChart === 'function') {
        chartInner =
          '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|' +
          o.key +
          '|' +
          o.label +
          '" title="Chart vergrößern" style="min-height:90px">' +
          renderLineChart(pts, { w: Math.min(640, 360), h: 100 }) +
          '</div>';
      } else {
        chartInner = '<div class="sparkempty">' + pts.length + ' Punkte</div>';
      }
      charts +=
        '<div class="usde-extra-chart metric has-chart" style="grid-column:1/-1;margin-top:8px;padding:8px;border:1px solid #2a3340;border-radius:10px;background:#0f1620">' +
        '<div class="name" style="color:' +
        o.color +
        '">' +
        o.label +
        ' (zusätzlich)</div>' +
        '<div class="value" style="font-size:16px">' +
        val +
        '</div>' +
        '<div class="date">' +
        dateLine +
        '</div>' +
        chartInner +
        '</div>';
    });

    return (
      '<div class="usde-extra-panel" style="margin-top:10px;padding:10px;border:1px solid #2a3340;border-radius:12px;background:#121a26">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:6px">Weitere Charts darunter (Renditekurve bleibt)</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:2px">' +
      boxes +
      '</div>' +
      charts +
      '</div>'
    );
  }

  function bindExtraCharts(root) {
    var panel = root.querySelector('.usde-extra-panel');
    if (!panel) return;
    panel.querySelectorAll('input[data-extra]').forEach(function (cb) {
      cb.addEventListener('change', function (ev) {
        ev.stopPropagation();
        var key = cb.getAttribute('data-extra');
        if (!curveState.extra) curveState.extra = { effr: false, sofr: false, iorb: false };
        curveState.extra[key] = !!cb.checked;
        var host = root.querySelector('.usde-extra-panel');
        if (host) {
          var fresh = document.createElement('div');
          fresh.innerHTML = extraChartsHtml();
          host.replaceWith(fresh.firstChild);
          bindExtraCharts(root);
        }
      });
    });
    panel.addEventListener(
      'click',
      function (e) {
        if (e.target && (e.target.closest('label.usde-extra-cb') || e.target.matches('input[data-extra]'))) {
          e.stopPropagation();
        }
      },
      true
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
      h: big ? 300 : 200,
      date: pack.dates[i]
    });
    root.innerHTML =
      svg +
      timeAxisHtml(pack, i) +
      spreadPanelHtml(cur) +
      extraChartsHtml() +
      (big ? '<div class="chart-tip-inline" id="chartDlgTip"></div>' : '');
    bindSpreadPanel(root, cur);
    bindExtraCharts(root);

    var range = root.querySelector('.usde-time-range');
    function goTo(ni) {
      ni = Math.max(0, Math.min(pack.dates.length - 1, Number(ni)));
      if (!Number.isFinite(ni)) return;
      if (ni === curveState.idx) return;
      renderCurveBlock(root, ni);
      if (big && typeof bindBigChartHover === 'function') {
        bindBigChartHover(root);
      }
      var r2 = root.querySelector('.usde-time-range');
      if (r2) {
        try { r2.focus(); } catch (e) {}
      }
    }
    if (range) {
      range.addEventListener('input', function (ev) { goTo(ev.target.value); });
      range.addEventListener('change', function (ev) { goTo(ev.target.value); });
      range.setAttribute('tabindex', '0');
      range.addEventListener('keydown', function (ev) {
        var step = ev.shiftKey ? 5 : 1;
        if (ev.key === 'ArrowLeft' || ev.key === 'Left') {
          ev.preventDefault();
          ev.stopPropagation();
          goTo(curveState.idx - step);
        } else if (ev.key === 'ArrowRight' || ev.key === 'Right') {
          ev.preventDefault();
          ev.stopPropagation();
          goTo(curveState.idx + step);
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          goTo(0);
        } else if (ev.key === 'End') {
          ev.preventDefault();
          goTo(pack.dates.length - 1);
        }
      });
      range.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        var dir = (ev.deltaY > 0 || ev.deltaX > 0) ? 1 : -1;
        goTo(curveState.idx + dir);
      }, { passive: false });
      try { range.focus(); } catch (e) {}
    }
    var axis = root.querySelector('.usde-time-axis');
    if (axis) {
      axis.addEventListener('mousedown', function () {
        if (range) try { range.focus(); } catch (e) {}
      });
      axis.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        var dir = (ev.deltaY > 0 || ev.deltaX > 0) ? 1 : -1;
        goTo(curveState.idx + dir);
      }, { passive: false });
    }
    bindCurveHover(root, cur);
  }

  function bindCurveHover(root, cur) {
    var svg = root.querySelector('svg.usde-curve-svg');
    if (!svg) return;
    var tip = root.querySelector('.usde-hover-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'usde-hover-tip';
      tip.style.cssText = 'position:absolute;pointer-events:none;background:rgba(16,24,39,0.95);border:1px solid #3a4556;padding:6px 10px;border-radius:8px;font-size:12px;color:#e8eef7;z-index:6;opacity:0;white-space:nowrap;box-shadow:0 4px 16px #0006';
      if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
      root.appendChild(tip);
    }
    var order = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'];
    var uMap = {}, dMap = {};
    (cur.usa || []).forEach(function (p) { uMap[String(p.period).toUpperCase()] = Number(p.value); });
    (cur.de || []).forEach(function (p) { dMap[String(p.period).toUpperCase()] = Number(p.value); });
    function nearestTenor(clientX) {
      var rect = svg.getBoundingClientRect();
      var x = clientX - rect.left;
      var labels = order.filter(function (tn) { return Number.isFinite(uMap[tn]) || Number.isFinite(dMap[tn]); });
      if (!labels.length) return null;
      var vbW = svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : 640;
      var scale = rect.width / vbW;
      var lPx = 42 * scale;
      var rPx = 12 * scale;
      var inner = rect.width - lPx - rPx;
      var best = 0, bestDist = 1e9;
      for (var i = 0; i < labels.length; i++) {
        var xi = labels.length === 1 ? lPx + inner / 2 : lPx + (i / (labels.length - 1)) * inner;
        var d = Math.abs(x - xi);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return labels[best];
    }
    svg.addEventListener('mousemove', function (ev) {
      var tn = nearestTenor(ev.clientX);
      if (!tn) { tip.style.opacity = '0'; return; }
      var u = uMap[tn], d = dMap[tn];
      var lines = '<b>' + tn + '</b>';
      if (Number.isFinite(u)) lines += ' · <span style="color:#3b82f6">USA ' + u.toFixed(3) + '%</span>';
      if (Number.isFinite(d)) lines += ' · <span style="color:#ef4444">DE ' + d.toFixed(3) + '%</span>';
      tip.innerHTML = lines;
      tip.style.opacity = '1';
      var rect = root.getBoundingClientRect();
      var left = ev.clientX - rect.left + 12;
      var top = ev.clientY - rect.top + 12;
      if (left > rect.width - 180) left = ev.clientX - rect.left - 180;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    });
    svg.addEventListener('mouseleave', function () { tip.style.opacity = '0'; });
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
      '<div class="sofr-fwd-meta">Obere X-Achse = Laufzeit. Untere Zeitachse = Kalendertag. ← → / Maus / Hover. Kästchen = weitere Charts.</div>' +
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
              e.target.closest('.usde-time-axis') ||
              e.target.closest('.usde-spread-panel') ||
              e.target.closest('.usde-extra-panel'))
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
            'USA blau · DE rot · ← → / Mausrad · Hover · Kästchen EFFR/SOFR/IORB · ' +
            (pack.dates.length || 0) +
            ' Tage';
        }
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__usDeCurve = true;
    paintChartDlg = wrapped;
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
    setUsaPage = wrappedSet;
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
