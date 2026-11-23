/*
 * MacroWatch – USA-Seite „Credit Vergabe“
 *
 * Credit Supply  · SLOOS-Kreditstandards, Bankkredite (H.8), Kreditlinien
 * Credit Demand  · SLOOS-Kreditnachfrage und Kreditanfragen
 * Credit Stress  · SKSI (eigener Index) + seine vier Bausteine
 *
 * Die Charts verhalten sich wie alle anderen: Klick = vergrößern, Zeitraum
 * wählbar, Fadenkreuz; Auto-Refresh über autorefresh.js. Daten kommen aus
 * data.json (data.USA.credit + histories['USA-…']), geschrieben von
 * scripts/fetch-credit.mjs.
 */
(function () {
  'use strict';

  var PAGE = 8;
  var LABEL = 'Credit Vergabe';
  var LS_PAGE = 'macrowatch-usa-page';
  var LS_OPEN = 'macrowatch-usa-credit-open'; // überlebt das Begrenzen auf Seite 7 beim Start

  var SECTIONS = [
    { group: 'supply', title: 'Credit Supply · Kreditangebot', hint: 'Wie bereitwillig Banken Kredit vergeben. SLOOS: positiv = mehr Banken verschärfen als lockern.', keys: ['sloosCiLarge', 'sloosCiSmall', 'sloosCards', 'bankCreditYoy', 'ciLoansYoy', 'sloosLinesLarge', 'sloosLinesSmall'] },
    { group: 'demand', title: 'Credit Demand · Kreditnachfrage', hint: 'Wie stark Firmen Kredit nachfragen. Positiv = mehr Banken melden stärkere Nachfrage bzw. mehr Anfragen.', keys: ['sloosDemLarge', 'sloosDemSmall', 'sloosInquiries'] },
    { group: 'stress', title: 'Credit Stress · SKSI', hint: 'Synchronisierter Kreditstress-Index (0–100) und seine vier Bausteine. z = Abstand zum Normalniveau 1997–2006.', keys: ['sksi', 'hyOas', 'igOas', 'baaAaa', 'nfci'] }
  ];

  var UNIT_BY_KEY = { nfci: 'index', sksi: 'score', dxy: 'index', move: 'index' }; // Großansicht ohne „%“
  var REGIME = {
    normal: { de: 'Ruhig', color: 'var(--accent)' },
    watch: { de: 'Erhöht', color: '#f5b041' },
    stress: { de: 'Stress', color: '#e67e22' },
    severe: { de: 'Schwer', color: '#e74c3c' }
  };

  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, d) { return Number(v).toLocaleString('de-DE', { maximumFractionDigits: d == null ? 2 : d }); }
  function fmtUnit(unit, v) {
    if (unit === 'index') return num(v, 3);
    if (unit === 'score') return num(v, 0) + ' / 100';
    return num(v, 2) + ' %';
  }
  function creditData() { return (typeof data !== 'undefined' && data.USA && data.USA.credit) || null; }
  function hist(key) { return (typeof histories !== 'undefined' && histories['USA-' + key]) || []; }

  // renderLineChart nutzt das globale fmt → für Nicht-Prozent-Reihen kurz austauschen
  function withUnit(unit, fn) {
    if (!unit || unit === 'pct') return fn();
    var orig = window.fmt;
    window.fmt = function (v) { return fmtUnit(unit, v); };
    try { return fn(); } finally { window.fmt = orig; }
  }

  function cardWindow(pts, key) {
    if (!pts.length) return pts;
    var quarterly = /^sloos/.test(key);
    var years = quarterly || key === 'sksi' ? 10 : 3;
    var cut = new Date();
    cut.setFullYear(cut.getFullYear() - years);
    var c = cut.toISOString().slice(0, 10);
    var out = pts.filter(function (p) { return String(p.period) >= c; });
    return out.length > 1 ? out : pts;
  }

  function chartHtml(key, label, unit, w, hgt) {
    var pts = cardWindow(hist(key), key)
      .map(function (p) { return { period: String(p.period), value: Number(p.value) }; })
      .filter(function (p) { return isFinite(p.value); });
    if (!pts.length || typeof renderLineChart !== 'function') return '<div class="sparkempty">Verlauf nicht verfügbar</div>';
    var svg = withUnit(unit, function () { return renderLineChart(pts, { w: w || 220, h: hgt || 58 }); });
    return '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|' + h(key) + '|' + h(label) + '" title="Chart vergrößern">' + svg + '</div>';
  }

  function card(key, item) {
    var unit = item.unit || UNIT_BY_KEY[key] || 'pct';
    var label = item.label || key;
    var delta = '';
    if (item.prev != null && isFinite(item.prev)) {
      var d = Number(item.value) - Number(item.prev);
      delta = ' <span class="credit-delta" style="font-size:12px;color:var(--muted)">(' + (d >= 0 ? '+' : '') + num(d, 2) + ')</span>';
    }
    var extra = '';
    if (item.level != null) extra += ' · Bestand ' + num(item.level, 2) + ' ' + h(item.levelUnit || '');
    if (item.z != null) extra += ' · z ' + num(item.z, 2) + ' (' + h(item.state || '') + ')';
    return '<div class="metric has-chart credit-card">' +
      '<div class="name">' + h(label) + '</div>' +
      '<div class="value">' + fmtUnit(unit, item.value) + delta + '</div>' +
      '<div class="date">Stand ' + h(item.date) + ' · ' + h(item.source || '') + extra + '</div>' +
      chartHtml(key, label, unit) +
      '<div class="sparkcaption">' + h(item.note || '') + '</div>' +
      '</div>';
  }

  function sksiCard(c) {
    var s = c.sksi || {};
    var item = (c.items || {}).sksi;
    if (!item) return missingCard('SKSI · Synchronisierter Kreditstress-Index');
    var r = REGIME[s.regime] || REGIME.normal;
    var badge = '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;background:' + r.color + ';color:#0b1120">' + h(r.de) + (s.quorum ? ' · Quorum' : '') + '</span>';
    return '<div class="metric has-chart credit-card" style="grid-column:1/-1">' +
      '<div class="name">' + h(item.label) + ' ' + badge + '</div>' +
      '<div class="value">' + fmtUnit('score', item.value) + '</div>' +
      '<div class="date">Stand ' + h(item.date) + ' · wöchentlich · <a href="https://hossein7935.github.io/sksi-credit-stress-index/" target="_blank" rel="noopener" style="color:var(--accent)">SKSI ↗</a></div>' +
      chartHtml('sksi', 'SKSI Kreditstress-Index', 'score', 360, 110) +
      '<div class="sparkcaption">' + h(s.summary || item.note || '') + ' Schwellen: unter 48 ruhig · 48–68 erhöht · 68–84 Stress · ab 84 schwer.</div>' +
      '</div>';
  }

  function missingCard(label) {
    return '<div class="metric credit-card"><div class="name">' + h(label) + '</div><div class="value">—</div><div class="date">Quelle noch nicht verfügbar – wird beim nächsten Datenlauf geladen</div></div>';
  }

  function ensureFace() {
    var faceA = document.querySelector('.country .usa-face-a');
    if (!faceA) return null;
    var card = faceA.closest('.country');
    var face = card.querySelector('.usa-face-i');
    if (!face) {
      face = document.createElement('div');
      face.className = 'metrics usa-face usa-face-i hidden';
      face.setAttribute('data-usa-face', String(PAGE));
      var after = card.querySelector('.usa-face-h') || card.querySelector('.usa-face-g');
      if (after && after.parentNode) after.after(face);
      else card.appendChild(face);
    }
    return face;
  }

  function ensureButtons() {
    document.querySelectorAll('#usaPageSelect, .usa-page-select').forEach(function (sel) {
      if (sel.querySelector('button[data-page="' + PAGE + '"]')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-page', String(PAGE));
      b.textContent = LABEL;
      sel.appendChild(b);
    });
  }

  function paintCreditPage() {
    var face = ensureFace();
    if (!face) return;
    var c = creditData();
    if (!c || !c.items) {
      face.innerHTML = '<div class="metric" style="grid-column:1/-1"><div class="name">' + LABEL + '</div><div class="date">Die Kreditdaten werden beim nächsten Datenlauf geladen.</div></div>';
      return;
    }
    var html = '';
    SECTIONS.forEach(function (sec) {
      html += '<div class="credit-head" style="grid-column:1/-1;margin:10px 0 2px;padding-top:8px;border-top:1px solid var(--line)">' +
        '<div style="font-weight:700;font-size:15px">' + h(sec.title) + '</div>' +
        '<div style="font-size:12px;color:var(--muted);line-height:1.4">' + h(sec.hint) + '</div></div>';
      sec.keys.forEach(function (key) {
        if (key === 'sksi') { html += sksiCard(c); return; }
        var item = c.items[key];
        html += item ? card(key, item) : missingCard(labelFor(key));
      });
    });
    html += '<div class="sparkcaption" style="grid-column:1/-1">Quellen: Federal Reserve SLOOS und H.8 über FRED · ICE BofA, Moody\'s, Chicago Fed über FRED · SKSI aus github.com/Hossein7935/sksi-credit-stress-index. SLOOS erscheint vierteljährlich, H.8 und NFCI wöchentlich, Spreads täglich.</div>';
    face.innerHTML = html;
  }

  function labelFor(key) {
    var map = { sloosInquiries: 'Kreditanfragen · Unternehmenskredite (C&I)', bankCreditYoy: 'Bankkredite gesamt · Wachstum J/J', ciLoansYoy: 'Unternehmenskredite (C&I) · Wachstum J/J' };
    return map[key] || key;
  }

  function showCreditPage() {
    try { localStorage.setItem(LS_PAGE, String(PAGE)); localStorage.setItem(LS_OPEN, '1'); } catch (e) {}
    ensureButtons();
    var face = ensureFace();
    if (!face) return;
    var card = face.closest('.country');
    card.querySelectorAll('.usa-face').forEach(function (f) { f.classList.toggle('hidden', f !== face); });
    document.querySelectorAll('#usaPageSelect button, .usa-page-select button').forEach(function (b) {
      b.classList.toggle('active', Number(b.getAttribute('data-page')) === PAGE);
    });
    paintCreditPage();
  }

  // --- in die bestehende Seitennavigation einhängen ---------------------------------
  if (typeof setUsaPage === 'function' && !setUsaPage.__credit) {
    var origSet = setUsaPage;
    var wrapped = function (page) {
      ensureButtons();
      if (Number(page) === PAGE) return showCreditPage();
      var f = document.querySelector('.usa-face-i');
      if (f) f.classList.add('hidden');
      try { localStorage.removeItem(LS_OPEN); } catch (e) {}
      return origSet.apply(this, arguments);
    };
    wrapped.__credit = true;
    setUsaPage = wrapped; // eslint-disable-line no-global-assign
  }

  // --- Großansicht: richtige Einheit (NFCI, SKSI) ------------------------------------
  if (typeof paintChartDlg === 'function' && !paintChartDlg.__credit) {
    var origPaint = paintChartDlg;
    var wrappedPaint = function () {
      var key = (typeof chartCtx !== 'undefined' && chartCtx) ? chartCtx.key : null;
      var self = this, args = arguments;
      var res = withUnit(UNIT_BY_KEY[key], function () { return origPaint.apply(self, args); });
      var meta = document.querySelector('#chartMeta');
      if (meta) meta.textContent = meta.textContent.replace(' · 10y · ', ' · 10 Jahre · ').replace(' · max · ', ' · Max · ');
      return res;
    };
    wrappedPaint.__credit = true;
    paintChartDlg = wrappedPaint; // eslint-disable-line no-global-assign
  }

  // --- längere Zeiträume im Großchart (für alle Charts): 10 Jahre und Max --------------
  if (typeof filterByRange === 'function' && !filterByRange.__credit) {
    var origFilter = filterByRange;
    var wrappedFilter = function (arr, range) {
      if (range === 'max') return (arr || []).slice();
      if (range === '10y') {
        var cut = new Date();
        cut.setFullYear(cut.getFullYear() - 10);
        var c = cut.toISOString().slice(0, 7);
        return (arr || []).filter(function (x) { return String(x.period) >= c; });
      }
      return origFilter.apply(this, arguments);
    };
    wrappedFilter.__credit = true;
    filterByRange = wrappedFilter; // eslint-disable-line no-global-assign
  }
  var bar = document.querySelector('#chartRange');
  if (bar && !bar.querySelector('[data-range="10y"]')) {
    bar.insertAdjacentHTML('beforeend', '<button type="button" data-range="10y">10 Jahre</button><button type="button" data-range="max">Max</button>');
  }

  // Seite direkt anzeigen, falls sie zuletzt offen war und schon gerendert ist
  try {
    var wasOpen = Number(localStorage.getItem(LS_PAGE)) === PAGE || localStorage.getItem(LS_OPEN) === '1';
    if (wasOpen) {
      localStorage.setItem(LS_PAGE, String(PAGE));
      if (document.querySelector('.country .usa-face-a')) showCreditPage();
    } else ensureButtons();
  } catch (e) {}

  window.paintCreditPage = paintCreditPage;
})();
