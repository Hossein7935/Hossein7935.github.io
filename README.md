MACROWATCH v4 – Installation

Enthaltene Dateien:
- index.html: App-Oberfläche und JavaScript
- manifest.json: Installation zum Home-Bildschirm
- sw.js: einfache Offline-Shell

GitHub Pages:
1. Erstelle auf GitHub ein öffentliches Repository namens macrowatch.
2. Lade ALLE DREI Dateien direkt in die oberste Ebene des Repositorys hoch (nicht in einen Unterordner).
3. Öffne Settings > Pages. Wähle Deploy from a branch, Branch main, Ordner /(root), dann Save.
4. Warte auf die Veröffentlichungsmeldung und öffne die angezeigte Adresse in Safari.
5. Auf dem iPhone: Teilen > Zum Home-Bildschirm.

Design: Über die Schaltfläche „☀️ Helles Design“ / „🌙 Dunkles Design“ kannst du zwischen hellem und dunklem Design wechseln. Deine Auswahl wird auf diesem Gerät gespeichert.

Daten: Die App versucht, Quartalsverläufe aus der öffentlichen OECD-SDMX-API zu laden und die Jahres-BIP-Prognose über die IMF-API. Für Inflation gibt es einen Weltbank-Jahreswert als Fallback. Die OECD-Datenabfragen können je nach API-Verfügbarkeit, Datensatzstruktur oder Browser-CORS scheitern; Statusmeldungen zeigen dann, wie viele Länder tatsächlich Daten geliefert haben. Bitte prüfe die Statuszeile nach dem Aktualisieren. Leitzins und 2-/10-jährige Staatsanleiherenditen sind weiterhin manuell einzutragen.

Inflationsbalken: Quartalsdurchschnitt monatlicher Inflationsraten gegenüber dem Vorjahr. BIP-Balken: reales Wachstum gegenüber dem Vorquartal. Große BIP-Zahl: jährliche IMF-Prognose. Keine fehlenden Daten werden erfunden.
