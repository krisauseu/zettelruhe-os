# TP-022: Atomarität, Teilzustände und Nummernkreise

Stand: 2026-09-05, Basis-Commit `96d4143`. Analyse und Reproduktion abgeschlossen,
Korrekturentscheidung offen. Dokumentierender Sessionabschluss; TP-022 bleibt offen.
Geprüft mit PocketBase **0.39.10**, aktuellen unveränderten Migrationen und
synthetischen Daten in einem eigenen kurzlebigen Container. Keine Aussage über
betroffene Produktivdaten. Keine erneute allgemeine Projektprüfung.

## Ergebnis

Die Festschreibungen sind nicht atomar. Reproduziert wurden Journale zu weiterhin
editierbaren Entwürfen, doppelte Journalquellen nach Wiederholung, Kassenrecords
ohne Journalverweis, doppelt zurückgegebene Nummern, verlorene Zähleränderungen
und ein negativer Kassensaldo durch zwei parallele Entnahmen. Die Unique-Indizes
verhindern gespeicherte Nummerndubletten zwischen verschiedenen Records, aber
nicht die vorausgegangenen Writes oder das Überschreiben desselben Records.

Es wurde keine Laufzeitkorrektur eingebaut. Eine belastbare gemeinsame Grenze
für Zustandsprüfung und Persistenz benötigt eine Entscheidung zu ADR-0006.
Der falsche Atomaritätskommentar am Beleg ist berichtigt. Das ist ausschließlich
eine Beschreibung der vorhandenen Requestgrenzen, keine Fehlerbehebung.

## Tatsächliche Ablaufketten

R = Read, C = Create, U = Update, D = Delete, S = weiterer Seiteneffekt.
Jeder C/U-Schritt unten ist ein eigener HTTP-Request, sofern nicht ausdrücklich
zusammengefasst. Keiner der drei Festschreibungspfade führt D oder Kompensation aus.

| Vorgang / Owner | Ablauf und Fehlerbehandlung |
|---|---|
| Rechnung, `sales/repository.ts::festschreibenRechnung` | R Rechnung und Positionen → Guards und Validierung → R Firma und Kontakt → Nummernvergabe wie unten → R Layout/Bankkonto/optional Logodatei → S PDF in RAM rendern → Journal wie unten → **ein U Multipart** für Nummer, `offen`, Journalverweis, Zeitstempel und PDF-Datei → Rückgabe. Layout kann ohne Bank/Logo fortfahren, deren Ladefehler werden verschluckt. Render-/Journalfehler brechen ab. Nur der letzte U hat einen Catch, der Unique-Fehler in eine Wiederholungsaufforderung übersetzt. Kein Rollback. Kein SMTP oder E-Rechnungsversand in diesem Vorgang. |
| Beleg, `expenses/repository.ts::festschreibenBeleg` | R Beleg → Entwurfs-/Nummern-/Journalguard und Betrags-/Partnerprüfung → Nummernvergabe → Journal → **ein U** für Nummer, `festgeschrieben`, Journalverweis, Buchungsdatum und Zeitstempel → Rückgabe. Fehler propagieren; kein Catch oder Rollback. Bestehende Belegdateien werden bei dieser Festschreibung nicht geschrieben. |
| Kasse, `cash/repository.ts::festschreibenKassenbuchEintrag` | Validierung → optional R Kategorie → R alle Kassenrecords der Firma → Saldo-Prüfung → Nummernvergabe → **C Kasseneintrag mit Nummer und Festschreibungszeitpunkt** → Journal → **U Kasseneintrag nur Journalverweis** → Rückgabe. Kein Entwurfsstatus, kein Catch, kein Rollback. Der erste C ist bereits saldowirksam. |
| Journal, `journal/repository.ts::festschreibenBuchung` | Validierung → R `nextLaufendeNr`, höchster Wert der Firma nach `-laufende_nr`, daraus `max + 1`, bei leerem Bestand 1 → **C festgeschriebenes Journal** → Rückgabe. Kein eigener Entwurf, keine Reservierung, kein Retry bei Unique-Fehler. |
| Nummernkreis, `lib/pb.ts::allocateNummernkreis` | R Firma → Defaults mit gespeichertem JSON mischen → `nextFreieNummer`: ab `next` R Zielcollection auf gleiche Firma und formatierte Nummer, belegte Werte überspringen → **U Firma mit gesamtem Nummernkreis-JSON und erhöhtem Zähler** → Nummer zurückgeben. Keine Reservierungscollection, kein bedingtes Update, kein Lock, keine Kompensation. |

Die Ladehelfer `getFirmaById`, `getBeleg`, `getRechnung` und `getKontakt` können
Lesefehler in `null` übersetzen. Der Aufrufer meldet dann „nicht gefunden“.
`pbFetch` übersetzt HTTP-Fehler in normale `Error`-Objekte mit Status/Feldtext;
es gibt hier weder eine eigene Timeoutfrist noch einen automatischen Retry.
Ein Verbindungsfehler verrät daher nicht, ob der Write bereits erfolgt ist.

Storno ist kein Rollback dieser Abläufe. Als unmittelbar benötigter Folgepfad
wurde der Kassenstorno geprüft: R Original/Gegenbuchung → Guard auf
`journal_eintrag` → R Journalstorno → Validierung/Saldo → C Journalgegenbuchung
→ Nummernvergabe → C Kassengegenbuchung. Ein durch die Festschreibung erzeugter
Kassenrecord ohne Journalverweis wird schon am Guard abgelehnt. Fehlergrenzen
innerhalb vollständiger Rechnungs-/Kassenstornoketten wurden nicht injiziert.

## Invarianten und fachliche Grenzen

Grundlage sind [CONTEXT](../../CONTEXT.md), ADRs
[0004](../adr/0004-gobd-mindeststandard-ohne-zertifizierung.md),
[0006](../adr/0006-next-only-writes-finanzaggregate.md),
[0012](../adr/0012-belegdatei-immutable-nach-festschreibung.md),
[0024](../adr/0024-ist-versteuerung-zahlungsjournal.md) und
[0027](../adr/0027-kein-kassenbuch-aus-rechnungs-barzahlung.md).
Die ADR-Verweise sind fachliche Anforderungen, kein Nachweis implementierter Atomarität.

- Erfolgreiche Rechnungsfestschreibung verbindet genau eine ursprüngliche
  Forderungsjournalzeile mit Rechnung, Nummer, Status und gespeichertem Original-PDF.
  `buildJournalInputFromRechnung` erzeugt aktuell eine aggregierte Zeile, auch bei
  mehreren Steuersätzen. Zahlungsstaffeln sind ein anderer Vorgang.
- Erfolgreiche Beleg-/Kassenfestschreibung verbindet genau eine ursprüngliche
  Journalzeile mit der Quelle. Firma, Beträge und relevanter Kontakt müssen passen.
  Stornozeilen sind zusätzliche Gegenbuchungen, keine zweite ursprüngliche Buchung.
- Nummern sind innerhalb Firma und Dokumentart eindeutig; Journalnummern innerhalb
  Firma. Gleiche sichtbare Nummern in unterschiedlichen Firmen sind zulässig.
- Festgeschriebene Dokumente dürfen nach ADR-0004/0012 nicht still überschrieben
  werden. Ein fehlgeschlagener Aufruf darf keine unerkannte wirksame Buchung zu
  einer scheinbar noch freien Quelle hinterlassen.
- `assertSaldoNichtNegativ` verlangt einen nichtnegativen chronologischen
  Kassensaldo. Diese Prüfung muss auch bei gleichzeitigen Entnahmen halten.
- Entwürfe erhalten keine endgültige Nummer. Die Dokumentation legt keine
  ausdrückliche Regel zur Zulässigkeit von Nummernlücken nach Fehlern fest.
  **Technisch sind Lücken reproduziert; ihre fachliche Zulässigkeit ist offen.**
  Aus diesem Test wird keine steuer- oder handelsrechtliche Bewertung abgeleitet.

## Reproduktion und Klassifikation

Die Tests rufen die echten Repositories auf, einschließlich Nummernvergabe,
Journal und im Normalfall PDF-Renderer. Für den Renderfehler ersetzt ein Test
genau einen Rendereraufruf durch eine Ablehnung. `fetch` wird an der
Transportgrenze umschlossen.
Injizierte 503-Antworten verhindern den ausgewählten Request; bei „Antwort verloren“
wird der echte erfolgreiche Write zuerst vollständig ausgeführt, dann ein Fehler
geworfen. Das simuliert den unklaren Commit-Ausgang, keinen echten TCP-Timeout.
Die Dateiablehnung und die Unique-Konflikte stammen hingegen wirklich von PB.

Für Races halten begrenzte Barrieren echte Leseantworten zurück. Keine zufälligen
Sleeps und keine erfundenen PB-Erfolgsantworten. Beim Dokumentnummernkonflikt wird
nur die Journalnummernvergabe seriell zugelassen, damit deren früherer Constraint
den späteren Fehler nicht verdeckt. Daneben wird der Journal-Konflikt separat geprüft.
Die deterministischen Interleavings gelangen in wiederholten Läufen zum selben Befund.

**A** bezeichnet einen im benannten Fall nachgewiesenen Schutz, **C** einen
reproduzierten Fehler. **B** bezeichnet theoretische oder ausdrücklich ungeprüfte
Risiken ohne Fehlernachweis. Ein ungeprüfter Fall ist weder bestätigt noch entkräftet.
Diese Einordnung gilt jeweils für den beschriebenen Teilaspekt, nicht pauschal
für den ganzen Festschreibungsablauf.

| Klasse | Testfall | Persistierter Zustand / Wirkung |
|---|---|---|
| A | Zähler-U vor Ausführung abgelehnt, alle drei Abläufe | Vollständiger Ausgangszustand unverändert. |
| C | PDF-Rendering nach Nummernvergabe scheitert | Zähler erhöht; Rechnung unveränderter Entwurf, kein Journal/PDF. Wiederholung erhält `R-0002`; `R-0001` bleibt unbenutzt. |
| C | Journal-C abgelehnt | Rechnung/Beleg bleiben Entwurf, Zähler erhöht. Kasse hat bereits Nummer und Festschreibungszeitpunkt, zählt im Saldo, hat aber kein Journal. |
| C | Journal-C committed, Antwort verloren | Eine wirksame Journalzeile bleibt. Rechnung/Beleg sind unveränderte Entwürfe. Kasse bleibt ohne Rückverweis. |
| C | Abschließendes Dokument-U abgelehnt | Journal bleibt aktiv, Zähler erhöht. Rechnung/Beleg bleiben Entwurf. Kasse zählt mit, hat aber keinen Journalverweis. |
| C | PB lehnt tatsächlichen Rechnungs-Dateiupload als ungültiges PDF ab | PB 400, Rechnung inklusive PDF-Feld unverändert, aber Journal bereits gespeichert. |
| C | Wiederholung nach fehlgeschlagenem Rechnung-/Belegabschluss | Zwei aktive Journale mit derselben Quelle und verschiedenen laufenden Nummern. Nur das zweite ist verknüpft; Dokument bekommt Nummer 2. |
| C | Kassen-C abgelehnt | Zähler erhöht, kein Kasseneintrag und kein Journal. |
| C | Antwort auf Zähler-U verloren | Zähler steht auf 2, obwohl Aufrufer keine Nummer erhalten hat; Wiederholung liefert 2. |
| C / A | Antwort auf letzten U verloren | Vollständiger Erfolg gespeichert, Aufrufer sieht Fehler. Rechnung-/Belegguard verhindert weitere Writes bei Wiederholung, liefert aber keinen idempotenten Erfolg. Kasse legt bei Wiederholung einen zweiten Eintrag samt Journal an; Saldo verdoppelt. |
| C | Zwei Nummernvergaben gleicher Firma/Art | Beide liefern `B-0001`, Firmenzähler nur auf 2; kein Reservierungsrecord. |
| C | Gleichzeitige Beleg- und Rechnungsnummer derselben Firma | Beide Nummern geliefert, aber eines der beiden JSON-Inkremente überschrieben; die beiden `next`-Werte sind 1 und 2. |
| A / C | Zwei Journal-C nach gleichem `max + 1` | Einer erfolgreich, einer mit echtem Unique-Fehler. Keine doppelte gespeicherte laufende Nummer. Kein automatischer Retry. Nächster separater Aufruf bekommt 2. |
| A / C | Zwei verschiedene Rechnungen oder Belege mit derselben vergebenen Nummer | Nur ein Dokumentabschluss erfolgreich; anderer Unique-Fehler. Beide Journale bereits vorhanden, Verliererdokument bleibt Entwurf. Die Rechnungsfehlermeldung fordert zur unsicheren Wiederholung auf. |
| A | Zwei Kassenanlagen mit derselben vergebenen Nummer | Zweiter Kasseneintrag scheitert vor Journalanlage am Unique-Index. Ein Kasseneintrag, ein Journal. Diese spezielle Reihenfolge ist abgesichert. |
| C | Zwei Kassenanlagen mit verschiedenen Belegnummern, aber gleichem Journalkandidaten | Zwei saldowirksame Kassenrecords, nur ein Journal; einer ohne Verweis. |
| C | Zwei Aufrufe desselben Rechnungs-/Belegentwurfs | Erster Aufruf wartet vor Abschluss-U, zweiter schließt vollständig ab, erster überschreibt anschließend Nummer/Verweis, bei Rechnung auch PDF. Beide melden Erfolg. Zwei Journale, nur eines verknüpft, Zähler 3. Unique-Indizes verhindern kein Update desselben Records. |
| C | Zwei Kassenentnahmen à 80 bei Bestand 100 | Beide lesen den alten Saldo; zweite schließt ab, erste fährt mit veraltetem Read fort. Beide erfolgreich, drei verschiedene Belegnummern und drei Journale; Saldo **−60,00**. |
| A | Zwei Firmen gleichzeitig | Alle drei Festschreibungen erfolgreich mit separaten Quellen/Journalverweisen; Nummer 1 und Journalnummer 1 jeweils pro Firma. Keine gegenseitige Zähleränderung. |
| A | Bereits vergebene Nummer bei zurückgesetztem Zähler | `nextFreieNummer` überspringt Bestand und zieht Zähler nach. TP-012-Schutz greift. |
| A | Abgelehnter einzelner Journal-C | Kein Persistenzschritt erfolgt; nächster Aufruf verwendet dieselbe laufende Nummer. |
| B | Echter Prozessabbruch, Disk-full, physisch verwaiste Dateien nach Speicherfehler | Nicht injiziert. Die geprüften HTTP-/Validierungsfehler belegen keine Crash- oder Dateisystemgarantie. |

„Verwaist“ bezeichnet hier ein aktives Journal ohne Rückverweis aus der Quelle.
Seine textuelle `quelle_id` zeigt zunächst noch auf einen Entwurf. Ein physisch
fehlender Quellrecord wurde nicht durch anschließendes Löschen erzeugt.
Die Tabellenzellen A/C trennen den funktionierenden Constraint vom verbleibenden
fachlichen Fehler; sie bescheinigen dem Gesamtablauf keine ausreichende Absicherung.

## Nummern und vorhandener Schutz

| Nummer / Scope | Bestimmung, Verbrauch und Constraint |
|---|---|
| Rechnung | `firmen.nummernkreise.rechnung`, Prefix/Stellen/`next`; Bestandssuche in `rechnungen`. Unique `idx_rechnungen_firma_nummer (firma, rechnungsnummer) WHERE rechnungsnummer != ''`. |
| Beleg | Entsprechend `.beleg`, Bestand `belege`. Unique `idx_belege_firma_nummer (firma, belegnummer) WHERE belegnummer != ''`. |
| Kasse | Entsprechend `.kasse`, Bestand `kassenbuch_eintraege`. Unique `idx_kasse_firma_nummer (firma, belegnummer)`. |
| Journal | Höchster gespeicherter Wert + 1. Unique `idx_journal_firma_nr (firma, laufende_nr)`. Der Quellenindex `idx_journal_quelle (firma, quelle_typ, quelle_id)` ist **nicht unique**. |

Der dokumentbezogene Zählerverbrauch erfolgt mit dem Firmen-U, also vor der
erfolgreichen Festschreibung. Es gibt keine verbindliche Reservierung einer Nummer.
Eine Nummer ist erst beim Dokument-Write durch den Unique-Index geschützt.
Zählerlücken werden nicht automatisch wieder geschlossen; Bestandsprüfung findet
ab dem aktuellen `next` statt. Ein verlorenes JSON-Update kann einen Zähler auch
zurücksetzen. Bereits gespeicherte Nummern schützt dann die Bestandsprüfung,
noch nicht gespeicherte Zuteilungen schützt sie nicht.

Journalnummern werden erst durch erfolgreichen C verbraucht. Ein abgelehnter C
erzeugt im geprüften Ablauf keine Lücke. Ein später gescheiterter Dokumentabschluss
hinterlässt dagegen eine unzugeordnete Buchung mit regulärer laufender Nummer.
Es wurde keine gespeicherte Nummerndublette innerhalb derselben Firmen-/Artgrenze
erzeugt. Doppelte Zuteilungen und doppelte fachliche Quellen sind davon zu unterscheiden.

Die Entwurfs-/Immutability-Guards schützen gewöhnliche serielle Wiederholungen.
Sie lesen den Zustand jedoch nur vorab. Client-Writes sind seit TP-020 gesperrt;
dies serialisiert nicht die erlaubten Next-Superuser-Writes. Die optionale
Journalrelation verlangt weder genau einen Eintrag je Quelle noch einen Rückverweis.

## Korrekturentscheidung

Kleine Änderungen reichen für die reproduzierten Anforderungen gemeinsam nicht:
ein Unique-Retry im Journal verhindert keine vorherigen Kassen-Writes; ein zusätzlicher
Quellenindex blockiert nach einem verwaisten Journal nur die Wiederholung. Er müsste
außerdem Zahlungen mit mehreren Steuerstaffeln ausnehmen. Ein Prozess-Mutex schützt
nicht vor Fehlern zwischen Requests oder Prozessabbruch. Nachträgliche Deletes oder
Gegenbuchungen können ihrerseits scheitern; verlorene Antworten machen ihren Einsatz
mehrdeutig. Umordnen der Writes verschiebt nur den möglichen Teilzustand.

PocketBase bietet bereits eine Transaktion für native Batch-Writes.
Im **0.39.10-Testbestand** war Batch zunächst deaktiviert. Ausschließlich dort
wurde es kurz aktiviert, ein Batch aus Zähler-U und zwei konkurrierenden Journal-C
ausgeführt und der vollständige Rollback bei HTTP 400 geprüft. Derselbe Batch ohne
den letzten C war erfolgreich. Die Einstellung wurde wiederhergestellt.
Das ist ein Nachweis der vorhandenen Funktion, keine Implementierung einer Lösung.
Der versionsgebundene [PB-Batchcode](https://github.com/pocketbase/pocketbase/blob/v0.39.10/apis/batch.go)
nutzt `RunInTransaction` und erlaubt Record-Writes, aber keine beliebigen Read-/Guard-Schritte.

Beim Sessionabschluss ist **Option 1 die bevorzugte Richtung**. Das ist noch
keine verbindliche Architekturentscheidung und keine Freigabe zum Implementieren.
Die Alternativen bleiben zur Abwägung dokumentiert:

| Option | Vorteile | Nachteile / erforderlicher Entwurf |
|---|---|---|
| **1. Eng begrenzte PB-Transaktionsoperation hinter Next, empfohlen** | Zustandsprüfung, Nummernzähler, Journal und Quellabschluss können innerhalb derselben DB-Transaktion erfolgen. Keine zusätzliche Infrastruktur. | Neue bewusste Persistenzgrenze zu ADR-0006, bisher keine `pb_hooks`. Firmen-/Quellprüfung und Saldo müssen innerhalb der Transaktion erneut geprüft werden. Next behält Zugangskontrolle, Eingabeprüfung und PDF-Erzeugung. Idempotenz und Dateiablage sind gesondert mitzuentwerfen. |
| **2. Native PB-Batches plus optimistische Versionsprüfung aus Next** | Nutzt vorhandene Batch-Transaktion; Fachberechnung bleibt überwiegend in Next. JSON-Rollback bereits bewiesen. | Batch allein reicht nicht. Benötigt eine belastbare Versionsbedingung für Firma und Quelle, etwa atomar beanspruchte eindeutige Revisionen, begrenzte Wiederholung mit neuem Read und stabile Vorgangs-ID. Alle konkurrierenden Finanz-/Zählerwriter müssen dieselbe Grenze verwenden. Schemaergänzung und Versionsprotokoll sind eine größere Entscheidung. |
| **3. Dauerhaftes Vorgangsprotokoll mit Wiederaufnahme und Kompensation** | Teilzustände werden explizit sichtbar und nach Neustart fortsetzbar. | Mehr Zustände, Wiederanlauf-/Kompensationslogik und Fencing gegen Nebenläufigkeit; Zwischenzustände müssen aus Auswertungen ausgeschlossen werden. Größerer Eingriff in aktuelle Fachlogik und Immutability, für diesen Befund nicht bevorzugt. |

PB beschreibt [Transaktionen im JavaScript-Backend](https://pocketbase.io/docs/js-database/#transaction).
Die laufende Online-Dokumentation betrifft eine neuere Version; die hier gemessene
Batchaussage ist ausdrücklich durch 0.39.10 abgesichert. Eine konkrete neue
Transaktionsoperation wurde nicht gebaut oder getestet.

Abnahmekriterien für die gewählte Lösung: genau eine Festschreibung je Vorgang,
keine doppelten Nummern oder Quellen, vollständiger Rollback oder explizit sicher
wiederaufnehmbarer Zustand, Wiederholung nach unklarer Antwort mit gleichem Ergebnis,
Saldo-Prüfung gegen verbindlichen Bestand, Erhalt anderer Nummernkreise und
Festschreibungsdateien. Ein PDF kann außerhalb der DB-Transaktion vorbereitet werden;
Nummer und Quellversion müssen beim Commit noch gelten, sonst neu vorbereiten.
Keine PDF-Renderarbeit unter lang gehaltenem DB-Lock. Dateisystemfehler und Rollback
von Multipart-Batches bleiben gesondert zu prüfen. Die Entscheidung über Lücken nach
abgebrochenen Versuchen muss als Projektanforderung festgehalten werden.

## Reproduktionskommandos und Verifikation

Vom Projekt-Root, Docker-Image `zettelruhe-pocketbase:latest` mit PB 0.39.10 und
vorhandene App-Dependencies erforderlich. Kein Download, kein Compose-Start,
keine `.env`-Datei wird geladen.

```bash
node scripts/test-festschreibung-isolated.mjs
TP022_REQUIRE_CONSISTENCY=1 node scripts/test-festschreibung-isolated.mjs -t 'OPEN C'
```

Der erste Befehl bestätigt den Istzustand mit **41 bestandenen Tests und zwei
erwarteten Fehlern**. Die zwei `OPEN C`-Tests formulieren gewünschte Invarianten;
der zweite Befehl aktiviert sie als normale Akzeptanztests und wird derzeit
**rot**: Journalbestand 1 statt 0; verschiedene zugeteilte Nummern 1 statt 2.
Grüne Charakterisierung bedeutet hier ausdrücklich nicht Fehlerbehebung.
Die 41 normalen Tests prüfen sowohl funktionierende Schutzmechanismen als auch
das bekannte Fehlverhalten; sie sind keine 41 bestandenen Konsistenzanforderungen.
`it.fails` akzeptiert eine erwartete Testablehnung. Deshalb gehört zur Verifikation
auch der rote Akzeptanzlauf mit Prüfung der konkreten Assertions, damit etwa ein
Barrieren- oder Verbindungsfehler nicht als Beleg für die gewünschte Reproduktion gilt.
Bei einer späteren Korrektur müssen betroffene Istzustands-Assertions gezielt in
Konsistenztests überführt werden. Bis dahin bleiben die Tests unverändert erhalten.

| Prüfung | Ergebnis |
|---|---|
| Isolierte Integration, obiger erster Befehl | 43 Fälle, 41 bestanden + 2 erwartete Fehler; wiederholt reproduziert. |
| Roter Akzeptanzmodus, obiger zweiter Befehl | Zwei erwartete Assertion-Fehler erneut bestätigt: Journalbestand 1 statt 0; unterschiedliche Nummern 1 statt 2. Exitcode 1 ist hier der Nachweis offener Fehler. |
| Betroffene Module | `cd app && ./node_modules/.bin/vitest run src/modules/sales src/modules/expenses src/modules/cash src/modules/journal src/lib/nummernkreis.test.ts`: 228 bestanden. |
| Vollständige Unit-Suite | `cd app && npm test`: 617 bestanden, 43 Integrationstests ohne explizite Isolation übersprungen und separat ausgeführt. |
| Typecheck | `cd app && ./node_modules/.bin/tsc --noEmit --incremental false`: bestanden. |
| Gezieltes ESLint | Neue Integrationstestdatei, Beleg-Repository und Teststarter bestanden. Beim Starter vom Root nur React-Version-Erkennungswarnung; keine Lintfehler. |
| Starter-Syntax | `node --check scripts/test-festschreibung-isolated.mjs`: bestanden. |

Die Prüfungen wurden zum dokumentierenden Sessionabschluss erneut ausgeführt;
die Ergebnisse stehen in der Tabelle. Tests und Starter blieben dabei unverändert.
Hashvergleich vor/nach Abschluss bestätigt dies auch für das Beleg-Repository
einschließlich des bereits korrigierten Kommentars. In diesem Abschlussschritt
wurden nur dieser Bericht, `docs/entwicklung.md` und `docs/testphase.md` ergänzt.
Vite meldet wie bei den bestehenden Tests eine Warnung zur zukünftigen nativen
Config-Ladung. Keine Änderung daran, keine UI-/Build-/Deploymentprüfung erforderlich.

## Datenbilanz und Restunsicherheit

Jeder Integrationslauf bekommt einen eigenen Container, zufälligen Loopback-Port,
frische Test-Superuser-Zugangsdaten sowie leere tmpfs-Verzeichnisse für PB-Daten und
temporäre Dateien. Die aktuellen Migrationen sind read-only eingebunden.
Bestehende Container, Produktionsports, Datenvolumes und Zugangsdaten werden nicht
verwendet. Vor der ersten Fixture verweigert die Suite jeden Bestand mit Firmen.
Der Starter entfernt den Container inklusive tmpfs auch nach Testfehlern.

Letzter vollständiger Lauf vor Bereinigung: **47 Firmen, 14 Kontakte, 14 Rechnungen,
14 Rechnungspositionen, 14 Belege, 14 Kassenrecords, 46 Journalzeilen und 16 Dateien
im PB-Speicher**. Diese Werte sind der gesamte Schlussbestand dieses Laufs, keine
Summe aller Wiederholungsläufe. Der anschließende rote Akzeptanzlauf erzeugte zwei
Firmen, einen Beleg und eine Journalzeile, ohne Dateien; auch dieser Bestand wurde
entfernt. Die abschließende Abfrage nach `zettelruhe-tp022`-Containern war leer.
Auch die früheren Diagnosecontainer wurden entfernt. Kein Testbestand bleibt erhalten.
Nur Tests, Starter, Kommentar und Prüftexte liegen
im Arbeitsbaum. Keine Migration, Dependency, Konfiguration, Commit oder Push geändert.

Ungeprüft bleiben echte Netzwerkabbrüche/Prozesskill, Disk-full, physische
Dateiwaisen, Langzeitlast, mehrere Next-Prozesse, vollständige Stornoketten und
die spätere Lösung. Reproduziert sind kontrollierte Interleavings tatsächlicher
HTTP-Persistenz, keine Häufigkeiten unter Alltagslast. Kein Produktivbestand wurde
auf vorhandene Schäden untersucht. Technische Nummernlücken sind belegt, ihre
fachliche Zulässigkeit nicht entschieden.

## Übergabe an die nächste Session

Mit der Entscheidungsvorlage für die bevorzugte Option 1 beginnen, auf Basis
dieses Berichts und der erhaltenen Tests. Vor der Implementierung festlegen:

- Grenze zu ADR-0006: welche Operationen und verbindlichen Prüfungen innerhalb
  der PB-Transaktion laufen, wie Next den Zugriff autorisiert und welche
  konkurrierenden Schreiber dieselben Zähler-/Quellregeln einhalten müssen.
- Idempotenz: stabile Vorgangsidentität, Wiederholung nach verlorener Antwort und
  Verhalten bei zwei Aufrufen derselben Quelle.
- PDF-/Dateigrenze: verbindliche Nummer und Quellversion beim Commit sowie
  Verhalten bei Datei- und Rollbackfehlern.
- Fachliche Behandlung von Nummernlücken und Vorgehen bei eventuell bereits
  vorhandenen Teilzuständen. Dieser Auftrag hat keinen Produktivbestand geprüft.

Erst nach verbindlicher Entscheidung Korrektur entwickeln und die betroffenen
Charakterisierungen auf bestandene Konsistenztests umstellen. **TP-022 bleibt offen.**
`AGENTS.md` verweist bereits auf `docs/entwicklung.md` und `docs/testphase.md`;
ein weiterer Einstiegspunkt ist nicht nötig. ADR-0006 bleibt unverändert, bis die
Entscheidung getroffen ist. Seine Atomaritätsanforderung ist durch die aktuelle
Implementierung nicht erfüllt; diese Abweichung ist im Entwicklungsbefund verlinkt.
