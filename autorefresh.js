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

  setTimeout(function () { check(false).then(schedule, schedule); }, STARTUP_DELAY_MS);
})();
