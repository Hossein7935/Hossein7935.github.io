import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');
if (t.length < 5000) {
  console.error('eur-dollar.js broken');
  process.exit(1);
}

// Always fix known breakages
t = t.replace(
  /extraChartsHtml\(\)\s*\+\s*\n\s*extraChartsHtml\(pack\.dates\[i\]\)\s*\+/g,
  'extraChartsHtml(pack.dates[i]) +'
);
t = t.replace(
  'extraChartsHtml() +\n      extraChartsHtml(pack.dates[i]) +',
  'extraChartsHtml(pack.dates[i]) +'
);
t = t.replace(
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, focusDate);',
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, pack.dates[i]);'
);

// Remove any existing click listener block on usde-curve-root and inject forced openChart
const anchor = "var root = face.querySelector('.usde-curve-root');";
const a = t.indexOf(anchor);
if (a < 0) {
  console.error('root anchor missing');
  process.exit(1);
}
const b = t.indexOf('function patchPaintChartDlg', a);
if (b < 0) {
  console.error('patchPaintChartDlg missing');
  process.exit(1);
}

const forced = `var root = face.querySelector('.usde-curve-root');
    if (root) {
      // Immer Vergrößerung bei Klick auf die Kurve
      root.onclick = function (e) {
        var tgt = e.target;
        if (!tgt) return;
        if (
          tgt.classList && tgt.classList.contains('usde-time-range')
        ) {
          e.stopPropagation();
          return;
        }
        if (
          tgt.closest &&
          (tgt.closest('.usde-time-axis') ||
            tgt.closest('.usde-spread-panel') ||
            tgt.closest('.usde-extra-panel') ||
            tgt.closest('.usde-tenor-btn') ||
            tgt.closest('label.usde-extra-cb') ||
            tgt.closest('.usde-spread-reset') ||
            tgt.closest('input'))
        ) {
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof openChart === 'function') {
            openChart('USA', 'usDeCurve', 'Zinskurve USA vs DE');
          } else if (typeof window.openChart === 'function') {
            window.openChart('USA', 'usDeCurve', 'Zinskurve USA vs DE');
          } else {
            window.chartCtx = {
              country: 'USA',
              key: 'usDeCurve',
              label: 'Zinskurve USA vs DE',
              range: '3y'
            };
            var title = document.querySelector('#chartTitle');
            if (title) title.textContent = 'Zinskurve USA vs DE';
            if (typeof paintChartDlg === 'function') paintChartDlg();
            var dlg = document.querySelector('#chartDlg');
            if (dlg && dlg.showModal) dlg.showModal();
          }
        } catch (err) {
          console.error('enlarge click', err);
          alert('Kurve vergrößern fehlgeschlagen: ' + (err && err.message ? err.message : err));
        }
      };
      try {
        renderCurveBlock(root, curveState.idx);
      } catch (err) {
        console.error('renderCurveBlock', err);
        root.innerHTML =
          '<div class="sparkempty">Kurve Fehler: ' +
          (err && err.message ? err.message : err) +
          '</div>';
      }
    }
  }

  `;

t = t.slice(0, a) + forced + t.slice(b);

// Safer paintChartDlg body
if (!t.includes('usDeCurve enlarge')) {
  t = t.replace(
    "body.classList.add('usde-curve-root');\n        renderCurveBlock(body, curveState.idx);",
    "body.classList.add('usde-curve-root');\n        try { renderCurveBlock(body, curveState.idx); } catch (err) { console.error('usDeCurve enlarge', err); body.innerHTML = '<div class=\"sparkempty\">Fehler: ' + (err && err.message ? err.message : err) + '</div>'; }"
  );
}

fs.writeFileSync(path, t);
const ok = t.includes("openChart('USA', 'usDeCurve'") && !t.includes('extraChartsHtml() +');
console.log('patch-curve-enlarge-click done', ok, 'len', t.length);
if (!ok) process.exit(1);
