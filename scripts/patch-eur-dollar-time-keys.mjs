import fs from 'node:fs';

/** Zeitachse: ←→ Tastatur, Mausrad; Hover zeigt USA+DE % */
const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

if (t.includes('function bindCurveHover') && t.includes('ArrowLeft')) {
  console.log('keyboard+hover already present');
  process.exit(0);
}

const anchor = "var range = root.querySelector('.usde-time-range');";
const start = t.indexOf(anchor);
if (start < 0) {
  console.error('range anchor not found');
  process.exit(1);
}
const endMarker = t.indexOf('\n  function ', start + 10);
if (endMarker < 0) {
  console.error('end marker not found');
  process.exit(1);
}

const replacement = `var range = root.querySelector('.usde-time-range');
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
  }`;

t = t.slice(0, start) + replacement + t.slice(endMarker);
fs.writeFileSync(path, t);
console.log('patch-eur-dollar-time-keys done', t.includes('ArrowLeft'), t.includes('bindCurveHover'));
