# TP-022 Stufe 3: Kassenfestschreibung und Kassenstorno

Stand: 2026-09-07
Basis: `main` bei `5958caabbae98aba4ecc507d4e41c682c6636e0e`

## Ergebnis

TP-022 Stufe 3 ist lokal abgeschlossen. Kassenanlage, Festschreibung,
ursprüngliches Journal, Kassenbelegnummer, Rückverweis, Zeitpunkt und
Kassennummernkreis committen nun in einer festen PocketBase-Operation gemeinsam
oder gar nicht. Dasselbe gilt für Kassenstorno und Journal-Gegenbuchung. Der
Saldo wird im selben Transaktionsbestand geprüft und Firmenwrites werden vor
der Saldoentscheidung serialisiert.

Die beiden historischen roten Kassenfälle sind mit PocketBase 0.39.10 und den
echten Produktionshooks grün:

- Ein Fehler beim abschließenden Kassen-Link hinterlässt weder Journal noch
  Kassenrecord oder Zählerfortschritt.
- Von zwei konkurrierenden Auszahlungen über je 80,00 Euro bei 100,00 Euro
  Bestand wird genau eine abgelehnt; der Endsaldo beträgt 20,00 Euro.

Es wurde keine Migration und kein Unique-Index angelegt. Beleg- und
Rechnungsfestschreibung wurden nicht fachlich umgebaut.

Das vorhandene Kassenmodell besitzt kein eigenes Statusfeld. Ein Eintrag ist
durch Belegnummer, Festschreibungszeitpunkt und vollständigen Journalrückverweis
festgeschrieben. Für Stufe 3 wurde deshalb kein künstlicher Status und keine
Schemaänderung eingeführt.

## Ausgangsfehler und Writer-Inventur

Der frühere Anlagepfad in `cash/repository.ts` verteilte die Festschreibung auf
vier unabhängige Requests: Kassennummer vergeben, Kassenrecord anlegen,
Journalrecord anlegen und Journalrückverweis nachtragen. Der Saldo wurde davor
aus einem normalen Read berechnet. Dadurch konnte ein später Fehler frühere
Writes stehen lassen und zwei Auszahlungen konnten denselben alten Saldo sehen.

Der frühere Stornopfad schrieb zuerst die generische Journal-Gegenbuchung,
vergab danach eine Kassennummer und legte zuletzt den Kassenstornorecord an.
Auch diese Schritte hatten keine gemeinsame Commit-Grenze.

Die geprüften direkten und indirekten Pfade sind:

- Kassenanlage und Kassenstorno aus `cash/actions.ts` und
  `cash/repository.ts`;
- Storno eines Kassenjournals aus der Journal-Detailseite;
- generische Journalanlage und der Übergangs-Nummernkreiswriter;
- direkte generische PocketBase-CRUD-Aufrufe mit Superuser-Rechten;
- Saldo-, Listen- und Detailreads im Kassenmodul;
- Journal-, Reporting- und Exportreads.

Das bestehende Modell kennt keinen Kassenentwurf: Anlegen ist weiterhin
Festschreiben. Reporting und Exporte bleiben reine Leser. Manuelle Journale,
Zahlungsjournale, Bank-Matching und Rechnungsstorno behalten ihre bisherige
fachliche Grenze; Kassenjournale dürfen über diese generischen Writer nicht
mehr erzeugt, geändert oder gelöscht werden.

## Gewählte Transaktionsgrenze

`finanz.pb.js` stellt zwei superusergeschützte, feste Operationen bereit:

- `POST /internal/zettelruhe/finanz/v1/kasse/festschreiben`
- `POST /internal/zettelruhe/finanz/v1/kasse/stornieren`

Beide führen ihre persistenten Reads und Writes in `runInTransaction` gegen
denselben `txApp` aus. Die Anlage umfasst Firmen- und Mitgliedschaftsprüfung,
Beziehungs- und Eingabeprüfung, Nummernwahl und Zählerfortschritt,
Saldoentscheidung, Kassenrecord, ursprüngliches Journal, Rückverweis und
gemeinsamen Festschreibungszeitpunkt.

Das Storno bindet zusätzlich die vollständige erwartete Projektion des
Originalrecords, das ursprüngliche Journal sowie genau eine Gegenbuchung. Vor
Replay- und Saldoreads wird für die Firma der SQLite-Writer-Lock erworben. Ein
Storno am Tag des Originals erhält eine freie Record-ID hinter dem Original,
damit die bestehende chronologische Sortierung `datum,id` die Gegenbuchung
danach einordnet.

Die Record-Hooks erlauben Kassen- und zugehörige Journalwrites nur mit einem
eng begrenzten internen Transaktionskontext. Der Übergangsallocator lehnt den
Kassennummernkreis ab. Die Journal-Detailseite leitet ein Kassenstorno in die
neue Kassenoperation, statt den nun gesperrten generischen Journalwriter zu
verwenden.

## Replay und unbekannter Commit-Ausgang

Die Anlage verwendet eine 15-stellige, serverseitig erzeugte Record-ID als
dauerhaften Vorgangsschlüssel. Das Next-Formular trägt sie als verborgenes Feld
und behält sie bei einem Fehlerredirect. Ein identischer Replay gibt den
vorhandenen vollständigen Abschluss zurück und verbraucht weder Nummer noch
Journalnummer ein zweites Mal.

Für das Storno ist das Original die eindeutige Quelle. Existierende Kassen- und
Journalgegenbuchung müssen vollständig zusammenpassen; dann wird derselbe
Abschluss als Replay zurückgegeben. Ein Teilzustand ist ein Konsistenzfehler und
wird nicht ergänzt.

Bei Netzwerkfehlern oder unlesbarer Erfolgsantwort wiederholt der Adapter genau
einmal denselben serialisierten Request-Body. Tests vergleichen beide Bodies
bytegleich. Nach einem zweiten unbekannten Ausgang wird `COMMIT_UNKNOWN`
geliefert. Ein anderer Quellstand oder eine andere erwartete Projektion ergibt
`SOURCE_CHANGED` und wird nicht überschrieben.

## Garantien und Grenzen

Garantiert sind innerhalb der PocketBase-Datenbank:

- vollständiger Kassenabschluss oder vollständiger Rollback an jeder
  relevanten Write-Grenze;
- vollständiges Kassenstorno oder vollständiger Rollback;
- genau ein Abschluss je Anlage-Vorgang und genau ein Storno je Original;
- Saldoentscheidung aus demselben serialisierten Transaktionsbestand;
- keine gemeinsam erfolgreiche Auszahlungskombination mit negativem
  chronologischem Saldo;
- frische Firmen-, Mitgliedschafts-, Rollen-, Kontakt-, Kategorie- und
  Journalrelationen in der Transaktion;
- Überspringen belegter Kassennummern bei zurückliegendem Zähler;
- Schutz der Kassenrecords, Kassenjournale und zugehörigen Stornojournale vor
  generischen Superuser-Writes.

Nicht garantiert oder nicht verändert sind:

- automatische Reparatur bereits vorhandener inkonsistenter Produktivdaten;
- Atomarität für Zahlungen, Bank-Matching oder Rechnungsstorno;
- externe Seiteneffekte außerhalb der PocketBase-Datenbank;
- automatische Wiederholung mit einer neuen Quelle oder geänderter Projektion;
- produktiver Bestand, Test-VPS oder Produktivdeployment in dieser Session.

## Verifikation

Der sichere Starter `scripts/test-festschreibung-isolated.mjs` prüft vor dem
Start der Tests einen leeren Bestand, nutzt PocketBase 0.39.10, echte
Produktionshooks, ein eigenes Loopback-Portmapping und `tmpfs` für `/pb_data`.
Die Fehlerinjektionen existieren nur im Testcontainer. Container und Daten
werden anschließend entfernt.

- gezielte Kassen-Akzeptanz: 27 von 27 Tests bestanden;
- historische Charakterisierung: 42 von 42 Tests bestanden, einschließlich
  der beiden zuvor erwarteten Kassenfehler;
- vollständige isolierte Finanzintegration: 141 von 141 Tests bestanden
  (Beleg, Rechnung, Kasse und historische Regression);
- betroffene Kasse-, Journal-, Zahlungs-, Reporting- und Exportmodule:
  170 von 170 Tests bestanden;
- vollständige Vitest-Suite: 631 Tests bestanden, 141 sichere
  Integrationstests ohne Starter übersprungen;
- zusätzlicher Finanztransport: 14 von 14 Tests bestanden;
- Konfigurations- und Platzhaltererkennung: 3 von 3 Tests bestanden;
- TypeScript, Syntaxprüfung der geänderten Hooks und Fixtures, gezieltes ESLint
  und `git diff --check`: bestanden.

Der erste parallele Gesamtlauf hatte zwei Kollisionen identischer synthetischer
Firmennamen zwischen Testdateien. Die Tests wurden auf suitespezifische Namen
begrenzt; der unveränderte Fachlauf bestand danach mit 141 von 141 Tests.

Vitest meldet weiterhin den bekannten Hinweis zur zukünftigen nativen
Konfigurationsladung. Der Next-Build meldet weiterhin die veraltete
`middleware`-Konvention. Beides bestand bereits vor Stufe 3.

## Deploymentnaher lokaler Docker-Smoke

`docker compose build --pull --no-cache next pocketbase` baute den aktuellen
Worktree erfolgreich:

- Next: `sha256:5862def4f0adea387fb4fa5c2e3432f464f0c50a44c9694758a7a9368744e109`
- PocketBase: `sha256:70733bdbd89c624fc0625bea0140a8d3e529a4bbe084e02a254474acb5c9eece`
- Image-Metadaten: jeweils `arm64`
- PocketBase: 0.39.10
- `finanz.js`: `c1399ec00a259aa34401e845fb8bdd96f477b3179575905fa140da2230cdb0d7`
- `finanz.pb.js`: `d101a33c3b1440f5eaaf61a16a09c72236911c3ec41f6f1356a3a16f267734e8`

Die Hook-Hashes im Image und im Worktree waren bytegleich. Ein eigener
Smoke-Stack nutzte ein getrenntes Netz, zufällige synthetische Zugangsdaten,
einen Loopback-Port und leeres `tmpfs`; das vorhandene
`zettelruhe_pb_data` war nicht eingebunden.

Über die echten Next-Routen wurden Firma und Sitzung angelegt, eine Bareinnahme
festgeschrieben, derselbe Anlage-Request wiederholt, das Kassenstorno ausgeführt
und derselbe Storno-Request wiederholt. Das Ergebnis waren genau zwei
Kassenrecords und zwei Journalrecords, `K-0001` und `K-0002`, Kassen-Zähler 3,
Saldo 0,00, passende Original-/Stornorückverweise und je Paar derselbe
Festschreibungszeitpunkt. Ein direkter Superuser-Updateversuch lieferte HTTP 400
mit `MUTATION_FORBIDDEN`; der Record blieb unverändert. Next und PocketBase
zeigten keine Laufzeitfehler.

Der Smoke-Stack samt Netz und `tmpfs` wurde entfernt. Der vorhandene lokale
Standard-Stack blieb durchgehend gesund und lief danach weiterhin auf seinen
vorherigen Container-Images. Sein persistentes Volume wurde nicht gelesen oder
verändert.

## Separater Sicherheitsbefund: Superuser-Platzhalter

Die `/health`-Warnung verwendet in `app/src/lib/env.ts` eine kleingeschriebene
Teilstring-Prüfung auf bekannte Beispielmuster. `.env.example` enthält Werte,
die diese Regel bewusst auslösen. Compose reicht dieselben Variablen an Next
und PocketBase weiter; der PocketBase-Entrypoint verwendet sie für den
Superuser-Upsert. Eine erfolgreiche Authentifizierung widerlegt die Warnung
daher nicht.

Für den im separaten lokalen Read-only-Bericht dokumentierten Serverstand ist
die Warnung ein echter Sicherheitsbefund: Beide konfigurierten Werte stimmen
laut dessen boolescher Prüfung exakt mit den versionierten Beispielwerten
überein. Zugangsdaten wurden weder ausgegeben noch in Tests übernommen oder
verändert.

Die Heuristik kann unabhängig davon Fehlalarme erzeugen, wenn ein ansonsten
anderer Wert nur eines der bekannten Fragmente enthält, und sie erkennt keine
schwachen Werte ohne diese Fragmente. Der Health-Endpunkt veröffentlicht nur
den festen Warntext, keine Werte. Weil für den dokumentierten Fall kein
Fehlalarm vorliegt, wurde die Warnlogik nicht geändert. Ob der Server seit dem
Bericht geändert wurde, ist ohne einen separat freigegebenen read-only
Serverauftrag nicht entscheidbar. Eine Rotation wurde nicht durchgeführt und
muss als eigener Sicherheitsvorgang geplant, geprüft und dokumentiert werden.

## Freigabe

- **Commit:** fachlich und technisch Go; Commit und Push wurden nicht
  ausgeführt.
- **Test-VPS:** Go nach Commitfreigabe, mit frischem Build beider Images und
  isoliertem Kassen-Smoke.
- **Produktivdeployment:** in dieser Session No-Go. Vorher sind Test-VPS,
  Backup und ein read-only Audit des echten Kassenbestands auf negative
  Zwischenstände, Nummerndubletten, zurückliegende Zähler, unvollständige
  Original-/Stornopaare, falsche Firmenbezüge und Journalrückverweise nötig.
- **Superuser-Sicherheit:** getrennt vom fachlichen Kassen-Go. Für den
  dokumentierten Platzhalterzustand besteht No-Go bis zu einer ausdrücklich
  beauftragten Rotation und anschließenden read-only Verifikation.
