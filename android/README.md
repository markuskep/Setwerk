# Setwerk Android 1.4.0

Android auf dem Funktionsstand der Webapp unter https://setwerk-cb1e0.web.app/ (Commit `8d4c3570d6f4d5b3b8faf50529fa8e4627171ba3`). Die Oberfläche und alle 269 Übungen liegen in der APK; Training funktioniert auch ohne Anmeldung und ohne Internet.

## Installation

`Setwerk-1.4.0.apk` als Update über Setwerk 1.1, 1.3.0 oder 1.3.1 installieren. Paketkennung `at.setwerk.app.v2` und Signatur bleiben gleich, der Versionscode steigt auf 5. Die App vorher nicht deinstallieren, damit die lokal gespeicherten Daten erhalten bleiben. Android 8 oder neuer ist erforderlich.

Mit demselben Firebase-Konto wie in der aktuellen Webapp anmelden. Frühere Netlify-Anmeldungen werden nicht als Firebase-Sitzung übernommen. Registrierung und Passwort-Zurücksetzen sind direkt in der App möglich.

## Übernommene Funktionen

- Überarbeiteter Kalender ohne Workout-Importknopf; Import über **Vorlagen**.
- Höhenmeter nur bei passenden Aktivitäten.
- Cardio-Vorlagen mit klassischem Cardio, Intervallen oder eigener Trainingsform, einschließlich Sportart und relevanter Parameter.
- Ballsport mit freier Sportart, Dauer und Notizen.
- Übungseditor für Kraft und Kraft-Ausdauer; Cardio und Ballsport starten und enden ohne Kraftsätze.
- Kontomenü mit Nutzernamen, Profilbild, Passwortänderung, Abmeldung und Kontolöschung.
- Firebase-Anmeldung und gemeinsamer Datenspeicher mit der Webapp; Synchronisierung abgeschlossener Einheiten, Vorlagen, eigener Übungen, Einstellungen, Profil und Feedback.
- Lokale Entwürfe, laufende Trainings, Offline-Speicherung, Import/Export und Android-Erinnerungen bleiben erhalten.

Die besprochene Funktion für mehrwöchige Trainingspläne ist noch nicht umgesetzt und deshalb nicht Teil dieses Updates.

## Bisherige Daten übernehmen

Gastdaten bleiben in `SharedPreferences("setwerk")["state"]`. Im Konto unter **Synchronisierung & Datensicherung** können sie mit **Lokale Trainings in dieses Konto übernehmen** in das neue Firebase-Konto kopiert werden. Die ursprünglichen Gastdaten bleiben erhalten.

Lokal gespeicherte Kontodaten aus Android 1.3.x bleiben ebenfalls erhalten. Im selben Dialog erscheint bei vorhandenen Daten der Abschnitt **Trainings aus früheren Android-Versionen**. Das gewünschte frühere Konto auswählen. Abgeschlossene Trainings, Vorlagen und eigene Übungen werden zusammengeführt; ein älteres laufendes Training oder ein Entwurf kann anschließend lokal fortgesetzt werden. Ein aktuelles Training oder ein aktueller Entwurf muss vorher abgeschlossen bzw. gespeichert werden. Bei unterschiedlichen Datensätzen mit derselben ID wird die Übernahme angehalten. Die ursprüngliche Speicherung wird nicht gelöscht. Daten, die ausschließlich im früheren Online-Speicher liegen, werden dadurch nicht automatisch migriert.

## Plattformanbindung

Die App behält den lokalen Ursprung `https://appassets.androidplatform.net/assets/index.html`. Nur gebündelte Assets werden im WebView geladen. Ausgewählte Dateien laufen über Androids Dokumentauswahl, Exporte über den Speichern-Dialog. Die Cloudverbindung verwendet Firebase Auth und Firestore REST über den nativen HTTPS-Client; es werden dieselben benutzereigenen Dokumente und dasselbe Snapshot-Format wie in der Webapp verwendet.

Passwörter werden nicht gespeichert. ID- und Refresh-Tokens liegen AES-GCM-verschlüsselt im Android-Keystore-gestützten Speicher. Die eingebettete Firebase-Konfiguration ist öffentlich; private Dienstkonto- und APK-Signaturschlüssel gehören nicht in dieses Projekt.

Laufende Einheiten und Entwürfe bleiben lokal. Beim Ende einer Einheit sowie beim Zurückkehren zur App werden abgeschlossene Daten abgeglichen. Revision und Dokumentänderungszeit schützen vor konkurrierenden Schreibzugriffen. Die Datenbank prüft Nutzerkennung und Zugriffsrechte unabhängig vom Client. Bei Kontolöschung wird die Datenübertragung angehalten und ein inhaltsfreier Löschmarker geschrieben; schlägt das Löschen der Zugangsdaten fehl, wird die vorherige Online-Sicherung wiederhergestellt.

## Webstand aktualisieren

Vom Repository-Stamm aus:

```bash
python3 android/sync_web.py --web Setwerk-Webapp-1.2.0-Projektdateien --commit <web-commit-sha>
```

Das Skript kopiert gemeinsame Assets, übernimmt die wenigen Android-Anpassungen und schreibt die Fingerabdrücke in `SOURCE_VERSION.json`. Ändert sich eine erforderliche Integrationsstelle in der Webapp, bricht es ab, damit die Android-Anpassung geprüft werden kann. Die plattformspezifische Datei `assets/firebase-service.js` bleibt erhalten.

## APK bauen

Benötigt: JDK 17, Android SDK Platform 35 und Build Tools 35.0.0. Alternativ zum JDK-Compiler kann Eclipse ECJ 3.38.0 verwendet werden.

```bash
python3 build.py --tools /path/to/build-tools/35.0.0 --platform /path/to/android-35/android.jar --signing /private/signing.properties --keystore /private/setwerk-stable-release.jks --output /path/to/Setwerk-1.4.0.apk
```

Bei ECJ zusätzlich `--compiler /path/to/ecj.jar`. Die bestehende private Signatursicherung separat verwenden; sie gehört nicht in den Quellcode. Build-Verzeichnisse können gelöscht werden.

## Prüfungen

```bash
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

Die Browserprüfung verwendet den Android-Asset-Ursprung mit einer simulierten nativen Bridge. Sie ersetzt keinen Test auf einem Android-Gerät. Optional kann `PLAYWRIGHT_CHROMIUM_EXECUTABLE` auf eine vorhandene Chromium-Datei zeigen.

`tests/FirebaseLiveTest.java` prüft die echte REST-Verbindung mit einem temporären Konto und entfernt dieses danach. Sie benötigt eine JVM und das Laufzeit-JAR `org.json`. Keine bestehenden Konten werden dafür verwendet. Bei Erfolg kann ein inhaltsfreier Löschmarker für das gelöschte Testkonto verbleiben. Nur bewusst ausführen; der normale CI-Lauf legt keine Firebase-Konten an.

Die APK wurde gebaut und signaturgeprüft. Die Zertifikatsgleichheit zur APK 1.3.1 wurde geprüft. Ein Installationstest und die nativen Systemdialoge bzw. Hintergrundbenachrichtigungen auf einem echten Android-Gerät stehen aus. Details zu den ausgeführten Prüfungen stehen in `VALIDATION.json`.
