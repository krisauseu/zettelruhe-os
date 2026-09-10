# Lokale Vorbereitung des Open-Source-Releases

Datum: 2026-09-10. Ausgangspunkt und tatsächlicher HEAD: `f48be21` auf `main`.
Geprüft wurde der danach geänderte lokale Arbeitsbaum, kein neuer Releasecommit.
Die vorhandenen Audit-Dokumentationsänderungen wurden erhalten und auf den
implementierten Stand gebracht. Die schon zuvor vorhandene Löschung von
`docs/Bericht_Test_VPS_06092026` zählt nicht zum Umfang dieser Releaseänderung.

## Empfehlung

**Zur stabilen Veröffentlichung bereit.** Die beauftragten lokalen Korrekturen
und technischen Prüfungen sind abgeschlossen. R-01 ist erledigt: Der Betreiber
hat `krisauseu/zettelruhe-os` mit einem bereinigten Initial-Commit angelegt und
lokales Projekt, Test-VPS und Produktion umgestellt. Die frühere öffentliche
Historie wird für diesen Release nicht fortgeführt. [Materialbefund](release-materialpruefung-2026-09-10.md).
Der Release `v1.0.0` markiert diesen Stand. Der veröffentlichungsfertige Text
steht im [CHANGELOG](../../CHANGELOG.md).

Im Vorgänger-Repository wurde GitHub lesend geprüft: Repository öffentlich,
keine offenen Issues und kein GitHub-Release. PR #1 „chore: Auto-Deploy
(update.sh + Actions-Vorlage)“ wurde weder übernommen noch geändert. Der dortige
Tag `meilenstein-2` gehört nicht zum neuen Repository-Verlauf.
Die frühere ELSTER-Prüfsperre bleibt verworfen. RC ist laut Betreiber bereits
produktiv getestet und live; daraus wird keine Produktionsabnahme der heutigen
neuen Finanzkorrekturen abgeleitet.

## R-01 bis R-12

| Kandidat | Ergebnis |
|---|---|
| R-01 Arbeitsmaterialien | Konto-/Transaktionsdaten im Vorgänger-Repository bestätigt; aktuelle Dateien entfernt, synthetische MT940-Fixture mit Parsertest. Der neue Repository-Verlauf beginnt mit bereinigtem Initial-Commit und wird für den Release verwendet. Keine vertraulichen Werte im Bericht. |
| R-02 Lint und Donut | Beide Fehler reproduziert und korrigiert. Segmente ohne mutiertes `offset`; Monats-/Quartalswerte und Tastaturfokus visuell geprüft. Zusätzlich SVG-Titel im Donut und Monatsverlauf korrigiert: Serverrender lieferte leere Titel und verursachte React-Hydrierungsfehler. Renderreproduktion zuerst rot, nach Korrektur grün; finaler Browser ohne Konsolenfehler. |
| R-03 Scheduler und Wiederholung | Übernahme einer abgelaufenen Lease ist atomar; derselbe Holder kann eine aktive Lease nicht erneut erwerben. Veraltete Freigabe kann neue Lease nicht löschen. Eigene Tick-ID und Überlappungsschutz. Entwurf, Positionen und Datumsfortschritt committen zusammen; Fehler beim Vorlagenfortschritt rollt den Entwurf zurück. |
| R-04 Seitenlimits | Firma 51 und Vorlage 201 in gezielten Runner-/Repositorytests erreicht. Alle Seiten werden vor der Erzeugung eingesammelt, sodass das Schrumpfen der Fälligkeitsliste keine nächste Seite überspringt. Die bisherigen 50/200 sind nur noch Seitengrößen. |
| R-05 Finanzfälle | Reproduzierte Doppelzuordnung, Überzahlung, verlorene/inkonsistente Löschzustände und doppelte Stornos gezielt korrigiert. Zahlung/Staffeljournal/Status, Bankmatch und Rechnungsstorno verwenden feste PB-Transaktionen samt Schreibschutz. Fehler-/Replay-/Paralleltests unten. |
| R-06 RC-Bedienung | Vorschläge bleiben ausdrücklich übernehmbar/übersteuerbar; voller Abzug unter Regelbesteuerung und ausgeschlossener Abzug unter §19 bleiben erhalten. Anzeige verwendet Decimal statt binärer Subtraktion. Gespeicherte RC-Kernberechnung war nicht als falsch bestätigt. |
| R-07 Exporte | Bestehende Pagination-/Dateifehlertests bestehen. DATEV-RC-Ablehnung und 256-MiB-Grenze sind Produktgrenzen. Kein Streaming oder DATEV-RC-Ausbau. |
| R-08 Steuer-/E-Rechnungsumfang | 2026, Monat/Quartal, XML-Self-File, ZM-Kandidaten und EÜR light klar in Release Notes. Kein neuer ELSTER-/Zertifizierungsvorbehalt. Kein Hybrid-PDF/A-3. |
| R-09 Installation/Upgrade | Leere Dockerinstanz eingerichtet; synthetischer Altbestand mit Hooks/Migrationen von `f48be21` offline gesichert und in eigenem Volume wiederhergestellt. Records und Datei-SHA-256 identisch. linux/amd64-PB; kein ARM-Nativnachweis. |
| R-10 Betrieb | Health-JSON, feste Session-TTL, schreibende Nachzüge bei GET und fest benanntes Compose-Volume dokumentiert. Keine Cloud-Betriebsarchitektur eingeführt. |
| R-11 Wartung | Sechs ESLint-Warnungen behoben: ungenutzte Ausnahmen/Importe und Verwechslung von react-pdf-Image mit HTML-Image. CI, CONTRIBUTING, SECURITY, App-Einstieg und Release Notes ergänzt. Vite-Hinweis auf künftigen Konfigurationsloader, Next-Middleware-Abkündigung und Google-Fonts-Buildabhängigkeit bleiben eingeordnet. |
| R-12 Nachvollziehbarkeit | Diese datierte Abnahme nennt Basis, Prüfungen und Grenzen. `v1.0.0` markiert den bereinigten Release-Commit; keine erfundenen VPS-Nachweise. |

## Bestätigte Fehler und Regressionen

Ein separater temporärer Checkout aus `git archive f48be21` bekam die ersten acht
neuen Releasefälle mit synthetischen Fixtures. Alle acht schlugen auf der Basis
fehl; die übrigen 180 Finanz-/RC-Tests bestanden. Damit wurde nicht bloß aus
fehlenden Transaktionen auf einen Fehler geschlossen. Die Fälle zeigten:

- zwei erfolgreiche Übernahmen derselben abgelaufenen Lease sowie erneuten Erwerb
  durch denselben Holder;
- einen weiteren Entwurf nach Fehler zwischen Entwurfsanlage und Datumsvorschub
  sowie zwei Entwürfe bei paralleler Erzeugung derselben Fälligkeit;
- eine zweite Zahlung nach fehlgeschlagenem Speichern der Bankverknüpfung und Replay;
- zwei gleichzeitig akzeptierte Zahlungen über dem offenen Rechnungsbetrag;
- beim fehlgeschlagenen Löschen Gegenbuchung bei weiterhin vorhandener Zahlung;
- mehrfach erzeugte Gegenbuchungen bei parallelem Rechnungsstorno.

`app/src/lib/release-risiken.integration.test.ts` umfasst jetzt 15 echte PB-Fälle.
Zusätzlich zur Basisreproduktion prüfen testlokale Hooks den Abbruch beim
Vorlagenfortschritt, Banklink, Zahlungsdelete, Rechnungsendstatus und der zweiten
Steuerstaffel. Jeder Fehlschlag muss den gesamten Vorgang zurückrollen. Weitere
Fälle prüfen verlorene Commitantworten mit gleicher Vorgangs-ID, abweichenden
Replayinhalt, Bankfreigabe beim Zahlungslöschen, Zahlung gegen Storno und den
blockierten veralteten Status-PATCH. Nach zwei Teilzahlungen mit 7-/19-Prozent-
Staffeln müssen Betrag und Steuer genau zum Rechnungsrest passen.

Produktionscode verwendet dafür die vorhandene PB-Transaktionsgrenze in
`pocketbase/pb_hooks/finanz.js`; kein zusätzlicher Schedulerdienst und kein neues
Schema. Die Geld-/Zahlungs-/Journal-/Verkaufs-/Wiederkehrregeln werden aus ihren
bestehenden TypeScript-Dateien in `pb_hooks/domain/` generiert. Die Fehlereinspieler
unter `scripts/fixtures/pb-release/` werden ausschließlich im Teststarter gemountet.

## Ausgeführte Prüfungen

Umgebung: macOS/Apple Silicon, lokale Node-Version 25.9.0; Docker über OrbStack,
Next-Produktionsimage mit Node 22 Alpine, PocketBase 0.39.10 (linux/amd64).
Sämtliche neuen Datenbanken und Dateien sind synthetisch und temporär. Keine
vorhandenen Datenvolumes oder Backups wurden gelesen oder geändert. Das Starten
von OrbStack startete auch vorhandene Container automatisch; diese waren keine
Prüfziele. Kein Zugriff auf Produktions- oder Test-VPS.

| Prüfung am 2026-09-10 | Ergebnis und Aussagekraft |
|---|---|
| `cd app && npm test` | 739 bestanden, Vitest meldet 160 übersprungene Tests und sechs übersprungene Integrationsdateien. Keine DB-Abnahme aus diesem Kommando abgeleitet. |
| `cd app && npm run typecheck` | Route-Typen erzeugt; `tsc --noEmit --incremental false` bestanden. |
| `cd app && npm run lint -- --max-warnings 0` | Bestanden, keine Fehler oder Warnungen. |
| `node scripts/build-rc-hook.mjs --check` und `node scripts/build-finanz-domain-hook.mjs --check` | Beide generierten Regelstände stimmen mit der Quelle überein. |
| `TP022_PB_IMAGE=zettelruhe-release-pb:20260910 node scripts/test-festschreibung-isolated.mjs` | 195/195 echte Finanz-/RC-Integrationstests in sechs Dateien bestanden. Neue PB mit tmpfs, dynamischem Loopbackport und eigenen Zugangsdaten; anschließend entfernt. |
| Dockerbuild von Next und PB | Bestanden. Quellkopie ohne echte `.env`, Daten oder lokale `.next`/`node_modules`; Abhängigkeiten über Docker-`npm ci`. Google-Fonts-Abruf erfolgreich. Next warnt weiterhin zur Middleware-Konvention. |
| `node scripts/test-release-smoke-isolated.mjs --keep` | Finaler Lauf: leere Instanz, Migrationen, Health-JSON `ok:true`, Setup, synthetische Eigentümerin/Firma und Anmeldung bestanden. |
| Offline-Upgrade/Restore im selben Starter | Basis `f48be21`, eigener synthetischer Beleg mit Dateianhang/Journal. Firmen, User, Mitgliedschaft, Beleg und Journal identisch; Datei-SHA-256 identisch; Anmeldung, Dashboard, Belege und Journal nach Restore erreichbar. Kein echter Altbestand getestet. |
| Finale Exportaufrufe (authentifizierte HTTP-Session) | DATEV für RC-Zeitraum HTTP 400; Journal-CSV HTTP 200 mit `eu_dienstleistung`; UStVA-XML HTTP 200 mit Kz47 = 7,98; ZIP HTTP 200 mit gültiger ZIP-Kennung. Nur synthetischer Septemberbestand. |
| Gezielte Browserregression | Donut Monat/Quartal, korrekte 2/3-/1/3-Segmente, Fokus, Hell/Dunkel und leere Firma; Diagramm-Hydrierung ohne Konsolenfehler im finalen Produktionsimage. Rechnung festschreiben, Teilzahlung und Storno auch im finalen Image erfolgreich. Bankmatch und RC-Ablauf siehe unten. |

Finale lokale Image-IDs (keine veröffentlichten Images):

- Next `sha256:cebc44c68bb3c167413f2308d7c2ce24607d7c47b7bffd2b85bc40f87303d35c`
- PB `sha256:89ea17d1ef47bd9ebb981b60309ae258c287bc7c2ed42618405321de134c2682`

Die erste synthetische Browserinstanz bestätigte: EU-Lieferantenvorschlag bewusst
übernehmen, Beleg über 42 EUR vollständig bezahlen, speichern, erneut laden und
festschreiben; Steuerschuld und voller Abzug jeweils 7,98 EUR, UStVA 46/47/67 passend.
Eine Rechnung über 119 EUR erhielt eine manuelle Zahlung von 40 EUR und einen
bestätigten Bankmatch von 40 EUR; offen blieben 39 EUR. Storno lieferte genau je
eine Gegenbuchung für Forderung und beide Zahlungen. In der Diagnoseinstanz wurden
§19, ausgeschlossener Abzug und der Hinweis für Teil-/Mehrfachzahlungen geprüft.
EU-RC-Erfassung mit null Rechnungs-USt, Speichern, Festschreibung und den Werten
42,00 / 7,98 / 7,98 / 0,00 EUR wurde auch im finalen Produktionsimage wiederholt;
die Browserkonsole blieb leer. Die finalen Hookänderungen bestehen zusätzlich
sämtliche 195 Integrationstests.

## Risiken und bewusst unterstützte Grenzen

Die feste Lease kann nach fünf Minuten während eines noch laufenden Ticks
übernommen werden. Der Fälligkeitsvergleich in der Transaktion verhindert die
zweite Erzeugung derselben Periode; Joblaufzähler sind keine Exactly-once-
Abrechnungsstatistik. Maximal zwölf Nachholperioden pro Vorlage/Aufruf bleiben
bewusst bestehen. Gleichzeitige Vorlagenbearbeitung mit separatem Positionsersatz
und Erzeugung wurde nicht als atomarer Snapshot zugesichert; Vorlagen während
der Bearbeitung pausieren. Das ist ein verbleibendes Risiko, kein hier neu
reproduzierter Produktionsschaden.

Die Tests belegen definierte Fehler- und Parallelfälle, keine Stromausfallgarantie
zwischen SQLite und Dateisystem und keine Fehlerfreiheit sämtlicher Altbestände.
Ein automatischer Zahlungsjournalnachzug bleibt bei Leseaufrufen möglich. Er
repariert fehlende Journale pro Rechnung atomar, meldet erkannte Teiljournale aber
nur als Fehler; historische Inkonsistenzen brauchen eine gesonderte Datenprüfung.
Ein Bankmatch wird nach bewusstem Löschen der Zahlung wieder möglich; es gibt
keine unveränderbare Historie aller bankseitigen Zuordnungsversuche.

Produktgrenzen vollständig in [CHANGELOG](../../CHANGELOG.md): RC-Einzelfall/EUR/
Vollzahlung, DATEV-RC-Ablehnung, ZIP im Speicher, Steuerjahr 2026, XML ohne Versand,
ZM/EÜR light, keine automatischen Bar-Kassenbuchduplikate, keine eigene
Stornorechnung, offene-Posten-Liste höchstens 500 Rechnungen je Status und die
bekannten Session-/Health-/Architekturgrenzen.

Nicht ausgeführt: kompletter erneuter M1-/M2-Durchlauf, alle Browser/Endgeräte,
SMTP-/BZSt-Liveaufrufe, amtlicher XML-Import, Caddy/TLS- und VPS-Abnahme,
ARM-Nativbetrieb, Restore echter Backups, Stromausfall-/Lasttest und vollständiger
Geheimnisaudit sämtlicher historischer Commits/Forks. GitHub-CI ist vorbereitet,
aber vor Push noch nicht dort gelaufen. Keiner dieser übersprungenen externen
Schritte ist eine neue ELSTER-Freigabesicherung.

Codegraph wurde zu Beginn und nach den Änderungen verwendet und aktualisiert.
Die abschließende gezielte Auswirkungsanalyse für Zahlung/Journal zeigte 27 direkt
betroffene Dateien bei einem Schritt; deshalb wurde die vollständige Finanz-/RC-
Suite statt nur der neuen Fälle ausgeführt. Markdown-Dateiverweise und
`git diff --check` sind abschließend ohne Befund.

## Dateiumfang und nächste Freigabe

Geändert sind die verantwortlichen Module `jobs`, `sales`, `payments`, `banking`,
`journal`, die Finanz-HTTP-Grenze und PB-Hooks samt Generator; kleine Korrekturen
in `reporting`, `expenses/rc-details`, `einvoice/parse-pdf-xml`, `platform/firma-write`
und `sales/pdf`. Regressionen liegen bei den Modulen und in den Finanztests.
Die beiden isolierten Starter und der Browser-Fixturegenerator machen lokale
Abnahmen wiederholbar. Neue Beiträge-/Sicherheitsdateien, CI und Release Notes
vervollständigen den Wartungseinstieg.

Dokumentationspflege: README, App-README, Entwicklung, Betrieb, Status, Roadmap,
Testphase, Verfahrensvorlage, RC-Referenz, Release-/Cloud-Plan, Dokumentationsindex,
Materialbericht und diese Abnahme; historische Asset-Verweise in zwei Testberichten
sind gekennzeichnet. Bereits vorhandene Änderungen an AGENTS, CONTEXT und ADRs
bleiben erhalten. Ein pauschales `git add -A` wäre ungeeignet.

Der Release nutzt das neue bereinigte Repository. Er ersetzt keine zusätzlichen
VPS-Abnahmen und eröffnet keinen Implementierungsauftrag für OCR, Briefpapier,
Stripe-Abos oder Managed Hosting im Kern.
