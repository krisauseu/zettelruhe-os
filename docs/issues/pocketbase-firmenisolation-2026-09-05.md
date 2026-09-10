# Direkte PocketBase-Zugriffe, TP-020

Lokal geprüft am 2026-09-05. Der Befund ist bestätigt und im lokalen
Compose-Bestand korrigiert. Keine Aussage über den Zustand entfernter Instanzen.

## Ziel und Bestand

- Docker über den lokalen OrbStack-Unix-Socket; Compose-Arbeitsverzeichnis
  `/Users/kf/zettelruhe`, Container `zettelruhe-{pocketbase,next,caddy}-1`.
- Öffentlicher lokaler Eingang `http://localhost`, im Compose-Netz `http://caddy`.
  Next verwendet `PB_URL=http://pocketbase:8090`, `APP_URL=http://localhost`.
  PB-Datenvolume `zettelruhe_pb_data` an `/pb_data`.
- Laufende PocketBase-Version **0.39.10**, entsprechend dem Dockerfile.
  Alle 30 bisherigen JS-Migrationen bis `1730002600_belege_kunde.js` waren in
  `_migrations` vorhanden; SHA-256-Vergleich der Containerdateien mit dem Repo
  ergab vollständige Übereinstimmung. Keine Schemaabweichung beim geprüften
  Regel- und Dateischutzbestand gegenüber den Repository-Migrationen.
- Zwei vorhandene Testfirmen, nach ID sortiert als A und B bezeichnet.
  Vorher drei Nutzer und vier Mitgliedschaften. Keine vorhandenen Zugangsdaten
  geändert; Superuser nur für Einrichtung und Kontrolle verwendet.
- Vorher: alle 27 Fachcollections mit `listRule` und `viewRule`
  `@request.auth.id != ''`; `users` mit Eigenzugriff `id = @request.auth.id`.
  Alle Fach-CRUD-Schreibregeln und `users.manageRule` bereits `null`.
  Alle sieben Dateifelder `protected=false`.

## Erwartete Rechte

ADR-0006, ADR-0009 und ADR-0025 sehen Fachzugriffe über Next vor. Die tatsächlichen
Aufrufer in `app/src/lib/pb.ts` bestätigen das auch für Lesen und Dateien.
Direkte Fach-CRUD-Zugriffe sind für keine Nutzerrolle erforderlich. PocketBase-
Passwortauthentifizierung, Auth-Refresh und Lesen des eigenen Nutzerrecords
bleiben erlaubt. Der eigene Avatar bleibt mit eigenem Dateitoken lesbar.

| Identität | Next lesen / herunterladen | Next schreiben / hochladen | Firmen verwalten / wechseln | Direkte PB-Fachdaten und Fachdateien |
|---|---|---|---|---|
| Anonym | Nein | Nein | Nein | Nein |
| Lesen nur A oder nur B | Nur aktive Mitgliedsfirma | Nein | Kein Wechsel zur fremden Firma | Nein |
| Bearbeiten nur A oder nur B | Nur aktive Mitgliedsfirma | Nur aktive Mitgliedsfirma | Keine fremde Firma | Nein |
| Eigentümer A, Lesen B | Nur aktive Mitgliedsfirma | Nur in A | A verwalten; zwischen A und B wechseln | Nein |
| Nutzer ohne Mitgliedschaft | Keine Firma | Nein | Nein | Nein |

`users.role` bezeichnet die Instanzrolle, die Firmenrechte kommen aus
Mitgliedschaften. Die zusätzlichen Testnutzer haben `users.role=nutzer`.
Der PB-Nutzertoken und `zettelruhe_session` sind unterschiedliche Anmeldungen.
Ein Next-Cookie berechtigt nicht zum PB-API-Zugriff; ein PB-Nutzertoken öffnet
keine geschützte Next-Route.

## Reproduzierbare Befunde

Ausführung des zunächst fehlschlagenden Tests:

```bash
./scripts/test-pocketbase-isolation.sh
# Vor Korrektur, damaliger Testumfang: 372/1233 bestanden, 861 fehlgeschlagen.
# Nach reiner Schemaänderung: 1226/1233, sieben erlaubte Next-Downloads kaputt.
# Nach Dateihelfer-Korrektur: 1233/1233.
# Abschließend erweiterter Testumfang: 1303/1303, keine Fehler.
```

Die Fehlerzahl zählt auch die neu festgelegte Sperre direkter Zugriffe auf die
eigene Firma; sie ist keine Anzahl unabhängiger Sicherheitslücken.

| HTTP-Prüfung | Vorher tatsächlich | Nachher / Erwartung |
|---|---|---|
| Anonym: Fachlisten / bekannte IDs | 200 mit leerer Liste / 404; keine Records nachgewiesen | 403, gesperrt |
| A-Token: Listen, Filter auf B, bekannte B-Beleg-ID | 200, fremde Records lesbar | 403 |
| B-Token: entsprechende Zugriffe auf A | 200, fremde Records lesbar | 403 |
| Nutzer ohne Mitgliedschaft: Fachrecords | 200, ebenfalls lesbar | 403 |
| `expand=firma,user,lieferant` und verschachtelte Expansion | Firmendaten wurden erweitert; auch Eigenzugriff auf `users` expandierte `firma` | Fachzugriffe 403, Nutzerrecord ohne gesperrte Firmenexpansion |
| Bekannte Datei-URL, ohne Anmeldung | Original 200; Thumbnail-Abfrage 200 | 403 oder 404, keine Bytes |
| Datei mit gewöhnlichem PB-Token oder Nutzer-Dateitoken | Auch fremde Dateien 200 | 403 oder 404 |
| Direkte gültige Beleganlage, PATCH, DELETE | 403, kein unzulässiger Write bestätigt | Weiter 403 |
| Eigenes `users.role` / `users.firma` manipulieren | 403 | Weiter 403 |
| Mitgliedschaft hochstufen, Datei direkt ersetzen | Im finalen Test 403; Schema war vorher bereits gesperrt | 403 |
| Erlaubter Next-Download | 200 | 200, bytegleich mit Original |
| Next-Download aus fremder aktiver Firma | 404 | Weiter 404 |

Die sieben Felder sind `users.avatar`, `firmen.logo`, `belege.datei`,
`angebote.pdf`, `rechnungen.pdf` und jeweils `original_datei` in
`e_rechnungen_empfang` und `e_rechnungen_versand`. Der Test verwendet vorhandene
Dateien als reine Leseproben und synthetische Belege/Avatare. Er prüft Original,
`download=1`, Thumbnail-Abfrage und Nutzer-Dateitoken. Nur `belege.datei` hat
mit `200x200` eine konfigurierte Thumbnailgröße; bei den übrigen Feldern ist
der Thumbnail-Request ein Original-Fallback, kein Nachweis erzeugter Vorschaubilder.

PocketBase dokumentiert den Zusammenhang zwischen `protected`, Dateitoken und
`viewRule` unter [Files handling](https://pocketbase.io/docs/files-handling/),
die Sperre mit `null` unter [API rules](https://pocketbase.io/docs/api-rules-and-filters/).
Entscheidend für diesen Befund sind die HTTP-Tests mit der laufenden Version 0.39.10.

## Korrektur

Neue Migration `1730002700_direkte_api_absichern.js` sperrt die fünf CRUD-Regeln
der explizit benannten 27 Fachcollections und schützt alle sieben Dateifelder.
Die vorhandenen Auth-/Eigenzugriffsregeln an `users` bleiben bestehen.
PocketBase-Systemcollections und etwaige lokale Erweiterungen sind nicht betroffen.
Die Down-Funktion öffnet die Sicherheitslücke nicht wieder; Rückkehr zum alten
Schema erfordert einen bewussten Restore nach dem Betriebsverfahren.

`fetchRecordFile` in `app/src/lib/pb.ts` holt pro Download einen kurzlebigen
Superuser-Dateitoken über `/api/files/token`. Der Dateiabruf bleibt serverseitig
und ungecacht. Der Browser bekommt ausschließlich die Dateiantwort über die
vorhandenen Next-Routen nach Session- und Firmenprüfung. Kein Token-Redirect,
keine neue Authentifizierungsarchitektur, keine neuen Abhängigkeiten.

Beide lokalen Images wurden mit `docker compose build pocketbase next` neu
gebaut und mit `docker compose up -d --no-build` gestartet. Die Migration liegt
auch im neuen PB-Image und wurde in `_migrations` nachgewiesen. Schema und
Next-Dateihelfer müssen gemeinsam ausgeliefert werden, sonst scheitern erlaubte
Downloads. Es erfolgten kein Commit, Push oder produktives Deployment.

## Nachtest und Wiederholung

Der HTTP-Test besteht aus einem Shell-Wrapper zur lokalen Zielprüfung und einem
Node-Skript, das im vorhandenen Next-Container mit dessen Konfiguration läuft.
Es benötigt keine zusätzliche Dependency. Passwörter und Tokens werden nur im
Speicher gehalten und nicht ausgegeben. Die Testrecords werden im `finally`
entfernt. Ein harter Prozessabbruch kann die Bereinigung verhindern; solche
Records sind über den Präfix `ISOLATION-TP020-` auffindbar.

Vor erneuter Ausführung nach [Betrieb](../betrieb.md) sichern. Voraussetzung
sind diese lokale Testinstallation mit genau zwei Firmen sowie vorhandene
Dateiproben für Logo, Angebots-/Rechnungs-PDF und beide E-Rechnungsfelder.
Fehlt eine der sieben Dateiproben, meldet der Test einen Fehler. Nicht gegen
einen Bestand ausführen, der keine Testdaten enthalten darf. Next-GETs können
Zahlungsjournale nachtragen, der Scheduler kann unabhängig davon schreiben.

| Prüfung | Ergebnis |
|---|---|
| `./scripts/test-pocketbase-isolation.sh` | 1303/1303; Auth 26, Next 52, Record-Lesen 588, Schema 91, Schreiben 244, gezielte Firmenzugriffe 28, Dateien 274 |
| Listen und bekannte IDs | Alle 28 App-Collections mit echten IDs, eigene/andere Firmen und Nutzer ohne Mitgliedschaft |
| Next | Login, Firmenwechsel erlaubt/verboten, aktive Firma nach Wechsel, Beleglisten, Multipart-Upload als Bearbeiten, Upload-Verbot als Lesen, Download als Lesen; Logo, Beleg, Angebots-/Rechnungs-PDF, E-Rechnung Empfang/Versand bytegleich |
| `cd app && npm test` | 51 Dateien, 591 Tests bestanden; darunter zwei neue Transporttests für den Dateihelfer und Abbruch bei fehlendem Dateitoken |
| `cd app && ./node_modules/.bin/tsc --noEmit --incremental false` | Bestanden |
| ESLint für `src/lib/pb.ts` und `src/lib/pb-files.test.ts` | Bestanden |
| `cd app && npm run lint` | Unverändert drei bekannte Fehler und sechs Warnungen, siehe `docs/entwicklung.md` |
| `docker compose build pocketbase next` | Erfolgreicher Produktionsbuild; bekannte Next-Warnung zur Middleware-Konvention |
| SQLite `integrity_check` nach Korrektur | `ok` |

## Backup und Datenbilanz

Nach vollständigem Stoppen des lokalen Stacks wurde das gesamte Volume gemäß
Betriebsverfahren gesichert, inklusive SQLite und Storage. Lokale Sicherungen
liegen unter `backups/`, Verzeichnisrechte 0700, Dateien 0600:

- `pb_data-20260905-isolation-before.tar.gz`
- `env-20260905-isolation-before`
- `pb_data-20260905-isolation-after.tar.gz`

`/backups/` ist jetzt in `.gitignore`, damit Daten und Secrets nicht versehentlich
versioniert werden. Ein Restore wurde nicht durchgeführt.

Der finale Test legte 21 Records an und entfernte sie wieder: sechs Nutzer,
sechs Mitgliedschaften, zwei Kontakte, zwei Belege mit PNG, zwei Fahrten,
zwei synthetische USt-ID-Prüfschnappschüsse ohne Netzaufruf und einen über Next
hochgeladenen Beleg. Frühere Testläufe bereinigten ihre Records ebenfalls.
Vorhandene Firmen, Nutzer, Mitgliedschaften und Fachrecords blieben erhalten.

Der Vergleich des Vorher-/Nachher-Backups ergab 26 vollständig identische
Fach-/Nutzercollections. Nur `job_runs` wuchs von 727 auf 730 und `job_locks.holder`
änderte sich durch den laufenden Scheduler. Alle 38 vorhandenen Speicherdateien
waren per SHA-256 identisch; keine Datei fehlte oder kam hinzu. Diese Bilanz ist
ein Schnappschuss vor dem abschließenden Wiederstart; der Scheduler läuft weiter.
PB-Auth-/Request-Protokolle können durch die Tests zusätzlich gewachsen sein.

## Grenzen

Kein vollständiger Penetrationstest sämtlicher Next-Actions, Realtime-Protokolle,
SMTP-, BZSt- oder Exportabläufe. Die Prüfung steuert echte HTTP-Endpunkte und
servergerenderte Formulare, keinen interaktiven Browser. Bereits vorher
heruntergeladene Dateien lassen sich nicht zurückrufen. Lokale Schemaerweiterungen
brauchen eine eigene Zugriffsentscheidung. Superuser-Zugänge bleiben privilegiert;
die bestehenden Next-Firmenprüfungen bleiben deshalb erforderlich. Andere offene
Sicherheitsbefunde aus `docs/entwicklung.md` sind nicht Teil dieser Korrektur.
