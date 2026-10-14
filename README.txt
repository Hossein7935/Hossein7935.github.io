MacroWatch v7 — Installation

1. Entpacke die ZIP-Datei.
2. Öffne dein GitHub-Repository macrowatch.
3. Add file -> Upload files. Lade index.html, manifest.json und sw.js aus diesem Ordner hoch.
4. Commit changes. Überschreibe die alten Dateien.
5. Settings -> Pages -> Deploy from a branch -> main -> /(root) -> Save.
6. Öffne die GitHub-Pages-Adresse in Safari und lade neu.

Datenquellen: OECD (Inflation und Quartals-BIP), BIS (Leitzinsen), IMF (Jahres-BIP-Prognosen), US Treasury/FRED/EZB (verfügbare Anleihe-Reihen). Für automatische 2- und 10-Jahres-Renditen in allen sechs Ländern kann ein API-Key von Bonds API eingetragen werden. Ein Key wird lokal im Browser gespeichert, nicht in die HTML-Datei geschrieben. Der Anbieter kann nach einer Probezeit kostenpflichtig sein; prüfe dessen Bedingungen vor der Registrierung.

Die JavaScript-Syntax, ZIP-Struktur und CSV/SDMX-Parser wurden lokal geprüft. Ein Live-Test der Datenabrufe im iPhone-Browser war hier technisch nicht möglich. Wenn APIs CORS blockieren oder Zeitreihen nicht anbieten, zeigt MacroWatch die Fehler im Status an und erfindet keine Werte.
