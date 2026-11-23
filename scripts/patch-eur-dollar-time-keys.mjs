import fs from 'node:fs';

/** Zeitachse: Tastatur ←→ + Mausrad */
const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

if (t.includes('ArrowLeft') && t.includes('goTo(curveState.idx')) {
  console.log('time keys already present');
  process.exit(0);
}

const old = `    var range = root.querySelector('.usde-time-range');
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
  }`;

const neu = `    var range = root.querySelector('.usde-time-range');
    function goTo(ni) {
      ni = Math.max(0, Math.min(pack.dates.length - 1, Number(ni)));
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
      range.addEventListener('input', function (ev) {
        goTo(ev.target.value);
      });
      range.addEventListener('change', function (ev) {
        goTo(ev.target.value);
      });
      range.setAttribute('tabindex', '0');
      range.addEventListener('keydown', function (ev) {
        var step = 1;
        if (ev.shiftKey) step = 5;
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
      range.addEventListener(
        'wheel',
        function (ev) {
          ev.preventDefault();
          var dir = ev.deltaY > 0 || ev.deltaX > 0 ? 1 : -1;
          goTo(curveState.idx + dir);
        },
        { passive: false }
      );
      try { range.focus(); } catch (e) {}
    }
    var axis = root.querySelector('.usde-time-axis');
    if (axis) {
      axis.addEventListener('mousedown', function () {
        if (range) try { range.focus(); } catch (e) {}
      });
      axis.addEventListener(
        'wheel',
        function (ev) {
          ev.preventDefault();
          var dir = ev.deltaY > 0 || ev.deltaX > 0 ? 1 : -1;
          goTo(curveState.idx + dir);
        },
        { passive: false }
      );
    }
  }`;

if (!t.includes(old)) {
  console.warn('range block pattern not found — try alternate');
} else {
  t = t.replace(old, neu);
}

t = t.replace(
  'Zeitachse (täglich): Maus/Schieber bewegt USA- und DE-Kurve gemeinsam',
  'Zeitachse: Maus/Schieber · ← → Tasten (Shift=5 Tage) · Mausrad'
);
t = t.replace(
  'Zeitachse (täglich): Maus/Schieber bewegt USA- und DE-Kurve gemeinsam',
  'Zeitachse: Maus/Schieber · ← → Tasten (Shift=5 Tage) · Mausrad'
);

fs.writeFileSync(path, t);
console.log('patch-eur-dollar-time-keys done', t.includes('ArrowLeft'));
