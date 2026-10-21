# Setwerk

Trainings-App für Web und Android mit Vorlagen, Spontantraining, Focus Mode, Übungskatalog, Kalender, Cardio- und Ballsportaufzeichnung sowie Workout-Import und -Export.

## Aktueller Stand

- Webapp: https://setwerk-cb1e0.web.app
- Anmeldung: Firebase Authentication mit E-Mail und Passwort.
- Datenspeicher: Cloud Firestore im Projekt `setwerk-cb1e0`.
- Android: Version 1.4.0; vollständiger Quellcode und Bauanleitung unter [android/](android/README.md).
- Web-Quellcode: `Setwerk-Webapp-1.2.0-Projektdateien/dist`. Der Ordnername bleibt für bestehende Konfigurationen erhalten; sein Inhalt ist die aktuelle Firebase-Version.

Abgeschlossene Trainings, Vorlagen, eigene Übungen, Einstellungen und Profile werden pro Konto synchronisiert. Laufende Trainings und Entwürfe bleiben lokal. Ohne Verbindung bleiben Änderungen gespeichert und werden später übertragen. Gastnutzung ist weiterhin möglich.

## Firebase und Veröffentlichung

Die Einrichtung und das Datenmodell stehen in [FIREBASE-SETUP.md](FIREBASE-SETUP.md). `firebase.json`, `firestore.rules` und `firestore.indexes.json` enthalten die Hosting- und Datenbankkonfiguration.

GitHub Actions veröffentlicht den Branch `firebase-migration` nach erfolgreichen Anwendungs-, Emulator- und Browserprüfungen auf Firebase Hosting. `main` und `android-web-parity` enthalten ebenfalls den konsolidierten aktuellen Projektstand. Private Dienstkontoschlüssel gehören ausschließlich in die vorgesehenen GitHub-Secrets; Android-Signaturschlüssel werden separat gesichert.

## Google Analytics auf der Website

Die Website verwendet den Google-Tag `G-LN5XDNS42W` des Firebase-Webprojekts.
`analytics.js` lädt Google Analytics erst nach einer ausdrücklichen Zustimmung.
Ablehnen und Zustimmen sind gleichwertig erreichbar; die Auswahl wird auf dem
jeweiligen Browser gespeichert und lässt sich am Seitenende über
„Statistik-Einstellungen“ ändern. Bei Widerruf wird Analytics deaktiviert und
die erreichbaren Analytics-Cookies werden entfernt. Werbezwecke bleiben
deaktiviert. Diese Einbindung überträgt keine Kontonamen, E-Mail-Adressen oder
Trainingsinhalte als eigene Ereignisse; die konfigurierte Seitenadresse enthält
keine URL-Parameter oder Fragmente.

Die Änderung gilt nur für die Website. Der native Android-Client lädt diesen
Tag nicht. Zusätzliche Ereignisse für gestartete oder abgeschlossene Trainings
sind nicht Teil dieser Einbindung.

Prüfung: Auf der Website zustimmen, den Request für
`googletagmanager.com/gtag/js?id=G-LN5XDNS42W` prüfen und den Echtzeitbericht der
zugehörigen Google-Analytics-Property öffnen. Automatisierte Prüfungen fangen
Google-Anfragen ab und senden keine Testdaten an die Property:

```sh
node scripts/analytics-browser-check.cjs
```

## Prüfungen

Mit Node.js 22 oder neuer:

```sh
npm ci
npm test
```

Android-Prüfungen:

```sh
npm ci --prefix android
npm run test:android
```

Die Firebase-Emulatorprüfungen und mobilen Browserprüfungen sind in den GitHub-Workflows hinterlegt. Anleitungen zum Android-Build und den verbleibenden Gerätetests stehen in `android/README.md`.

## Vorhandene Trainingsdaten

Gastdaten können im Konto unter Synchronisierung und Datensicherung ausdrücklich übernommen werden. Android unterstützt zusätzlich die Übernahme gespeicherter Daten früherer Konten. Diese Wiederherstellung benötigt keine Verbindung zum alten Backend. Bestehende lokale Trainingsdaten und Android-Signaturschlüssel bleiben erhalten.
