import fs from 'node:fs';

/** Touch-freundliche Spread-Auswahl per große Laufzeit-Buttons */
const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

if (t.includes('function spreadPanelHtml') && t.includes('usde-tenor-btn')) {
  console.log('spread UI already present');
  process.exit(0);
}

// curveState um pickA/pickB erweitern
t = t.replace(
  'var curveState = { idx: -1 };',
  "var curveState = { idx: -1, pickA: null, pickB: null };"
);

// spreadPanelHtml + logic vor renderCurveBlock einfügen
const helper = `
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

    // gleicher Tenor USA−DE
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
        // Panel neu zeichnen ohne ganzen Chart zu zerstören
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

`;

if (!t.includes('function spreadPanelHtml')) {
  t = t.replace('  function renderCurveBlock(root, idx) {', helper + '  function renderCurveBlock(root, idx) {');
}

// In renderCurveBlock: Panel einbauen
const oldHtml = `    root.innerHTML =
      svg +
      timeAxisHtml(pack, i) +
      (big ? '<div class="chart-tip-inline" id="chartDlgTip"></div>' : '');`;

const newHtml = `    root.innerHTML =
      svg +
      timeAxisHtml(pack, i) +
      spreadPanelHtml(cur) +
      (big ? '<div class="chart-tip-inline" id="chartDlgTip"></div>' : '');
    bindSpreadPanel(root, cur);`;

if (t.includes(oldHtml)) {
  t = t.replace(oldHtml, newHtml);
  console.log('renderCurveBlock html updated');
} else if (!t.includes('spreadPanelHtml(cur)')) {
  // alternate: after timeAxisHtml line
  t = t.replace(
    'timeAxisHtml(pack, i) +',
    'timeAxisHtml(pack, i) +\n      spreadPanelHtml(cur) +'
  );
  if (!t.includes('bindSpreadPanel(root, cur)')) {
    t = t.replace(
      "var range = root.querySelector('.usde-time-range');",
      "bindSpreadPanel(root, cur);\n    var range = root.querySelector('.usde-time-range');"
    );
  }
  console.log('alternate inject');
}

fs.writeFileSync(path, t);
console.log('patch-eur-dollar-spread-ui done', t.includes('usde-tenor-btn'));
