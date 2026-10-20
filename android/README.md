# Setwerk Android 1.4.7 – minimalistischer Focus Mode (Vorschau)

Version 1.4.7 entfernt Workout-Titel, Satzart, die zusätzliche Bearbeitungszeile und die Vorschau der nächsten Übung aus dem Focus Mode. Ein schmaler Balken zählt vollständig abgeschlossene Übungen. Der Stift öffnet den Editor der betrachteten Übung; die Satzkreise bleiben als Navigation erhalten. Größere Werte lassen sich direkt mit Pfeilen ändern: Wiederholungen um 1, Gewicht um 0,5 kg, auch bei Anzeige in Pfund.

Unter „Personalisieren“ sind kg/Pfund, Meter/Meilen und der standardmäßig ausgeblendete letzte Eintrag einstellbar. Gespeicherte Trainingswerte bleiben in kg und Metern. Der Musikbereich sitzt als kompakte Leiste am unteren Rand: Titel, Pause und nächstes Lied. Nach unten über den Titel wischen oder ihn antippen öffnet die vollständigen Bedienelemente. Registerwechsel per Wischen oder Klick erhalten eine kurze Animation; reduzierte Bewegung wird respektiert.

Die Countdown-Korrektur aus Version 1.4.6 verwendet ein eigenes `Chronometer`-Feld in der kompakten und aufgeklappten Android-Benachrichtigung. Die Restzeit hängt dadurch nicht mehr allein von der Zeitdarstellung im Systemkopf ab. Der gespeicherte Endzeitpunkt wird für das Widget auf Androids monotone Uhr umgerechnet. SystemUI aktualisiert den Countdown auch bei geschlossener Oberfläche; beim Ablauf wird die Anzeige entfernt. Die Darstellung auf dem betroffenen Gerät muss erneut geprüft werden.

Diese Vorschau ergänzt die folgenden Änderungen gegenüber 1.4.4:

- Wischen auf Übungszeilen funktioniert, und die Übungsliste blendet den Musikbereich aus.
- Die Pause hat nur die Übungsauswahl oben rechts. In Android erscheint beim Wechsel in den Hintergrund oder Schließen der Oberfläche eine laufende Systembenachrichtigung mit verbleibender Pausenzeit. Sie verwendet den Android-Countdown und benötigt keinen Overlay-Zugriff. Beim ersten Pausenstart wird ab Android 13 die normale Benachrichtigungsfreigabe angefragt. Tippen öffnet das Training; Rückkehr, Überspringen und Trainingsabschluss entfernen die laufende Anzeige. Ohne Benachrichtigungsfreigabe bleibt der Timer in der App verfügbar. Das Aussehen der Statusleiste hängt von der Android-Version ab; der Countdown steht in der Benachrichtigung.
- Langes Drücken auf eine Übungszeile öffnet die Löschoption. Die Übung einschließlich ihrer Sätze wird nur aus der laufenden Einheit entfernt. Vorlage und andere Übungen bleiben erhalten. Scrollen und Ziehen lösen das Menü nicht aus; Rechtsklick und Shift+F10 sind ebenfalls möglich.
- Die vorhandenen Satzkreise wählen frühere oder spätere Sätze zur Bearbeitung, auch abgeschlossene Sätze. Die Auswahl verändert keinen Abschluss und keine noch laufende Satzpause. Die vorhandene Hauptschaltfläche führt bei Bedarf zum aktuellen Satz zurück.
- Der letzte Satz bietet „Training abschließen“. Bestätigen übernimmt ihn ohne neue Pause und führt zum bisherigen Feedback; alternativ lässt sich das Training erweitern. Abbrechen lässt den Satz offen.
- Übersicht, Vorlagen, Übungen, Kalender und Fortschritt wechseln durch horizontales Wischen. Eingaben, Dialoge, vertikales Scrollen und Bearbeiten von Entwürfen behalten ihre Gesten.

Die Systembenachrichtigung und reale Android-Berechtigungsdialoge müssen auf einem Gerät geprüft werden. Die Vorschau ist noch nicht auf der produktiven Website veröffentlicht.

Im Focus Mode öffnet Linkswischen die Übungsauswahl mit Satzstand und formatiertem Fortschritt. Antippen wechselt zur Übung; „Starte diese Übung“ aktiviert sie ohne Satzabschluss. Das Plus ergänzt Übungen, und am Griff lassen sich Übungen direkt ziehen. Aktive Übung, Satzwerte, Timer und Pause bleiben beim Umsortieren erhalten. Die Ansicht wechselt mit einer seitlichen Animation. Auch der aktuelle Login-Dialog ist enthalten.

## Musiksteuerung

Diese Version enthält einen kompakten Musikbereich im Focus Mode und während
der Satzpause. Er steuert die aktive Android-Medien-App mit Titel, Interpret,
Zeitleiste, Pause/Fortsetzen und vorherigem/nächstem Titel. Das Logo und der Name der aktiven Musik-App
stehen im Kopf des Players; das Logo stammt vom installierten Android-App-Icon. Die Zeitleiste ist
nur bedienbar, wenn der Player eine Dauer und die Seek-Funktion freigibt.

Einmalig im Musikbereich „Musiksteuerung einrichten“ wählen und in Android den
Benachrichtigungszugriff für „Setwerk Musiksteuerung“ aktivieren. Die App liest
keine Benachrichtigungsinhalte, sondern ausschließlich Android-Mediensitzungen.
Musikdaten werden weder in Trainingsdaten noch in Firebase gespeichert.

Der nächste Titel wird nur angezeigt, wenn die Medien-App ihre Warteschlange
und den aktuellen Eintrag bereitstellt. Das X erscheint nur bei ausdrücklich
unterstützten AndroidX-Queue-Befehlen. Die UI wartet auf die Aktualisierung der
Warteschlange; bei ausbleibender Bestätigung bleibt das Lied sichtbar und ein
Hinweis erscheint. Anbieter ohne diese Freigaben bieten die Grundsteuerung.
Die tatsächliche Unterstützung ist auf einem Android-Gerät mit den verwendeten
Musik-Apps zu prüfen; Browserchecks verwenden gekennzeichnete Beispieldaten.

Gezielte Prüfung: `node --test tests/music.test.cjs tests/android.test.cjs
tests/health.test.cjs`; `MusicQueuePolicyTest.java` prüft Queue-Zuordnung und
Positionsberechnung. `tests/music-browser-check.cjs` prüft die eigenständige
interaktive Vorschau. Die native Musiksteuerung wird mit diesem APK-Update installiert.

Android verwendet die gemeinsame Web-Oberfläche aus Vorschau-Commit `9f03a6f8d7d2991674d02d795e7e06270f6de07a`. Die Oberfläche und alle 269 Übungen liegen in der APK; Training funktioniert auch ohne Anmeldung und ohne Internet.

## Automatische Schritte und Health Connect

Ohne verbundene Health-Quelle kann Setwerk ab Android 8 selbst über `TYPE_STEP_COUNTER` zählen. Ein passender Handysensor ist erforderlich. Ab Android 10 wird nach ausdrücklicher Aktivierung die Berechtigung **Körperliche Aktivität** angefragt. Der sparsame native Vordergrunddienst zählt ab Aktivierung weiter, auch wenn die Oberfläche geschlossen ist, und zeigt eine dauerhafte Android-Benachrichtigung. Er wird bei Neustart und App-Update wieder aufgenommen, sofern aktiviert und erlaubt. Android-Stopp erzwingt eine Unterbrechung bis zum nächsten Öffnen. Die Schritte vor der erstmaligen Aktivierung können nicht rekonstruiert werden; der bereits gespeicherte Tageswert dient als Ausgangswert. Tageswerte werden lokal je Setwerk-Konto geführt.

Health Connect bleibt ab **Android 14** verfügbar. Nach **Health verbinden** und ausdrücklicher Freigabe des Lesens von Schritten sind dessen Tagessummen die Quelle. Der eigene Zähldienst wird gestoppt; beide Quellen werden niemals addiert. Health Connect kann je nach Systemstand selbst Handyschritte sammeln oder Werte aus kompatiblen Apps und Uhren liefern. Bei Trennung oder entzogener Health-Berechtigung kehrt Setwerk zum vorher aktivierten Handyschrittzähler zurück; fehlt dessen Freigabe, bietet die App die Aktivierung an.

Die sichtbare **Übersicht** übernimmt Werte beim Öffnen bzw. Zurückkehren und danach **alle zwei Minuten**. Beim Wechsel auf eine andere Seite oder in den Hintergrund stoppt dieser Aktualisierungstimer. **Synchronisieren** aktualisiert sofort, auch auf anderen Seiten. Übernommen werden Tagessummen der letzten sieben Tage, keine Addition bereits importierter Schritte. Health-Tage ohne Daten behalten bestehende Werte; eine gemeldete Null ist ein gültiger Wert. Setwerk schreibt keine Werte zurück nach Health Connect. Bei angemeldetem Konto laufen gespeicherte Schrittwerte durch dieselbe Firebase-Synchronisierung wie die anderen Trainingsdaten.

**Trennen**, **Health-Einstellungen** und **Schrittzählung stoppen** stehen in **Kontodaten → Schritte & Health Connect**. Gäste erreichen diesen lokalen Abschnitt über **Kontodaten** im Schrittzähler. Die Zustimmungen bleiben pro Konto auf diesem Gerät. Kontowechsel, Trennung, Hintergrundwechsel und Seitenwechsel verwerfen unpassende verspätete Antworten. Offene Schritt- und Gewichtseingaben bleiben erhalten.

Die automatisierten Prüfungen simulieren Sensor-/Health-Antworten und prüfen die native Zählerdifferenz einschließlich Neustart. Installation, Berechtigungsdialoge, OEM-Hintergrundverhalten und reale Sensorwerte müssen noch auf einem Android-Gerät getestet werden. Bei stark verzögerten Sensorereignissen über Mitternacht kann die Zuordnung des kumulierten Zuwachses zum Tag des Ereignisses ungenau sein.

## Installation

`Setwerk-1.4.7-Vorschau.apk` als Update über Setwerk 1.4.6 installieren. Paketkennung `at.setwerk.app.v2` und Signatur bleiben gleich, der Versionscode steigt auf 13. Die App vorher nicht deinstallieren, damit die lokal gespeicherten Daten erhalten bleiben. Android 8 oder neuer ist erforderlich.

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
python3 build.py --tools /path/to/build-tools/35.0.0 --platform /path/to/android-35/android.jar --signing /private/signing.properties --keystore /private/setwerk-stable-release.jks --output /path/to/Setwerk-1.4.7.apk
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

Die APK wurde gebaut und signaturgeprüft. Die Zertifikatsgleichheit zur APK 1.4.3 wurde geprüft. Ein Installationstest und die nativen Systemdialoge bzw. Hintergrundbenachrichtigungen auf einem echten Android-Gerät stehen aus. Details zu den ausgeführten Prüfungen stehen in `VALIDATION.json`.
