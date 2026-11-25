import fs from 'node:fs';
import { execSync } from 'node:child_process';

/** Restore eur-dollar.js if broken, then apply hover on extra charts */
const path = 'eur-dollar.js';
const GOOD = 'ae437b10c991cc366d75263621ff989632c6bc5e';

let t = '';
try {
  t = fs.readFileSync(path, 'utf8');
} catch (e) {
  t = '';
}

if (t.length < 5000 || !t.includes('extraChartsHtml') || !t.includes('function renderCurveBlock')) {
  console.log('eur-dollar.js broken or missing — restore from', GOOD);
  try {
    t = execSync('git show ' + GOOD + ':eur-dollar.js', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    fs.writeFileSync(path, t);
    console.log('restored bytes', t.length);
  } catch (e) {
    console.error('git show failed', e.message);
    process.exit(1);
  }
}

// Hover on extra charts
if (!t.includes('function bindExtraChartHover')) {
  const hoverFn = `
  function bindExtraChartHover(wrap) {
    var svg = wrap.querySelector('svg.chart-hover') || wrap.querySelector('svg');
    if (!svg) return;
    var tip = wrap.querySelector('.usde-extra-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'usde-extra-tip';
      tip.style.cssText = 'position:absolute;pointer-events:none;z-index:8;opacity:0;padding:6px 10px;border-radius:8px;background:rgba(16,24,39,0.96);border:1px solid #3a4556;color:#e8eef7;font-size:12px;white-space:nowrap;box-shadow:0 4px 16px #0006';
      if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      wrap.appendChild(tip);
    }
    svg.querySelectorAll('circle.hit').forEach(function (c) {
      try { c.setAttribute('r', '14'); c.style.cursor = 'crosshair'; } catch (e) {}
    });
    function showFromHit(hit, clientX, clientY) {
      if (!hit) { tip.style.opacity = '0'; return; }
      tip.textContent = (hit.getAttribute('data-period') || '') + ' · ' + (hit.getAttribute('data-value') || '');
      tip.style.opacity = '1';
      var rect = wrap.getBoundingClientRect();
      var left = clientX - rect.left + 12;
      var top = clientY - rect.top + 12;
      if (left > rect.width - 140) left = clientX - rect.left - 140;
      if (top > rect.height - 36) top = clientY - rect.top - 36;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }
    function nearestHit(clientX) {
      var hits = svg.querySelectorAll('circle.hit');
      if (!hits.length) return null;
      var rect = svg.getBoundingClientRect();
      var x = clientX - rect.left;
      var vbW = svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : rect.width;
      var scale = rect.width / (vbW || 1);
      var best = null, bestD = 1e9;
      for (var i = 0; i < hits.length; i++) {
        var cx = Number(hits[i].getAttribute('cx')) * scale;
        var d = Math.abs(x - cx);
        if (d < bestD) { bestD = d; best = hits[i]; }
      }
      return best;
    }
    svg.style.cursor = 'crosshair';
    svg.addEventListener('mousemove', function (ev) {
      var hit = ev.target.closest && ev.target.closest('circle.hit');
      if (!hit) hit = nearestHit(ev.clientX);
      showFromHit(hit, ev.clientX, ev.clientY);
    });
    svg.addEventListener('mouseleave', function () { tip.style.opacity = '0'; });
    svg.addEventListener('touchmove', function (ev) {
      if (!ev.touches || !ev.touches.length) return;
      var tch = ev.touches[0];
      showFromHit(nearestHit(tch.clientX), tch.clientX, tch.clientY);
    }, { passive: true });
    svg.addEventListener('touchend', function () { tip.style.opacity = '0'; });
  }
`;
  if (t.includes('function bindExtraCharts')) {
    t = t.replace('function bindExtraCharts', hoverFn + '\n  function bindExtraCharts');
  }
}

if (t.includes('function bindExtraCharts') && !t.includes('bindExtraChartHover(wrap)')) {
  t = t.replace(
    "panel.querySelectorAll('input[data-extra]')",
    "panel.querySelectorAll('.usde-extra-chart').forEach(function (wrap) { bindExtraChartHover(wrap); });\n    panel.querySelectorAll('input[data-extra]')"
  );
}

t = t.replace(
  'renderLineChart(pts, { w: Math.min(640, 360), h: 100 })',
  'renderLineChart(pts, { w: Math.min(640, 360), h: 120 })'
);

fs.writeFileSync(path, t);
console.log('restore-eur-dollar done', t.length, t.includes('bindExtraChartHover'), t.includes('extraChartsHtml'));
