import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

// Ensure curveState has extra
if (!t.includes('extra: { effr')) {
  t = t.replace(
    /var curveState = \{[^}]*\};/,
    "var curveState = { idx: -1, pickA: null, pickB: null, extra: { effr: false, sofr: false, iorb: false } };"
  );
}

if (!t.includes('function extraChartsHtml')) {
  const helper = `
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

`;
  t = t.replace('  function renderCurveBlock(root, idx) {', helper + '  function renderCurveBlock(root, idx) {');
}

if (!t.includes('extraChartsHtml()')) {
  t = t.replace(
    'spreadPanelHtml(cur) +',
    'spreadPanelHtml(cur) +\n      extraChartsHtml() +'
  );
}
if (!t.includes('bindExtraCharts(root)')) {
  t = t.replace(
    'bindSpreadPanel(root, cur);',
    'bindSpreadPanel(root, cur);\n    bindExtraCharts(root);'
  );
}

fs.writeFileSync(path, t);
console.log('patch-eur-dollar-spread-ui done', t.includes('extraChartsHtml'), t.includes('data-extra'));
