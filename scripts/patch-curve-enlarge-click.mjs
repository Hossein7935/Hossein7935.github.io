import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');
if (t.length < 5000) {
  console.error('eur-dollar.js broken');
  process.exit(1);
}

if (t.includes("openChart('USA', 'usDeCurve'") && t.includes('usDeCurve enlarge')) {
  console.log('enlarge click already present');
  process.exit(0);
}

// Fix double extra / focusDate first
t = t.replace(
  'extraChartsHtml() +\n      extraChartsHtml(pack.dates[i]) +',
  'extraChartsHtml(pack.dates[i]) +'
);
t = t.replace(
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, focusDate);',
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, pack.dates[i]);'
);

const marker = "var root = face.querySelector('.usde-curve-root');";
const start = t.indexOf(marker);
if (start < 0) {
  console.error('root marker not found');
  process.exit(1);
}
// replace until end of paint function's root block — find "function patchPaintChartDlg"
const end = t.indexOf('function patchPaintChartDlg', start);
if (end < 0) {
  console.error('patchPaintChartDlg not found after root');
  process.exit(1);
}

const replacement = `var root = face.querySelector('.usde-curve-root');
    if (root) {
      root.addEventListener(
        'click',
        function (e) {
          var tgt = e.target;
          if (!tgt) return;
          if (
            tgt.classList.contains('usde-time-range') ||
            tgt.closest('.usde-time-axis') ||
            tgt.closest('.usde-spread-panel') ||
            tgt.closest('.usde-extra-panel') ||
            tgt.closest('.usde-tenor-btn') ||
            tgt.closest('label.usde-extra-cb') ||
            tgt.closest('.usde-spread-reset')
          ) {
            e.stopPropagation();
            return;
          }
          if (tgt.closest('svg') || tgt === root) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof openChart === 'function') {
              openChart('USA', 'usDeCurve', 'Zinskurve USA vs DE');
            } else {
              try {
                chartCtx = {
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
              } catch (err) {
                console.error(err);
              }
            }
          }
        },
        true
      );
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

t = t.slice(0, start) + replacement + t.slice(end);

// Safer enlarge render
if (!t.includes('usDeCurve enlarge')) {
  t = t.replace(
    "body.classList.add('usde-curve-root');\n        renderCurveBlock(body, curveState.idx);\n        if (typeof bindBigChartHover === 'function') bindBigChartHover(body);",
    "body.classList.add('usde-curve-root');\n        try {\n          renderCurveBlock(body, curveState.idx);\n        } catch (err) {\n          console.error('usDeCurve enlarge', err);\n          body.innerHTML = '<div class=\"sparkempty\">Fehler beim Öffnen: ' + (err && err.message ? err.message : err) + '</div>';\n        }\n        if (typeof bindBigChartHover === 'function') {\n          try { bindBigChartHover(body); } catch (e2) {}\n        }"
  );
}

fs.writeFileSync(path, t);
console.log('patch-curve-enlarge-click done', t.includes("openChart('USA', 'usDeCurve'"));
