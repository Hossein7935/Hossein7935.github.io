MACROWATCH – erste funktionierende Web-App

DATEIEN
- index.html: komplette Oberfläche und JavaScript
- manifest.json: Installationsdaten für Home-Bildschirm
- sw.js: Offline-Cache für die App-Dateien

INSTALLATION MIT GITHUB PAGES
1. ZIP entpacken.
2. Auf https://github.com einloggen und ein Repository namens macrowatch erstellen (Public).
3. Im Repository Add file > Upload files wählen.
4. index.html, manifest.json und sw.js direkt hochladen (nicht den Ordner selbst).
5. Unten Commit changes klicken.
6. Settings > Pages öffnen.
7. Bei Build and deployment: Deploy from a branch; Branch main; Ordner /(root); Save.
8. Warten, bis die Website veröffentlicht ist. Die Adresse ist normalerweise https://DEIN-BENUTZERNAME.github.io/macrowatch/.
9. Die Adresse in Safari auf dem iPhone öffnen > Teilen > Zum Home-Bildschirm.

WAS DIE APP MACHT
- Versucht die jährliche Inflation automatisch über die Weltbank-API zu laden.
- Versucht die IMF-Prognose für reales BIP-Wachstum (ausgewähltes Jahr) zu laden.
- Leitzins und 2-/10-jährige Staatsanleihen können manuell eingetragen werden. Zu jedem Land gibt es Links zu offiziellen Quellen.
- Manuelle Werte werden im Browser lokal gespeichert.
- Benachrichtigungen können Wertänderungen beim nächsten Datenladen anzeigen, wenn der Browser sie erlaubt.

WICHTIGE GRENZEN
- Die Weltbank liefert jährliche Daten, die nicht dem aktuellsten Monatswert entsprechen müssen.
- IMF-API-Aufruf oder Browser-CORS können fehlschlagen. Dann bleibt der Wert leer; nichts wird erfunden.
- Leitzinsen und Anleiherenditen werden in dieser Version nicht automatisch gesammelt.
- Verlässliche Push-Nachrichten bei geschlossener App erfordern normalerweise einen Push-Dienst/Server. Diese App hat keinen eigenen Server.
