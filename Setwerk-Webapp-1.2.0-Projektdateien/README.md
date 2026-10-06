# Setwerk – Web-App 1.2.0

Vollständige Projektdateien für die Veröffentlichung bei einem eigenen Hostinganbieter oder in einem eigenen Git-Repository.
Stand: 6. Oktober 2026. Enthält das neue Cardioformular und den Workout-Export/Import über Dateien und Codes.

## Direkt veröffentlichen

Setwerk ist eine statische Web-App. Alle Dateien zum Betrieb liegen bereits fertig im Ordner `dist`.

1. Dieses ZIP entpacken.
2. Bei deinem Hostinganbieter ein Projekt für eine statische Website anlegen.
3. Den Ordner `dist` als Veröffentlichungs-/Ausgabeordner festlegen. Bei einem direkten Datei-Upload den gesamten Inhalt von `dist` in das Web-Stammverzeichnis hochladen, sodass `index.html` direkt dort liegt.
4. Keinen Build-Befehl eintragen. Es sind keine Installation von npm-Paketen, keine Datenbank, API-Schlüssel oder Umgebungsvariablen für den Betrieb erforderlich.
5. Die Website über HTTPS bereitstellen. Die App aktiviert ihren Offline-Cache nur bei HTTPS. Der erste Aufruf benötigt Internet.
6. Die neue Adresse aufrufen und auf dem Smartphone zum Home-Bildschirm hinzufügen.

Hosting-Einstellungen:

| Einstellung | Wert |
| --- | --- |
| Framework | Static / Other / keines |
| Projektverzeichnis | Wurzel des entpackten Projekts |
| Build-Befehl | leer lassen / deaktiviert |
| Ausgabe-/Publish-Verzeichnis | `dist` |
| Startdatei | `dist/index.html` |
| Server/Backend | nicht erforderlich |
| Umgebungsvariablen | keine |

Die exportierte App hat keine eingebaute Anmeldung und keine Bindung an die bisherige private Adresse. Ob die neue Website öffentlich oder zugriffsgeschützt ist, bestimmst du beim Hostinganbieter.

## Daten beim Umzug

Trainingsdaten und Vorlagen liegen im lokalen Speicher des jeweiligen Browsers. Eine neue Domain verwendet einen separaten Speicher. Exportiere daher vor dem Wechsel die gewünschten Vorlagen und absolvierten Einheiten in der bisherigen App und importiere sie anschließend auf der neuen Adresse. Der Export betrifft einzelne Workouts/Vorlagen, nicht sämtliche Einstellungen oder laufende Entwürfe.

Persönliche Trainingsdaten sind nicht in diesem Projekt enthalten. Jeder Nutzer verwaltet seinen eigenen lokalen Datenbestand. Die öffentliche Bereitstellung teilt keine persönlichen Trainingsdaten automatisch. Freunde können Workouts gezielt über die Export-/Import-Funktion austauschen.

## In ein eigenes Git-Repository übernehmen

Lade den gesamten entpackten Projektordner in dein eigenes Repository hoch. `dist` gehört mit ins Repository, weil dort die fertige Anwendung einschließlich ihres Quellcodes liegt.

Falls du Git lokal verwendest, kannst du im entpackten Projektordner beginnen mit:

```sh
git init
git add .
git commit -m "Initial Setwerk web app"
```

Verbinde das Projekt anschließend mit der Repository-Adresse deines Git-Anbieters. Es sind keine Zugangsdaten oder bestehenden Remote-Einstellungen enthalten.

## Lokal ansehen

Mit Python 3 im Projektordner:

```sh
python3 -m http.server 8080 --directory dist
```

Danach `http://localhost:8080` öffnen. Unter Windows funktioniert alternativ `py -m http.server 8080 --directory dist`.

Nicht einfach `index.html` per Doppelklick öffnen: Für einen regulären Test der Browserfunktionen sollte die App über einen Webserver laufen. Der Offline-Cache ist in diesem Projekt bei der lokalen HTTP-Vorschau deaktiviert.

## Weiterentwickeln und prüfen

Die Dateien in `dist` sind der bearbeitbare HTML-, CSS- und JavaScript-Quellcode; es gibt keinen zusätzlichen Bundler.

- `dist/index.html`: Einstiegspunkt und geladene Dateien
- `dist/app.js`: Oberfläche, Kalender, Formulare und Ereignisse
- `dist/core.js`: Trainingslogik, Rekorde und Validierung
- `dist/transfer.js`: Workout-Dateien, Codes und Importprüfung
- `dist/styles.css`: Gestaltung
- `dist/i18n.js`: Deutsch/Englisch
- `dist/exercises.js` und `dist/exercises-en.js`: 269 Übungen
- `dist/sw.js`: Offline-Cache
- `dist/manifest.webmanifest`: installierbare Web-App
- `scripts`: Erzeugung der Übungskataloge
- `tests`: Tests für Trainingslogik, Cardio und Datenaustausch

Für die automatisierten Tests Node.js und npm installieren, dann:

```sh
npm ci
npm test
npm run check
```

`jsdom` wird nur für die Entwicklungstests verwendet und nicht von der veröffentlichten App benötigt. Beim Ändern von Anwendungsdateien auch die Versionskennung in `dist/sw.js` erhöhen, damit ein neuer Offline-Cache angelegt wird.

Die übertragenen Anwendungsdateien entsprechen der geprüften Web-Version 1.2.0. Dateidialoge und Teilen-Menüs müssen zusätzlich auf den tatsächlich verwendeten Geräten geprüft werden.

## Enthaltene Funktionen

Trainingsvorlagen, Spontantraining, Focus Mode mit Satzpausen und direkt bearbeitbaren Werten, 269 Übungen, persönliche Rekorde und Fortschritt, Kalender, manuelle Aufzeichnung, spezielles Cardioformular, Deutsch/Englisch, Trainingsfeedback sowie Workout-Dateien und -Codes mit Importvorschau.

Systembenachrichtigungen bei geschlossener App sind in der Web-Version nicht implementiert. Es gibt keine automatische Synchronisierung zwischen Geräten und keine automatische Gesamtsicherung.
