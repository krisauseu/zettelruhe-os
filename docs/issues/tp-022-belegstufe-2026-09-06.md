# TP-022: Abnahme der Belegstufe

Stand: 2026-09-06. Diese Umsetzung betrifft ausschließlich die
Belegfestschreibung. Rechnungsfestschreibung, PDF-Transaktionslogik,
Kassenanlage und Kassenstorno wurden nicht umgebaut.

## Ergebnis

Die Belegfestschreibung verwendet eine feste, nur für PocketBase-Superuser
erreichbare interne Operation. PocketBase liest Firma, Akteur, Mitgliedschaft,
Beleg, Beziehungen, Nummernkreise und vorhandene ursprüngliche Journalquellen im
Callback von `runInTransaction`. Nummernkreisänderung, Journalanlage und
Belegabschluss werden über dieselbe transaktionale App gespeichert.

Ein vollständig konsistenter Abschluss liefert bei Wiederholung dieselben IDs,
Nummern und denselben Festschreibungszeitpunkt mit `result=replayed`. Ein
unvollständiger Altzustand liefert `INCONSISTENT_STATE` und wird nicht repariert.
Der Next-Adapter wiederholt einen unbekannten Commit-Ausgang höchstens einmal mit
derselben Beleg-ID, demselben Akteur und derselben erwarteten Projektion.

Beleg-Update, Löschen sowie Hinzufügen und Entfernen von Dateien verwenden eine
eigene transaktionale Entwurfsoperation. Record-Hooks akzeptieren geschützte
Beleg- und ursprüngliche Journalmutationen nur mit einem intern erzeugten,
transaktionsgebundenen Kontext. Ein Request kann diesen Kontext weder über Body
noch Header setzen. Der separate PB-0.39.10-Nachweis bestätigt die Hook-Abdeckung
auch für `SaveNoValidate` bei Relationseffekten und für Cascade-Deletes.

Die bisherigen Angebots-, Rechnungs-, Kassen- und Kontakt-Allocatoren verwenden
für ihren Zählerwrite vorübergehend eine serialisierte PocketBase-Operation.
Dadurch überschreiben sie keine parallelen Änderungen anderer Kreise. Ihre
Dokumentabläufe sind damit noch nicht atomar. Firmeneinstellungen übertragen nur
geänderte Kreise mit dem erwarteten vorherigen Stand; allgemeines Firmen-CRUD darf
das komplette Nummernkreis-JSON nicht ersetzen.

Auch die Journalnummer bestehender Nicht-Beleg-Pfade wird beim Create innerhalb
einer kurzen PocketBase-Transaktion frisch bestimmt. Zahlungsstaffeln und Stornos
bleiben als mehrere zulässige Zeilen erhalten. Ihre gesamten Fachvorgänge sind
nicht Teil dieser Stufe.

## Schema und Audit

Es gibt keine Migration und keinen neuen Unique-Index. Historische Migrationen
blieben unverändert.

Der isolierte Read-only-Audit auf synthetischem Bestand erkennt zwei ursprüngliche
Belegjournalzeilen derselben Quelle. Die Belegoperation verweigert diesen Bestand
ohne Datenänderung. Produktivdaten wurden nicht gelesen oder verändert. Ein
Read-only-Produktionsaudit bleibt vor dem Produktivdeployment offen. Bei einem
Treffer gibt es keine automatische Bereinigung; der Bestand muss zuerst fachlich
bewertet werden.

## Verifikation

- `node scripts/test-festschreibung-isolated.mjs`: 29 von 29 Beleg-Akzeptanztests
  gegen PocketBase 0.39.10 und die echten Produktionshooks bestanden.
- Die vier Fehlerinjektionen `INJECT_AFTER_COUNTER`, `INJECT_JOURNAL_CREATE`,
  `INJECT_AFTER_JOURNAL` und `INJECT_SOURCE_SAVE` wurden in beiden identischen
  Retry-Versuchen in der jeweiligen Hook-Antwort nachgewiesen. Nach jedem Fehler
  entsprach der Datenbankzustand exakt dem Ausgangszustand.
- Fehler nach erfolgreichem Commit und verlorener Antwort lieferte beim Retry die
  ursprüngliche Quittung. Nummernkreis und Journal wurden je einmal verändert.
- Zwei parallele Abschlüsse desselben Belegs ergaben einen Commit und ein Replay.
  Zwei verschiedene Belege erhielten verschiedene Beleg- und Journalnummern.
- Parallele Entwurfsupdates, Deletes und Dateiänderungen konnten keinen
  festgeschriebenen Zustand überschreiben. Entweder gewann die Entwurfsmutation
  vollständig oder der Abschluss vollständig.
- Vollständiger Abschluss, unvollständige Altzustände, verwaistes Journal,
  Firmenisolation, Lese-Rolle, gelöschter Akteur, entzogene Mitgliedschaft,
  firmenfremde Beziehung, Kategorie-Richtung, direkter interner Routenzugriff,
  generisches Superuser-CRUD, Relationseffekte und bestehender Dateischutz wurden
  geprüft.
- Betroffene Modul- und Lib-Tests: 319 bestanden.
- Vollständige Vitest-Suite: 629 bestanden, 72 übersprungen. Die übersprungenen
  Fälle sind die isolierten Integrationen ohne ihren sicheren Starter.
- TypeScript mit `--noEmit --incremental false`: bestanden.
- Gezieltes ESLint für geänderte Next-Dateien: bestanden.

## Reproduzierte frühere Fehler

| Früherer Fehler | Ergebnis der Belegstufe |
|---|---|
| Zähler bleibt nach späterem Fehler erhöht | Transaktionsrollback, Zähler unverändert |
| Journal bleibt ohne abgeschlossenen Beleg | Transaktionsrollback, kein Journal |
| Zwei Abschlüsse erzeugen zwei ursprüngliche Journale | Ein Commit und eine identische Replay-Quittung |
| Verlorene Erfolgsantwort verbraucht eine weitere Nummer | Retry erkennt den ersten Commit |
| Zwei Belege erhalten konkurrierend denselben Kandidaten | Verschiedene endgültige Nummern |
| Alter Entwurfswriter überschreibt den Abschluss | Persistenzgrenze lässt nur einen vollständigen Gewinner zu |
| Alter JSON-Writer verliert einen anderen Zähler | Frischer transaktionaler Stand, nur betroffener Kreis geändert |
| Verwaistes Journal wird durch eine zweite Buchung ergänzt | Konsistenzfehler ohne Reparatur |

## Deploymentnaher lokaler Docker-Smoke-Test

Am 2026-09-06 wurden Next und PocketBase aus dem aktuellen, nicht vollständig
committeten Worktree mit `--pull --no-cache` neu gebaut. Compose löste dafür
`app/` mit `app/Dockerfile` und `pocketbase/` mit `pocketbase/Dockerfile` als
Build-Kontexte auf. `app/.dockerignore` schließt die TP-022-Quellen nicht aus.
Das PocketBase-Dockerfile kopiert `pb_hooks` nach `/pb/pb_hooks`.

Die geprüften Images waren:

- `zettelruhe-next`, Image-ID `5188b803718c`
- `zettelruhe-pocketbase`, Image-ID `deec2fbe3a1e`

Das PocketBase-Binary meldete Version 0.39.10. Die SHA-256-Werte von
`finanz.js` und `finanz.pb.js` im Image stimmten bytegenau mit dem Worktree
überein. Das finale Next-Standalone-Bundle enthielt die interne Finanzroute und
den neuen Fehlerpfad für eine fehlende Operation. Der Request-Log des ersten
Abschlusses zeigte genau einen POST auf
`/internal/zettelruhe/finanz/v1/beleg/festschreiben` und keinen direkten POST
auf `buchungsjournal`.

Der Smoke-Test lief zuerst mit einem eigenen Compose-Projekt und einem frischen,
getrennten Volume. Der produktive Next-Pfad über Caddy legte einen Beleg an,
lud ihn neu, änderte seine Metadaten und lud die Änderung erneut. Eine PDF wurde
hochgeladen, über die geschützte Next-Route bytegleich heruntergeladen und über
die anonyme PocketBase-Dateiroute mit HTTP 404 abgewiesen.

Der erste Abschluss erhielt `B-0001` und Journalnummer 1. Beleg und Journal
verwiesen aufeinander und hatten denselben Festschreibungszeitpunkt. Der
Belegnummernkreis stieg einmal von 1 auf 2. Der identische zweite Aufruf lieferte
`result=replayed` mit derselben Belegnummer, Journal-ID, Journalnummer und
demselben Zeitpunkt. Der Zähler blieb 2 und es entstand kein weiteres Journal.

Veraltete Next-Formulare wiesen Metadatenänderung, Löschen und Datei-Upload am
festgeschriebenen Beleg ab. Direkte Superuser-Versuche für Metadaten, Löschen
sowie Datei hinzufügen, ersetzen und entfernen antworteten jeweils mit HTTP 400
und `MUTATION_FORBIDDEN`. Der Beleg blieb unverändert. Ein zweiter Beleg erhielt
`B-0002` und Journalnummer 2; der Belegnummernkreis stand danach auf 3.

Die Bilanz des isolierten Testbestands bestand aus zwei festgeschriebenen
Belegen und zwei ursprünglichen Belegjournalen. Es gab keine Entwürfe, keine
verwaisten Journale, keine doppelten ursprünglichen Quellen und keine
Teilzustände. In 168 PocketBase-Requests gab es keinen 500er. Die fünf 400er,
der 401er und der 404er waren die absichtlich ausgeführten Schutzprüfungen.
PocketBase und Next meldeten keine Hook-, Syntax- oder Laufzeitfehler.

Nach dem Test wurde das synthetische Volume entfernt. Anschließend wurden exakt
die beiden geprüften Image-IDs unter den normalen Compose-Tags gestartet. Der
lokale Standard-Stack ist gesund und verwendet weiterhin sein vorhandenes
`zettelruhe_pb_data`. Ein erneuter Read-only-Check dieses lokalen Bestands ergab
zwei Firmen, vier Belege, 18 Journalzeilen und ein ursprüngliches Belegjournal.
Es gab keine verwaisten Journale, doppelten ursprünglichen Quellen,
Teilzustände oder doppelten Beleg- und Journalnummern. Der bereits bekannte
festgeschriebene Beleg ohne Datei blieb technisch konsistent. Belege ohne Datei
sind im Schema zulässig.

Die lokale Umgebung warnte erwartungsgemäß vor HTTP ohne Secure-Cookie und vor
den lokalen Platzhalter-Zugangsdaten. Caddy meldete redundante `header_up`-Zeilen
sowie übersprungenes HTTP/2 und HTTP/3 ohne TLS. Diese Hinweise sind für den
lokalen HTTP-Stack erwartbar. Der Next-Build warnte außerdem weiter vor der
veralteten `middleware`-Konvention. Der lokale Docker-Host erzeugte Images mit
ARM64-Metadaten, während das PocketBase-Dockerfile weiterhin das fest
eingestellte AMD64-Binary lädt. Die lokale Runtime führte dieses Binary aus;
eine Aussage zur Architektur des VPS folgt daraus nicht.

## Grenzen und Freigabe

Die zugesagte Atomarität gilt für PocketBases Datenbank. Bereits am Beleg
gespeicherte Dateien werden in der Festschreibung nicht verändert. Bei
Entwurfsuploads bleibt die dokumentierte Grenze bestehen, dass Datenbank und
Dateisystem keine gemeinsame ACID-Transaktion bilden; PocketBase versucht bei
Rollback die neue Datei zu entfernen, kann bei zusätzlichem Dateisystemfehler aber
eine unreferenzierte Restdatei hinterlassen.

Für Stufe 2, Rechnung, lautet das Ergebnis **Go zur Umsetzung**. Die Belegstufe
weist Transaktionskontext, Replay, Nummernkreis-Serialisierung und die nötigen
Record-Hooks unter PB 0.39.10 nach. Die Rechnungsstufe muss weiterhin PDF-Kandidat,
vollständige Positionsprojektion, Dateiablage und ihre eigenen Fehlergrenzen
implementieren und testen.

Für Commit und Push der Belegstufe lautet das Ergebnis **Go**. Der gemeinsame
Image-Rebuild und der lokale Smoke-Test von Next und PocketBase mit geladenen
Hooks sind bestanden.

Für das anschließende Deployment auf die VPS-Test- oder Produktivumgebung lautet
das Ergebnis weiterhin **No-Go**. Offen ist der bisher nicht ausgeführte
Read-only-Audit des echten Produktivbestands auf dem VPS. Dieser lokale Test
prüfte weder die tatsächlichen VPS-Volumes noch Host-Caddy, Reverse Proxy, TLS
oder Produktivdaten. Die Implementierung fällt bei fehlender Operation
ausdrücklich aus und verwendet keinen unsicheren Legacy-Pfad.
