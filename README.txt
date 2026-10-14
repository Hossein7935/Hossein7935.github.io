MacroWatch v10 – Installation mit automatischer Datenaktualisierung

Diese Version verwendet GitHub Actions als kostenlosen Datenabruf. Es ist kein eigener Server erforderlich. Der Workflow aktualisiert data.json etwa alle sechs Stunden.

Dateien und Ordner im ZIP beibehalten:
- index.html
- manifest.json
- sw.js
- data.json (wird beim ersten Workflow-Lauf erzeugt)
- scripts/update-data.mjs
- .github/workflows/update-data.yml

Installation:
1. Alle Dateien und Ordner in das GitHub-Repository macrowatch hochladen und alte index.html/sw.js ersetzen. Wichtig: scripts und .github müssen an den angegebenen Pfaden liegen.
2. Im Repository Settings > Actions > General prüfen, dass Workflows laufen dürfen.
3. Öffne Actions und starte „MacroWatch data update“ einmal mit Run workflow. Bei einem Push sollte der Workflow ebenfalls starten.
4. Der Workflow erstellt data.json und committet sie. Danach die GitHub-Pages-Website neu laden.
5. Optional für automatische 2-Jahres-Renditen außerhalb der USA: Settings > Secrets and variables > Actions > New repository secret. Name: TRADING_ECONOMICS_API_KEY. Value: dein API-Key. Der Schlüssel kommt NICHT in index.html.

Datenquellen: OECD SDMX (Inflation, Quartals-BIP und langfristige Zinsen), IMF DataMapper (NGDP_RPCH), BIS SDMX WS_CBPOL (Leitzinsen), US Treasury XML (US 2Y/10Y), FRED als Fallback, Trading Economics API (2Y/10Y mit Key).

Datenqualität: Quellen können einzelne Länder/Zeiträume nicht abdecken oder API-Änderungen erfahren. Der Workflow schreibt data.json mit den Werten, Datenständen und Fehlern, statt fehlende Zahlen zu erfinden. Für eine kostenlose statische Website kann ein API-Key erforderlich sein, um alle 2-jährigen Renditen zu erhalten.
