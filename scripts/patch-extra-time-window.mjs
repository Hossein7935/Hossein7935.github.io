import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');
if (t.length < 5000) {
  console.error('eur-dollar.js broken');
  process.exit(1);
}

if (t.includes('function windowPts') && t.includes('extraChartsHtml(pack.dates[i])')) {
  console.log('time-window already present');
  process.exit(0);
}

const start = t.indexOf('function extraChartsHtml');
if (start < 0) {
  console.error('extraChartsHtml not found');
  process.exit(1);
}
const end = t.indexOf('\n  function bindExtra', start + 10);
if (end < 0) {
  console.error('end marker not found');
  process.exit(1);
}

const newFn = `function extraChartsHtml(focusDate) {
    var opts = [
      { key: 'effr', label: 'EFFR', hist: 'USA-effr', color: '#22c55e' },
      { key: 'sofr', label: 'SOFR', hist: 'USA-sofr', color: '#f59e0b' },
      { key: 'iorb', label: 'IORB', hist: 'USA-iorb', color: '#a78bfa' }
    ];
    if (!curveState.extra) curveState.extra = { effr: false, sofr: false, iorb: false };

    function parseDay(s) {
      if (!s) return null;
      var p = String(s).slice(0, 10).split('-');
      if (p.length < 3) return null;
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return isNaN(d.getTime()) ? null : d;
    }
    function shiftMonths(d, months) {
      var x = new Date(d.getTime());
      x.setMonth(x.getMonth() + months);
      return x;
    }
    function iso(d) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
    function windowPts(pts, centerIso) {
      if (!pts || !pts.length) return [];
      var center = parseDay(centerIso);
      if (!center) return pts.slice(-180);
      var from = shiftMonths(center, -6);
      var to = shiftMonths(center, 6);
      var fromS = iso(from);
      var toS = iso(to);
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var pr = String(pts[i].period || '').slice(0, 10);
        if (pr >= fromS && pr <= toS) out.push(pts[i]);
      }
      if (out.length < 5) {
        var best = 0, bestD = 1e15;
        var cTime = center.getTime();
        for (var j = 0; j < pts.length; j++) {
          var dj = parseDay(pts[j].period);
          if (!dj) continue;
          var dd = Math.abs(dj.getTime() - cTime);
          if (dd < bestD) { bestD = dd; best = j; }
        }
        var a = Math.max(0, best - 130);
        var b = Math.min(pts.length, best + 131);
        out = pts.slice(a, b);
      }
      return out;
    }

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

    var focus = focusDate || '';
    var charts = '';
    opts.forEach(function (o) {
      if (!curveState.extra[o.key]) return;
      var all = series(o.hist);
      var pts = windowPts(all, focus);
      var last = pts.length ? pts[pts.length - 1] : null;
      var focusVal = null;
      if (focus && pts.length) {
        for (var k = 0; k < pts.length; k++) {
          if (String(pts[k].period).slice(0, 10) === String(focus).slice(0, 10)) {
            focusVal = Number(pts[k].value);
            break;
          }
        }
        if (focusVal == null) {
          var c = parseDay(focus);
          if (c) {
            var bestK = 0, bestDk = 1e15;
            for (var k2 = 0; k2 < pts.length; k2++) {
              var dd2 = parseDay(pts[k2].period);
              if (!dd2) continue;
              var dist = Math.abs(dd2.getTime() - c.getTime());
              if (dist < bestDk) { bestDk = dist; bestK = k2; }
            }
            focusVal = Number(pts[bestK].value);
          }
        }
      }
      var val =
        focusVal != null && Number.isFinite(focusVal)
          ? focusVal.toFixed(3) + '%'
          : last
            ? Number(last.value).toFixed(3) + '%'
            : '—';
      var dateLine = focus
        ? 'Fokus ' + String(focus).slice(0, 10) + ' · Fenster ±6M · ' + pts.length + ' Punkte'
        : last
          ? 'Stand ' + last.period + ' · ' + pts.length + ' Punkte'
          : 'Keine Daten';
      var chartInner;
      if (!pts.length) {
        chartInner = '<div class="sparkempty">Keine ' + o.label + '-Daten im Fenster</div>';
      } else if (typeof renderLineChart === 'function') {
        chartInner =
          '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|' +
          o.key +
          '|' +
          o.label +
          '" title="Chart vergrößern" style="min-height:110px">' +
          renderLineChart(pts, { w: Math.min(640, 360), h: 120 }) +
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
        ' · um ' +
        (focus ? String(focus).slice(0, 10) : 'heute') +
        ' (±6 Monate)</div>' +
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
      '<div style="font-size:13px;font-weight:600;margin-bottom:6px">Weitere Charts darunter · folgen der Zeitachse (±6M)</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:2px">' +
      boxes +
      '</div>' +
      charts +
      '</div>'
    );
  }
`;

t = t.slice(0, start) + newFn + t.slice(end);

if (!t.includes('function bindExtraCharts(root, focusDate)')) {
  t = t.replace('function bindExtraCharts(root)', 'function bindExtraCharts(root, focusDate)');
}

t = t.replace(/fresh\.innerHTML = extraChartsHtml\([^)]*\);/g, 'fresh.innerHTML = extraChartsHtml(focusDate);');

// renderCurveBlock HTML
if (t.includes('extraChartsHtml()')) {
  t = t.replace('extraChartsHtml()', 'extraChartsHtml(pack.dates[i])');
}
if (t.includes('extraChartsHtml(focusDate)') && t.includes('root.innerHTML')) {
  // only replace the one in innerHTML assignment once
  const marker = 'root.innerHTML =';
  const hi = t.indexOf(marker);
  if (hi >= 0) {
    const chunk = t.slice(hi, hi + 500);
    const fixed = chunk.replace('extraChartsHtml(focusDate)', 'extraChartsHtml(pack.dates[i])').replace('extraChartsHtml()', 'extraChartsHtml(pack.dates[i])');
    t = t.slice(0, hi) + fixed + t.slice(hi + 500);
  }
}

// ensure bind call from renderCurveBlock
if (!t.includes('bindExtraCharts(root, pack.dates[i])')) {
  t = t.replace(
    'bindSpreadPanel(root, cur);',
    'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, pack.dates[i]);'
  );
}
// recursive binds inside bindExtraCharts keep focusDate
t = t.replace(/bindExtraCharts\(root\);/g, 'bindExtraCharts(root, focusDate);');

fs.writeFileSync(path, t);
console.log(
  'patch-extra-time-window done',
  t.includes('windowPts'),
  t.includes('extraChartsHtml(pack.dates[i])'),
  t.includes('bindExtraCharts(root, pack.dates[i])')
);
