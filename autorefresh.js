/*
 * MacroWatch – automatische Aktualisierung aller Charts
 *
 * Der Daten-Workflow schreibt bei jedem neuen Datenstand eine kleine
 * version.json (wenige Bytes). Diese Datei wird regelmäßig geprüft; nur wenn
 * sich der Datenstand geändert hat, wird data.json neu geladen und die Seite
 * neu gezeichnet – genau so, als hätte man auf „Aktualisieren“ geklickt.
 * Scrollposition, gewählte USA-Seite und ein geöffnetes Chart-Fenster bleiben
 * dabei erhalten.
 */
(function () {
  'use strict';

  var CHECK_VISIBLE_MS = 2 * 60 * 1000;  // Tab sichtbar: alle 2 Minuten prüfen
  var CHECK_HIDDEN_MS = 15 * 60 * 1000;  // Tab im Hintergrund: alle 15 Minuten
  var SAFETY_RELOAD_MS = 60 * 60 * 1000; // Sicherheitsnetz: spätestens stündlich neu laden
  var STARTUP_DELAY_MS = 4000;

  var knownUpdatedAt = null; // Datenstand, der gerade angezeigt wird
  var fresh = null;          // Ergebnis der Datenprüfung (freshness.json)
  var lastCheck = 0;
  var lastReload = Date.now();
  var timer = null;
  var reloading = false;

  function $(sel) { return document.querySelector(sel); }
  function ts(v) { var t = Date.parse(v || ''); return isFinite(t) ? t : 0; }

  function getVersion() {
    return fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.updatedAt ? j : null; })
      .catch(function () { return null; });
  }

  function loadFreshness() {
    return fetch('./freshness.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.items) { fresh = j; decorateStatus(); } })
      .catch(function () {});
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openCheckDialog() {
    if (!fresh) return;
    var dlg = document.getElementById('mwCheckDlg');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'mwCheckDlg';
      dlg.style.cssText = 'max-width:min(980px,96vw);width:96vw;max-height:88vh;overflow:auto;padding:16px';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.id === 'mwCheckClose') dlg.close(); });
    }
    var icon = { ok: '✅', alt: '⚠️', info: 'ℹ️', fehler: '❌' };
    var label = { ok: 'aktuell', alt: 'Quelle neuer', info: 'nicht vergleichbar', fehler: 'Quelle nicht erreichbar' };
    var order = { alt: 0, fehler: 1, ok: 2, info: 3 };
    var rows = fresh.items.slice().sort(function (a, b) { return (order[a.status] - order[b.status]) || 0; }).map(function (i) {
      return '<tr style="border-top:1px solid var(--line)"><td style="padding:5px 6px">' + icon[i.status] + '</td><td style="padding:5px 6px;white-space:nowrap">' + esc(i.page) + '</td><td style="padding:5px 6px">' + esc(i.label) +
        '</td><td style="padding:5px 6px;white-space:nowrap">' + esc(i.pageDate) + '</td><td style="padding:5px 6px;white-space:nowrap">' + esc(i.srcDate) +
        '</td><td style="padding:5px 6px;font-size:12px;color:var(--muted)">' + esc(label[i.status]) + (i.note ? ' · ' + esc(i.note) : '') + ' · ' + esc(i.source) + '</td></tr>';
    }).join('');
    var sm = fresh.summary || {};
    dlg.innerHTML = '<h3 style="margin:0 0 6px">Datenprüfung · Stand Seite vs. Quelle</h3>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">Geprüft ' + esc(new Date(fresh.checkedAt).toLocaleString('de-DE')) +
      ' · ✅ ' + (sm.ok || 0) + ' aktuell · ⚠️ ' + (sm.alt || 0) + ' Quelle neuer · ❌ ' + (sm.fehler || 0) + ' nicht erreichbar · ℹ️ ' + (sm.info || 0) + ' Prognose/Quartal' +
      '<br>Bei jedem Datenlauf fragt das Skript jede Quelle selbst nach ihrem neuesten Stand.</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left"><th></th><th>Bereich</th><th>Daten</th><th>Stand Seite</th><th>Stand Quelle</th><th>Hinweis</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="actions" style="margin-top:12px;text-align:right"><button type="button" class="btn" id="mwCheckClose">Schließen</button></div>';
    dlg.showModal();
  }

  function waitUntilIdle(btn, maxMs) {
    var t0 = Date.now();
    return new Promise(function (resolve) {
      (function poll() {
        if (!btn.disabled || Date.now() - t0 > maxMs) return resolve();
        setTimeout(poll, 200);
      })();
    });
  }

  function ageText(updatedAt) {
    var mins = Math.round((Date.now() - ts(updatedAt)) / 60000);
    if (!isFinite(mins) || mins < 0) return '';
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return 'vor ' + mins + ' Min.';
    var h = Math.floor(mins / 60);
    if (h < 48) return 'vor ' + h + ' Std.';
    return 'vor ' + Math.floor(h / 24) + ' Tagen';
  }

  function decorateStatus() {
    var status = $('#status');
    if (!status) return;
    var el = status.querySelector('#mwAutoInfo');
    if (!el) {
      el = document.createElement('span');
      el.id = 'mwAutoInfo';
      el.style.cssText = 'opacity:.75;white-space:nowrap';
      // hinter die erste Zeile („Datenstand: …“) setzen
      var br = status.querySelector('br');
      if (br) status.insertBefore(el, br); else status.appendChild(el);
    }
    var age = knownUpdatedAt ? ageText(knownUpdatedAt) : '';
    el.textContent = ' · ' + (age ? age + ' · ' : '') + 'Auto-Update an';
    el.title = 'Die Seite prüft alle 2 Minuten, ob neue Daten vorliegen, und aktualisiert alle Charts automatisch.';
    if (fresh && fresh.summary) {
      var b = status.querySelector('#mwCheckBtn');
      if (!b) {
        b = document.createElement('a');
        b.id = 'mwCheckBtn';
        b.href = '#';
        b.style.cssText = 'margin-left:6px;color:var(--accent);white-space:nowrap';
        b.addEventListener('click', function (e) { e.preventDefault(); openCheckDialog(); });
        el.after(b);
      }
      var sm = fresh.summary;
      b.textContent = '· Datenprüfung: ✅ ' + (sm.ok || 0) + (sm.alt ? ' · ⚠️ ' + sm.alt : '') + (sm.fehler ? ' · ❌ ' + sm.fehler : '');
    }
  }

  function reloadData() {
    var btn = $('#refresh');
    if (!btn || btn.disabled || reloading) return Promise.resolve(false);
    var edit = $('#edit');
    if (edit && edit.open) return Promise.resolve(false); // Nutzer bearbeitet gerade einen Wert

    reloading = true;
    var y = window.scrollY;
    btn.click(); // gleicher Ablauf wie der Button „Aktualisieren“
    return waitUntilIdle(btn, 90000).then(function () {
      lastReload = Date.now();
      loadFreshness();
      setTimeout(function () {
        window.scrollTo(0, y);
        var dlg = $('#chartDlg');
        try {
          if (dlg && dlg.open && typeof paintChartDlg === 'function' && typeof chartCtx !== 'undefined' && chartCtx) paintChartDlg();
        } catch (e) { /* Chart-Fenster bleibt mit altem Stand offen */ }
        decorateStatus();
        reloading = false;
      }, 250);
      return true;
    });
  }

  function check(force) {
    lastCheck = Date.now();
    return getVersion().then(function (v) {
      if (v) {
        if (!knownUpdatedAt) {
          knownUpdatedAt = v.updatedAt; // erster Abgleich nach dem Seitenstart
          decorateStatus();
          return;
        }
        if (ts(v.updatedAt) > ts(knownUpdatedAt)) {
          return reloadData().then(function (ok) {
            if (ok) knownUpdatedAt = v.updatedAt;
            decorateStatus();
          });
        }
      }
      // ohne version.json oder als Sicherheitsnetz: regelmäßig komplett neu laden
      if (force || (!document.hidden && Date.now() - lastReload > SAFETY_RELOAD_MS)) {
        return reloadData().then(function () { decorateStatus(); });
      }
      decorateStatus();
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      check(false).then(schedule, schedule);
    }, document.hidden ? CHECK_HIDDEN_MS : CHECK_VISIBLE_MS);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - lastCheck > 30000) check(false).then(schedule, schedule);
    else schedule();
  });
  window.addEventListener('online', function () { check(false).then(schedule, schedule); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(false).then(schedule, schedule); });

  // Statuszeile nach jedem Neuladen (auch manuell) ergänzen
  var refreshBtn = $('#refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', function () {
    var b = refreshBtn;
    setTimeout(function () { waitUntilIdle(b, 90000).then(decorateStatus); }, 50);
  });
  setInterval(function () { if (!document.hidden) decorateStatus(); }, 60000);

  setTimeout(function () { check(false).then(schedule, schedule); loadFreshness(); }, STARTUP_DELAY_MS);
})();
