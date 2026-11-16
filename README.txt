MacroWatch – automatische Datenaktualisierung

ABLAUF
1. Der Workflow „MacroWatch data update“ (.github/workflows/update-data.yml) läuft alle
   15 Minuten (sofern GitHub den Zeitplan startet) (und bei jedem Push / manuell über „Run workflow“).
2. Er übernimmt den neuesten Stand von der Live-Seite, ruft alle Quellen einzeln ab
   (scripts/run-fetchers.mjs) und füllt FRED-verzögerte Reihen mit neueren Treasury-,
   TradingView- und NY-Fed-Werten auf (scripts/freshen-derived.mjs).
3. Gibt es neue Daten, wird die Seite sofort auf GitHub Pages veröffentlicht.
   data.json wird zusätzlich höchstens alle 3 Stunden ins Repository committet.
4. Im Browser prüft autorefresh.js alle 2 Minuten die kleine Datei version.json.
   Gibt es einen neuen Datenstand, werden alle Charts automatisch neu geladen
   (ohne Seiten-Neuladen; Scrollposition, USA-Seite und offenes Chart bleiben).

ABSICHERUNG
- Jede Quelle hat ein eigenes Zeitlimit. Hängt oder scheitert eine Quelle, wird nur
  ihr Schritt zurückgesetzt; alle anderen Daten werden trotzdem aktualisiert.
- Fällt eine Quelle aus, bleibt der letzte gute Wert (mit seinem Datum) erhalten,
  statt dass der Chart leer wird.
- Die Zusammenfassung jedes Laufs steht unter Actions › Lauf › „Summary“.

EINMALIGE EINSTELLUNG (empfohlen)
Settings › Pages › Build and deployment › Source: „GitHub Actions“ wählen.
Aktuell ist dort „Deploy from a branch“ mit dem Ordner /docs eingestellt. Diesen
Ordner gibt es nicht, deshalb schlägt „pages build and deployment“ bei jedem Commit
fehl (rote Läufe + E-Mails). Die Seite selbst wird über die Workflows veröffentlicht.

ZUVERLÄSSIGER TAKT (optional, empfohlen)
GitHub startet Zeitpläne nur „best effort“: Ein stündlicher Cron lief in der Praxis
nur alle 4–8 Stunden. Für einen garantierten Takt startet ein kostenloser externer
Cron-Dienst den Workflow per API:
1. GitHub › Settings (Profil) › Developer settings › Personal access tokens ›
   Fine-grained tokens › „Generate new token“
   - Repository access: nur dieses Repository
   - Permissions › Repository › Actions: „Read and write“
2. Bei https://cron-job.org (kostenlos) einen Cronjob anlegen:
   - URL: https://api.github.com/repos/Hossein7935/Hossein7935.github.io/actions/workflows/update-data.yml/dispatches
   - Zeitplan: alle 15 oder 30 Minuten
   - Erweitert › Request method: POST
   - Header: Authorization: Bearer <TOKEN>
             Accept: application/vnd.github+json
   - Request body: {"ref":"main"}
   Erfolgreich ist der Aufruf, wenn GitHub mit Status 204 antwortet.
Der Token gehört NICHT in index.html oder ins Repository.

USA-SEITE „CREDIT VERGABE“ (credit.js + scripts/fetch-credit.mjs)
- Credit Supply: SLOOS-Kreditstandards (DRTSCILM, DRTSCIS, DRTSCLCC), Bankkredite H.8
  (TOTBKCR, TOTCI als Wachstum J/J), Kreditlinien (SLOOS SUBLPDCILTMNQ, SUBLPDCISTMNQ)
- Credit Demand: SLOOS-Kreditnachfrage (DRSDCILM, DRSDCIS) und Kreditanfragen
- Credit Stress: SKSI aus github.com/Hossein7935/sksi-credit-stress-index (data/sksi_weekly.csv,
  latest.json, calibration.json) plus Bausteine HY-OAS, IG-OAS, Baa−Aaa, NFCI von FRED
- Alle Charts: Klick = Großansicht mit 6 Monate / 1 / 3 / 10 Jahre / Max und Fadenkreuz

DATENQUELLEN (Aktualisierung)
- TradingView (Renditen 2J/10J aller Länder, US 3M/1Y/2Y/5Y/10Y/30Y): laufend
- Yahoo Finance (DXY, Kupfer/Gold, SOFR-Futures, MOVE): laufend bzw. Tagesschluss
- U.S. Treasury Yield-Curve-CSV (nominal + real/TIPS): täglich am US-Nachmittag
- NY Fed (SOFR, EFFR): täglich 8:00 Uhr New York für den Vortag
- FRED (lange Historien, Spreads): 1–2 Werktage Verzug; neuere Tage werden aus
  Treasury/TradingView/NY Fed nach derselben Formel ergänzt (z. B. 10Y−2Y = DGS10−DGS2)
- OECD, IMF, BIS, World Bank, Fed Z.1, OFR, FHLB: monatlich/quartalsweise
- Optional: TRADING_ECONOMICS_API_KEY als Actions-Secret für zusätzliche 2J-Renditen

Quellen können einzelne Länder/Zeiträume nicht abdecken oder ihre API ändern. Fehlende
Werte werden nicht erfunden; Hinweise stehen in data.json unter „errors“.
