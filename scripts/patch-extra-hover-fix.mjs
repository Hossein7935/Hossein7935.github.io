import fs from 'node:fs';

const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

if (t.length < 5000) {
  console.error('eur-dollar.js still broken');
  process.exit(1);
}

// Replace bindExtraChartHover with robust version using fixed positioning + global tip
const start = t.indexOf('function bindExtraChartHover');
if (start < 0) {
  console.error('bindExtraChartHover not found');
  process.exit(1);
}
const end = t.indexOf('function bindExtraCharts', start + 10);
if (end < 0) {
  console.error('bindExtraCharts not found after hover');
  process.exit(1);
}

const neu = `function bindExtraChartHover(wrap) {
    var svg = wrap.querySelector('svg.chart-hover') || wrap.querySelector('svg');
    if (!svg) return;
    // Prefer global dashboard tip if present
    var globalTip = document.querySelector('#chartTip');
    var tip = wrap.querySelector('.usde-extra-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'usde-extra-tip';
      tip.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;opacity:0;padding:6px 10px;border-radius:8px;background:rgba(16,24,39,0.96);border:1px solid #3a4556;color:#e8eef7;font-size:12px;white-space:nowrap;box-shadow:0 4px 16px #0006';
      document.body.appendChild(tip);
    }
    svg.querySelectorAll('circle.hit').forEach(function (c) {
      try {
        c.setAttribute('r', '18');
        c.style.cursor = 'crosshair';
        // ensure attributes readable
        if (!c.getAttribute('data-period') && c.dataset && c.dataset.period) {
          c.setAttribute('data-period', c.dataset.period);
        }
      } catch (e) {}
    });
    function readHit(hit) {
      if (!hit) return null;
      var period = hit.getAttribute('data-period') || (hit.dataset && hit.dataset.period) || '';
      var value = hit.getAttribute('data-value') || (hit.dataset && hit.dataset.value) || '';
      if (!period && !value) return null;
      return period + (value ? ' · ' + value : '');
    }
    function showText(text, clientX, clientY) {
      if (!text) {
        tip.style.opacity = '0';
        if (globalTip) globalTip.classList.remove('show');
        return;
      }
      tip.textContent = text;
      tip.style.opacity = '1';
      tip.style.display = 'block';
      tip.style.left = (clientX + 14) + 'px';
      tip.style.top = (clientY + 14) + 'px';
      if (globalTip) {
        globalTip.textContent = text;
        globalTip.style.left = (clientX + 14) + 'px';
        globalTip.style.top = (clientY + 14) + 'px';
        globalTip.classList.add('show');
      }
    }
    function nearestHit(clientX) {
      var hits = svg.querySelectorAll('circle.hit');
      if (!hits.length) return null;
      var rect = svg.getBoundingClientRect();
      if (rect.width < 1) return null;
      var x = clientX - rect.left;
      var vbW = 360;
      try {
        if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) vbW = svg.viewBox.baseVal.width;
      } catch (e) {}
      var scale = rect.width / (vbW || 1);
      var best = null, bestD = 1e9;
      for (var i = 0; i < hits.length; i++) {
        var cx = Number(hits[i].getAttribute('cx')) * scale;
        var d = Math.abs(x - cx);
        if (d < bestD) { bestD = d; best = hits[i]; }
      }
      return best;
    }
    function onMove(clientX, clientY) {
      var hit = nearestHit(clientX);
      showText(readHit(hit), clientX, clientY);
    }
    svg.style.cursor = 'crosshair';
    wrap.style.cursor = 'crosshair';
    wrap.addEventListener('mousemove', function (ev) {
      onMove(ev.clientX, ev.clientY);
    });
    wrap.addEventListener('mouseleave', function () {
      tip.style.opacity = '0';
      if (globalTip) globalTip.classList.remove('show');
    });
    wrap.addEventListener('touchmove', function (ev) {
      if (!ev.touches || !ev.touches.length) return;
      var tch = ev.touches[0];
      onMove(tch.clientX, tch.clientY);
    }, { passive: true });
    wrap.addEventListener('touchend', function () {
      tip.style.opacity = '0';
      if (globalTip) globalTip.classList.remove('show');
    });
  }

  `;

t = t.slice(0, start) + neu + t.slice(end);

// resilient series
if (!t.includes('data.histories && data.histories[key]')) {
  t = t.replace(
    "return (typeof histories !== 'undefined' && histories[key]) || [];",
    "if (typeof histories !== 'undefined' && histories && histories[key]) return histories[key];\n    if (typeof window !== 'undefined' && window.histories && window.histories[key]) return window.histories[key];\n    try { if (typeof data !== 'undefined' && data && data.histories && data.histories[key]) return data.histories[key]; } catch (e) {}\n    return [];"
  );
}

fs.writeFileSync(path, t);
console.log('patch-extra-hover-fix done', t.includes('position:fixed'), t.includes('#chartTip'));
