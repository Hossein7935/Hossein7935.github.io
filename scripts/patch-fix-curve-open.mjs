import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');
if (t.length < 5000) {
  console.error('eur-dollar.js broken');
  process.exit(1);
}

// 1) Remove duplicate extraChartsHtml() call
t = t.replace(
  /extraChartsHtml\(\)\s*\+\s*\n\s*extraChartsHtml\(pack\.dates\[i\]\)\s*\+/g,
  'extraChartsHtml(pack.dates[i]) +'
);
t = t.replace(
  'extraChartsHtml() +\n      extraChartsHtml(pack.dates[i]) +',
  'extraChartsHtml(pack.dates[i]) +'
);

// 2) bindExtraCharts(root, focusDate) in renderCurveBlock is a ReferenceError
t = t.replace(
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, focusDate);',
  'bindSpreadPanel(root, cur);\n    bindExtraCharts(root, pack.dates[i]);'
);

// If still both extraChartsHtml lines
if (t.includes('extraChartsHtml() +') && t.includes('extraChartsHtml(pack.dates[i])')) {
  t = t.replace('extraChartsHtml() +\n      ', '');
}

// 3) Clicks on the curve SVG itself must open enlarge — only stopPropagation on controls
const badStop = `root.addEventListener(
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
      );`;

const goodStop = `root.addEventListener(
        'click',
        function (e) {
          // Nur Bedienelemente blocken — Klick auf Kurve öffnet Vergrößerung
          if (
            e.target &&
            (e.target.classList.contains('usde-time-range') ||
              e.target.closest('.usde-time-axis') ||
              e.target.closest('.usde-spread-panel') ||
              e.target.closest('.usde-extra-panel') ||
              e.target.closest('.usde-tenor-btn') ||
              e.target.closest('.usde-extra-cb'))
          ) {
            e.stopPropagation();
          }
        },
        true
      );`;

if (t.includes(badStop)) {
  t = t.replace(badStop, goodStop);
}

// 4) Safer paintChartDlg wrapper
if (t.includes("chartCtx.key === 'usDeCurve'") && !t.includes('try {\n        renderCurveBlock(body')) {
  t = t.replace(
    'renderCurveBlock(body, curveState.idx);\n        if (typeof bindBigChartHover === \'function\') bindBigChartHover(body);',
    'try { renderCurveBlock(body, curveState.idx); } catch (err) { console.error(err); body.innerHTML = \'<div class="sparkempty">Kurve Fehler</div>\'; }\n        if (typeof bindBigChartHover === \'function\') try { bindBigChartHover(body); } catch (e2) {}'
  );
}

fs.writeFileSync(path, t);
console.log(
  'patch-fix-curve-open done',
  !t.includes('extraChartsHtml() +'),
  t.includes('bindExtraCharts(root, pack.dates[i])'),
  !t.slice(t.indexOf('function renderCurveBlock'), t.indexOf('function goTo')).includes('focusDate')
);
