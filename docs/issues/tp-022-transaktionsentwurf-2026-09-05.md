# TP-022: Entwurf der PocketBase-Transaktionsoperation

Stand: 2026-09-05. **Entwurf, keine Implementierung und keine geänderte ADR.**
Grundlage sind der aktuelle Checkout und die vorhandene
[TP-022-Charakterisierung](festschreibung-atomaritaet-2026-09-05.md).
Die zuvor vorhandenen Änderungen und Tests bleiben erhalten.
In dieser Session wurden keine Migration, Konfigurationsänderung, Fachcodeänderung,
Anwendungsstarts oder produktiven Datenzugriffe vorgenommen. Kein Commit oder Push.

## Empfehlung und Garantieumfang

**Go für die schrittweise Umsetzung von Option 1.** Next bleibt der öffentliche
Eingang und übernimmt Session, Rollen, Eingabevalidierung, Fachberechnung und PDF.
Ein kleines PocketBase-Modul übernimmt verbindliche Zustandsprüfung und gemeinsame
Persistenz mit `runInTransaction`. Seine drei Kernoperationen sind Belegfestschreibung,
Rechnungsfestschreibung und Kassenanlage. Die zugehörigen konkurrierenden Writer
müssen dieselben Persistenzregeln einhalten.

Die zugesagte Atomarität betrifft `data.db`: Nummernkreisänderung, Journal,
Quellabschluss und gegebenenfalls Idempotenzdaten werden gemeinsam committed oder
zurückgerollt. Neue PDF-Bytes müssen erfolgreich gespeichert sein, bevor dieser
Commit erfolgt. **SQLite und das Dateisystem bilden trotzdem keine gemeinsame
ACID-Transaktion.** Nach Abbruch können unreferenzierte Dateien verbleiben;
eine uneingeschränkte Stromausfallgarantie ist mit dem vorhandenen Speicherpfad
nicht gegeben. Diese Grenze muss im Entwurf und bei der Abnahme ausdrücklich stehen.

Option 2, native Batches mit optimistischen Revisionen aus Next, verbessert diese
Dateigrenze nicht. Sie benötigt darüber hinaus ein gemeinsames Versionsprotokoll
für Quelle, Nummernkreise, Positionen und Kassenbestand. Es gibt keinen technischen
Grund, deshalb von Option 1 zu Option 2 zu wechseln.

## Versions- und Mechanismenprüfung

Das [Dockerfile](../../pocketbase/Dockerfile) bindet PocketBase **0.39.10**.
Die vorhandene TP-022-Reproduktion hat diese Binärversion bereits geprüft;
der isolierte Starter prüft sie explizit vor seinen Tests. Diese Session hat
die versionsgebundenen Primärquellen gelesen, keine entfernte Installation geprüft.

Die folgenden Aussagen stammen aus dem Quellstand `v0.39.10`, nicht allein aus
der laufenden PocketBase-Webdokumentation:

| Mechanismus | Verifizierter Befund und Konsequenz |
|---|---|
| Transaktion | `RunInTransaction` benutzt `NonconcurrentDB`; alle Reads und Saves müssen über das übergebene `txApp` erfolgen. Fehler aus dem Callback führen zum Rollback. After-Hooks laufen erst nach Transaktionsende. [Quelle](https://github.com/pocketbase/pocketbase/blob/v0.39.10/core/db_tx.go) |
| Serialisierung | Die reguläre Nonconcurrent-Verbindung hat `MaxOpenConns(1)`. Eine zweite Transaktion derselben PB-App wartet bereits auf diesen Verbindungsslot. Die Begrenzung gilt für die gesamte Datenbank, nicht nur eine Firma. [Quelle](https://github.com/pocketbase/pocketbase/blob/v0.39.10/core/base.go#L1160-L1195) |
| SQLite-Start | PB nutzt WAL, `busy_timeout(10000)` und `synchronous(NORMAL)`, ohne `_txlock`. Das gebundene dbx 1.12.0 startet die Transaktion über `Begin`; modernc/sqlite 1.55.0 verwendet standardmäßig `begin`, also DEFERRED. Es wäre falsch, PB hier `BEGIN IMMEDIATE` zuzuschreiben. [PB-DSN](https://github.com/pocketbase/pocketbase/blob/v0.39.10/core/db_connect.go), [Abhängigkeiten](https://github.com/pocketbase/pocketbase/blob/v0.39.10/go.mod), [dbx](https://github.com/pocketbase/dbx/blob/v1.12.0/db.go#L165-L223), [SQLite-Treiber](https://gitlab.com/cznic/sqlite/-/blob/v1.55.0/tx.go) |
| JS-Erweiterung | `routerAdd` und `$apis.requireSuperuserAuth()` sind in dieser Version gebunden. Multipart-Dateien liefert `RequestEvent.findUploadedFiles`. Kein eigener Go-Build und kein aktiviertes Batch-Feature erforderlich. [Bindings](https://github.com/pocketbase/pocketbase/blob/v0.39.10/plugins/jsvm/binds.go), [generierte Typen](https://github.com/pocketbase/pocketbase/blob/v0.39.10/plugins/jsvm/internal/types/generated/types.d.ts) |
| FileField | Der Create/Update-Execute-Interceptor speichert neue Bytes vor dem Record-SQL. Bei Uploadfehler läuft dieser SQL-Schritt nicht erfolgreich weiter. Nach SQL- oder Transaktionsfehlern versucht PB, neue Dateien zu löschen; Fehler dabei werden teilweise nur protokolliert. Alte Dateien werden erst nach erfolgreichem Commit entfernt. [Quelle](https://github.com/pocketbase/pocketbase/blob/v0.39.10/core/field_file.go#L330-L574) |
| Lokaler Dateitreiber | `UploadFile` wartet auf Schreiben und `Close`. Der lokale Treiber arbeitet mit temporären Dateien und Rename, nicht mit einer SQLite-Transaktion; im betrachteten Abschlussweg fehlt ein explizites `fsync`. [Upload](https://github.com/pocketbase/pocketbase/blob/v0.39.10/tools/filesystem/filesystem.go#L219-L261), [lokaler Treiber](https://github.com/pocketbase/pocketbase/blob/v0.39.10/tools/filesystem/internal/fileblob/fileblob.go#L600-L668) |

Die SQLite-Isolation verhindert, dass zwei Writer dieselbe veraltete Snapshot-Sicht
erfolgreich fortschreiben. Bei einem fremden Writer kann ein Read-to-Write-Upgrade
mit `SQLITE_BUSY_SNAPSHOT` scheitern; dann muss die gesamte Transaktion mit neuen
Reads beginnen. Ein Retry nur des letzten INSERT mit altem Saldo ist falsch.
[SQLite-Isolation](https://www.sqlite.org/isolation.html).

Für den vorhandenen Betrieb mit einer PB-App je Datenvolume genügt die
Nonconcurrent-Serialisierung. Kein zusätzlicher Next-Mutex und kein künstliches
Lock-Record. Falls später fremde SQLite-Writer unterstützt werden sollen, wäre ein
erster Schreibzugriff vor den fachlichen Reads eine mögliche Erweiterung. Das ist
keine Voraussetzung für diesen Entwurf. Mehrere Next-Prozesse sind unproblematisch,
wenn sie dieselbe PB-App ansprechen.

## Kleines internes Interface

Vorgeschlagener Next-Adapter: `app/src/lib/finanz-transaktion.ts`.
Die bestehenden fachlichen Repositories behalten ihre öffentlichen Funktionen;
der Adapter versteckt Transport, Konfliktcodes und Wiederholung.

Die PB-Routen liegen beispielsweise unter `/internal/zettelruhe/finanz/…`.
Dieser Pfad wird von den aktuellen Caddy-Dateien nicht an PocketBase weitergereicht;
Next erreicht ihn direkt über `PB_URL`. Zusätzlich verlangt jede Route
`$apis.requireSuperuserAuth()`. Eine interne URL allein ist kein Zugriffsschutz.
Die vorhandenen gesperrten Collection-Rules und geschützten Dateien bleiben bestehen.

Es gibt feste, versionierte Operationen mit erlaubten Feldern, kein beliebiges
SQL-, Collection- oder Batch-Interface aus einem Request. Ein Festschreibungsaufruf
enthält Firmen-ID und Akteur aus der Next-Session, Quell-ID oder Kassen-Vorgangs-ID,
einen erwarteten Datenstand, vorbereitete fachliche Werte und bei Rechnung das PDF
mit Nummernkandidat. Der Nutzer darf Firma und Akteur nicht selbst bestimmen.

Next prüft die Schreibberechtigung vor der Vorbereitung. PB prüft im Commit die
fortbestehende Mitgliedschaft samt Schreibrolle für den von Next angegebenen Akteur.
Damit wird auch ein Rechteentzug während des Renderns wirksam. Die öffentliche
Authentifizierung und Rollenauflösung bleiben in Next; PB implementiert hier nur
die verbindliche Commit-Voraussetzung.

PB liefert eine kleine Ergebnisquittung: Quell-ID, Dokumentnummer, Journal-ID,
Journalnummer, Festschreibungszeitpunkt und bei Rechnung Dateiname. Zusätzlich
`committed` oder `replayed`, damit ein wiederholter Erfolg vom neuen Commit
unterschieden werden kann. Spätere Rechnungsstatus wie `bezahlt` werden durch eine
Wiederholung nicht auf `offen` zurückgesetzt.

Fehlercodes unterscheiden mindestens `SOURCE_CHANGED`, `NUMBER_CHANGED`,
`INVALID_STATE`, `INSUFFICIENT_CASH`, `IDEMPOTENCY_CONFLICT`, fehlende Berechtigung
und unbekannten Commit-Ausgang. Lesefehler dürfen in diesem Pfad nicht wie in
manchen heutigen Ladehelfern pauschal zu „nicht gefunden“ werden.

## Verbindliche Zustandsprüfung

Ein bloßer Vergleich von `updated` reicht nicht: Die betroffenen Collections haben
diese Felder nicht durchgängig, Rechnungspositionen sind außerdem separate Records.
Die kleinste Lösung ist eine explizite erwartete Projektion der relevanten Daten.
PB liest diese Projektion erneut und vergleicht Werte, IDs und vollständige Mengen.
Ein kanonischer Hash kann den Vergleich abkürzen; er ersetzt weder das erneute Lesen
noch das Festlegen der enthaltenen Felder. Eine neue globale Revisionstabelle ist
für diesen Ansatz unnötig.

Gemeinsam gelten im Callback:

1. Firmen-/Akteursbindung und Berechtigung prüfen.
2. Einen bereits vollständig committed Vorgang erkennen und unverändert quittieren.
3. Quelle laden, Firma vergleichen und Entwurf, leere endgültige Nummer,
   leeren Journalverweis und fehlenden Festschreibungszeitpunkt prüfen.
4. Erwartete Inhalte und relevante Beziehungen gegen die aktuellen Records prüfen.
5. Vorhandene ursprüngliche Journale der Quelle prüfen. Ein Journal zu einem
   Entwurf ist ein Altfehler, kein Anlass für eine neue Buchung oder automatische Reparatur.
6. Nummer und Journalnummer innerhalb dieser Transaktion bestimmen und alles speichern.

Die erwartete Projektion enthält beim Beleg Datum, Buchungsdatum, Richtung,
Beträge, Steuersatz, beide Partnerfelder, Kategorie, Notiz, Konto und Dateinamen.
Die Rechnung enthält alle Kopfwerte sowie die vollständige geordnete Positionsmenge
mit IDs, Firma, Rechnungsbezug, Sortierung, Texten, Mengen, Preisen, Steuersätzen und
Beträgen. Hinzu kommen die tatsächlich verwendeten Firmen-, Kontakt- und Layoutdaten.
Nicht nur die ersten 200 Positionen vergleichen, wie sie der heutige Listenhelfer
begrenzt lädt. Vollständig paginieren oder eine ausdrücklich validierte Obergrenze setzen.

Next muss bei der Vorbereitung auch prüfen, dass neu berechnete Positionssummen
den gespeicherten Kopf- und Positionsbeträgen entsprechen. Der jetzige Aufruf von
`validateRechnungInput` verwirft sein Ergebnis und beweist diese Gleichheit nicht.
Die Transaktion bestätigt anschließend exakt den geprüften Stand. Die fachliche
Preis-/Steuerberechnung muss deshalb nicht vollständig nach PB wandern.

Alle verwendeten Kontakte und Positionen müssen zur Firma gehören. Ein optionaler
Kontakt darf leer bleiben; ein gesetzter Kontakt muss noch existieren. Bei Rechnung
bleibt der Kunde erforderlich. Beim Beleg bleibt die Partnerwahl richtungsgebunden.
Kategorie bleibt ein Text-Schnappschuss. Die aktuelle Prüfung ihrer Richtung wird
mit derselben bestehenden Semantik verbindlich wiederholt, ohne historische
Kategorien eigenständig in Pflichtrelationen umzubauen.

Die Rechnung behält ihren gespeicherten Steuer-Modus. Ein inzwischen geänderter
Firmenmodus darf nicht still Rechnung und Journal umrechnen. Änderungen relevanter
Firmendaten während der Vorbereitung führen zum Konflikt und erneuten Lesen.

## Ablauf Beleg

| Phase | Reads, Prüfungen und Writes |
|---|---|
| Vorbereitung in Next | Schreibsession; Beleg und relevante Firma/Partner lesen; bestehende Validierungen; erwartete Projektion und Journalwerte ohne endgültige IDs/Nummern vorbereiten. Belegdateien sind bereits archiviert und werden hier nicht hochgeladen. |
| Verbindliche Prüfung in PB | Idempotenten Abschluss erkennen, sonst Quelle und Beziehungen erneut prüfen; Projektion vergleichen; Entwurfs-/Nummern-/Journalguard und Abwesenheit einer ursprünglichen Journalbuchung prüfen. |
| Atomare Persistenz | Belegnummer auswählen und Firmen-JSON aktualisieren; Journalnummer bestimmen und genau eine Zeile `quelle_typ=beleg` anlegen; am Beleg Nummer, Journalverweis, Status, Buchungsdatum und gemeinsamen UTC-Zeitpunkt setzen; Commit. |

Das Buchungsdatum erhält wie bisher den Fallback auf das Belegdatum.
Das endgültige Journal bekommt dieselben Beträge und denselben wirksamen Kontakt.
Nummernbestandteil des Journaltextes wird erst mit der verbindlichen Nummer
zusammengesetzt. Das ist eine kleine Persistenzaufgabe, keine zweite Beleg-Fachlogik.

## Ablauf Rechnung

1. Next liest Rechnung, vollständige Positionen, Firma, Kunde und die verwendeten
   Layout-/Bankdaten. Die Auswahlmenge für das erste aktive Bankkonto muss ebenfalls
   zum erwarteten Stand gehören, damit ein neu vorrangiges Konto erkannt wird.
   Logo-Bytes werden vor dem Commit geladen. Dateiname und verwendete Daten werden
   an die Vorbereitung gebunden. Ladefehler dürfen nicht unbemerkt ein anderes
   Original erzeugen; bestehende optionale Fallbacks müssen ausdrücklich feststehen.
2. Next bestimmt mit der bisherigen Format-/Bestandslogik einen **unverbindlichen
   freien Nummernkandidaten**, ohne den Zähler zu schreiben. Keine Reservierung und
   kein sichtbares Original an der Entwurfsrechnung.
3. Next rendert das vollständige PDF mit diesem Kandidaten, einschließlich GiroCode.
   Eine nachträgliche Text-Ersetzung der Nummer im PDF wäre dafür nicht ausreichend.
4. PB nimmt Multipart-Metadaten und eine begrenzte PDF-Datei entgegen. Das Einlesen
   des HTTP-Uploads und die Extraktion der Upload-Dateiobjekte erfolgen vor dem
   Transaktionscallback. Noch keine endgültige Speicherung am Rechnungsrecord.
5. Im Callback prüft PB zuerst einen bereits erfolgten Abschluss. Sonst folgen
   Entwurfszustand, erwartete Daten, Mitgliedschaft, Kontakte und Positionen.
   PB berechnet erneut die nächste freie Rechnungsnummer. Nur bei identischem
   Kandidaten und unveränderter relevanter Nummernkreiskonfiguration geht es weiter.
6. PB schreibt Firmenzähler, eine ursprüngliche Forderungsjournalzeile und den
   Rechnungsabschluss über `txApp`. Beim Save der Rechnung hängt PB das bereits
   empfangene File-Objekt an `pdf`. Nummer, `offen`, Journalverweis, UTC-Zeitpunkt
   und Dateiname gehören zu diesem einen DB-Commit.
7. Erst danach darf Next das Original anbieten und Erfolg melden.

Bei `NUMBER_CHANGED` verwirft Next das vorbereitete PDF und rendert außerhalb der
Transaktion mit neuem Kandidaten erneut, beispielsweise höchstens dreimal pro
Benutzeraufruf. Ein Inhaltskonflikt `SOURCE_CHANGED` wird dem Nutzer gemeldet;
geänderte Rechnungsinhalte werden nicht still unter derselben Bestätigung gebucht.
Ein Retry nur wegen des Nummernkandidaten darf ebenfalls keine unbemerkt geänderten
Inhalte übernehmen. Fortgesetzter Konflikt hinterlässt einen unveränderten Entwurf.

Zwei verschiedene Rechnungen dürfen vorübergehend denselben Kandidaten rendern.
Nur eine bekommt ihn verbindlich zugeteilt; die andere wird neu vorbereitet.
Zwei Aufrufe derselben Rechnung liefern höchstens einen neuen Commit und anschließend
dieselbe Quittung. Kein zweites Journal und kein Ersetzen des zuerst gespeicherten PDF.

SMTP und E-Rechnungs-XML bleiben eigene Vorgänge außerhalb dieser Transaktion.

## Ablauf Kasse und Saldo-Beweis

Kasse hat keinen persistenten Entwurf. Die Operation legt den Eintrag erstmals an.
Next normalisiert Eingabe, Datum und Beträge und bindet den Aufruf an eine stabile
Vorgangs-ID. PB prüft Mitgliedschaft, Firma, Kontakt und Kategorie verbindlich.

Im selben Callback folgen Idempotenzprüfung, vollständiges Lesen des Kassenbestands
der Firma, Erzeugung der tatsächlichen Kandidaten-ID, Saldo-Prüfung, Nummernvergabe,
Kassenrecord, Journal und Rückverweis. Ein zunächst intern ohne Journal gespeicherter
Record ist für andere Verbindungen bis zum Commit unsichtbar. Vor dem Commit muss
der Rückverweis gesetzt sein; jeder Fehler rollt beide Records und den Zähler zurück.

Saldo wird in der vorhandenen Reihenfolge `datum,id` über alle Einträge einschließlich
Kandidat berechnet. **Jeder Zwischenstand muss nichtnegativ sein**, nicht nur die
Summe am Ende. Das gilt auch bei Rückdatierung und Kassenstorno. Für die Rechnung
mit Geldbeträgen wird dieselbe Decimal-Bibliothek versionsgebunden PB-kompatibel
bereitgestellt; keine SQLite-REAL-Summe oder Umwandlung der Dezimaltexte in JS-Floats.
Die PB-Version braucht nur Addition, Subtraktion und Vergleich, keine PDF-/Steuerlogik.

Der bisherige Platzhalter `~new-…` sortiert am Tagesende; die später zufällig erzeugte
PB-ID kann anders liegen. Der neue Guard verwendet deshalb bereits die endgültige
ID. Er erhält die aktuelle Sortierregel, ohne eine neue Kassenchronologie einzuführen.
Das kann bisher unerkannte negative Tages-Zwischenstände aufdecken; solche Bestände
werden gemeldet, nicht still umsortiert.

Der konkrete Parallelfall bei Bestand 100 Euro:

| Schritt | Aufruf A | Aufruf B |
|---|---|---|
| Transaktion beginnt | Erhält den Nonconcurrent-Verbindungsslot. | Wartet vor Ausführung seines Callbacks. |
| Verbindliche Prüfung | Liest 100; 80 Entnahme ergibt 20. | Hat noch keinen verbindlichen Saldo gelesen. |
| Abschluss | Committed Entnahme, Nummer und Journal gemeinsam. | Erhält danach den Verbindungsslot. |
| Zweite Prüfung | Fertig. | Liest 20; weitere 80 ergäben −60. Callback bricht ab, keine neue Nummer oder Buchung. |

Rollt A zurück, sieht B weiterhin 100 und darf erfolgreich sein. Ein Lockfehler
wird als vollständiger Retry mit neuen Reads behandelt. Vorausgelesene Salden
aus Next werden für diese Entscheidung nie verwendet.

**Kassenstorno muss mit der Kassenstufe in dieselbe Transaktionslogik wechseln.**
Es verändert den gleichen Saldo und verbraucht denselben Nummernkreis. Der
alte Stornopfad mit vorab gelesenem Saldo würde die neue Invariante umgehen.
Original, vorhandener Storno, Originaljournal, Gegenjournal, Nummer und Gegenrecord
werden gemeinsam geprüft und gespeichert. Die bestehenden Stornoverbote bleiben.

## Nummernkreisstrategie und unvermeidbare gemeinsame Writer

`firmen.nummernkreise` bleibt JSON mit den vorhandenen Schlüsseln, Prefix, Stellen
und `next`. Keine neue Zählertabelle. Im Callback wird das **frisch gelesene** JSON
mit den bisherigen Defaults ergänzt. Nur der betroffene Kreis wird verändert.
Die vorhandene Suche ab `next` überspringt bereits gespeicherte Nummern im selben
Firmen-/Dokumentbereich; die Begrenzung auf 1000 Kandidaten bleibt zunächst.
Bestehende Unique-Indizes bleiben die letzte Absicherung.

Ein voller JSON-Write ist innerhalb dieser serialisierten Grenze sicher, wenn alle
anderen Writer ebenfalls aus dem aktuellen Stand arbeiten. Deshalb müssen schon
mit der ersten nutzbaren Stufe folgende Zugriffe umgestellt werden:

- Alle bisherigen `allocate…nummer`-Pfade, auch Angebot und Kontakt, verwenden
  denselben transaktionalen Nummernkreishelfer. Für noch nicht umgestellte Abläufe
  kann er vorübergehend einen isolierten Zähler-Commit anbieten. Das verhindert
  verlorene JSON-Updates, verspricht dort aber noch keine Dokument-Atomarität oder
  lückenfreie Wiederholung. Die drei umgestellten Festschreibungen verwenden nur
  den Helfer innerhalb ihres eigenen Callbacks, nie diese Übergangsoperation.
- Firmeneinstellungen senden gezielte Konfigurationsänderungen mit erwarteter
  bisheriger Konfiguration. PB mischt sie in den aktuellen Stand; `next` darf wie
  heute nicht rückwärts gehen, nun geprüft gegen den tatsächlichen Commit-Stand.
  Reine Stammdatenänderungen senden kein veraltetes Nummernkreis-JSON mehr mit.
  Alte Formulare dürfen neuere Prefix-/Stellenänderungen nicht still überschreiben.
- Der allgemeine Firmen-CRUD-Weg darf diese Regeln nicht mit einem beliebigen
  `nummernkreise`-Ersatz umgehen. Die Einschränkung gehört in dasselbe PB-Modul.

Nach einem abgebrochenen **neuen Gesamtvorgang** bleiben Zähler und Dokumentnummern
unverändert. Ein verlorener Erfolgsresponse verbraucht keine zweite Nummer.
Damit entstehen durch solche Abbrüche keine neuen Nummernlücken. Bereits vorhandene
Lücken, ausdrücklich erhöhte Startwerte, Prefixwechsel und noch nicht umgestellte
Angebots-/Kontaktabläufe sind davon getrennt. Nummern stornierter Dokumente bleiben
verbraucht. Kein automatisches Auffüllen alter Lücken.

Projektentscheidung vorschlagen: „Abgebrochene Festschreibungen verbrauchen keine
Nummer; vergebene Nummern bleiben erhalten.“ Eine Erlaubnis für technisch durch
diese Abbrüche verursachte Lücken wird dann nicht benötigt. Der Umgang mit bereits
vorhandenen oder administrativ erzeugten Lücken bleibt eine ausdrückliche
Produkt-/Betriebsfrage. Dies ist keine steuerrechtliche Bewertung.

## Journalstrategie

`max(laufende_nr) + 1` pro Firma kann erhalten bleiben, jetzt innerhalb derselben
Transaktion wie das Journal-INSERT und der Quellabschluss. Es wird kein zusätzlicher
Journalzähler benötigt. Kein GET in Next, der später als verbindliche Nummer gilt.

Die ursprüngliche Beleg-, Rechnungs- oder Kassenzeile wird nur von ihrer
Gesamtoperation angelegt. Quelle, Firma, Beträge, Kontakt und Rückverweis werden
gemeinsam gebunden. Direkte Journaloperationen dürfen diese drei Quelltypen nicht
als Ersatz für den Quellabschluss anlegen.

Zusätzlich empfehle ich nach einem Read-only-Bestandsaudit einen **partiellen**
Unique-Index auf `(firma, quelle_typ, quelle_id)`, ausschließlich für
`quelle_typ IN ('beleg','rechnung','kasse')`, nichtleere `quelle_id` und leeres
`storno_von`. Auch ein später storniertes Original bleibt unter diesem Index.
Der Index ersetzt weder Guards noch Transaktion. Vorhandene Dubletten werden
nicht für die Migration automatisch gelöscht oder fachlich umgebucht.

`zahlung` bleibt ausgenommen: Eine Zahlung kann mehrere Steuerstaffel-Zeilen haben.
`storno` bleibt ausgenommen: Jede zulässige Gegenbuchung referenziert ihr konkretes
Original. Ein allgemeiner Unique-Index auf allen Journalquellen wäre falsch.

Der gemeinsame `festschreibenBuchung`-Pfad für manuelle, Zahlungs- und Stornozeilen
muss ebenfalls Nummernlesen und INSERT transaktional ausführen, damit alte
`max+1`-Writer nicht weiter konkurrieren. Die Steuerstaffelberechnung bleibt in
Next. Die gesamte Zahlung samt Bank-Match und Rechnungsstorno wird dadurch noch
nicht automatisch atomar; diese weitergehenden Vorgänge sind keine versteckte
Zusatzfreigabe dieser Session. Ihre zulässigen Mehrfachzeilen gehören zur Regression.

## Idempotenzstrategie

Für **Beleg und Rechnung** genügt der natürliche Schlüssel
`(firma, Vorgangsart Festschreibung, Quell-ID)`. Eine Quelle kann nur einmal erstmals
festgeschrieben werden. Ein zusätzlicher UUID-Record oder ein dauerhaftes
Vorgangsprotokoll ist dafür unnötig. Die vorhandenen endgültigen Felder bilden die
Quittung und bleiben nach Storno oder Zahlung erhalten.

Ein Retry prüft vor dem Entwurfsguard, ob Nummer, Zeitstempel und Journalverknüpfung
vollständig vorhanden sind und zusammenpassen. Bei Rechnung gehört der gespeicherte
PDF-Verweis dazu. Status allein genügt nicht. Bei unvollständigem Altzustand gibt es
einen Konsistenzfehler, keine zweite Festschreibung. Bei vollständigem Zustand wird
das ursprüngliche Ergebnis als `replayed` zurückgegeben, ohne erneutes Rendering
oder Speichern. Der Retry muss weiterhin autorisiert sein.

Für **Kasse** fehlt eine Quell-ID vor der ersten Anlage. Vorschlag für eine spätere
kleine Migration: `vorgang_id` und `eingabe_hash` am Kassenrecord, Unique auf
`(firma, vorgang_id) WHERE vorgang_id != ''`. Altrecords dürfen leere Werte behalten.
Der Hash umfasst die normalisierte fachliche Eingabe, einschließlich des festgelegten
Datums, Kontakts und der Kategorie, nicht die erst erzeugte Nummer oder Uhrzeit.

Die UUID wird vor dem ersten Submit erzeugt und über Doppelklick, Transport-Retry
und Fehleranzeige behalten. Der gegenwärtige Redirect nach `/neu?error=…` darf sie
nicht verlieren. Minimal als persistenter Formularvorgang im Browser samt
normalisiertem Eingabestand und Firmenbindung halten, etwa in sessionStorage.
Nach unbekanntem Ausgang wird zuerst dieser Vorgang wiederaufgenommen; eine neue
fachliche Erfassung bekommt ausdrücklich eine neue UUID. Eine bei jedem Action-Aufruf
neu erzeugte UUID löst das Problem nicht. Ein bloßer Eingabe-Hash als Schlüssel
wäre ebenfalls falsch, weil zwei absichtlich identische Barvorgänge möglich sind.

In der Transaktion gilt: gleiche UUID und gleicher Hash liefern dieselbe Quittung;
gleiche UUID mit anderem Hash ergibt `IDEMPOTENCY_CONFLICT`; neue UUID erzeugt
genau einen Record samt Journal. Kassenstorno kann den natürlichen Schlüssel aus
Original-ID und Vorgangsart nutzen, da nur ein Storno des Originals zulässig ist.

Bei Timeout, Verbindungsabbruch oder unklarem 5xx prüft Next den gespeicherten
Vorgang und wiederholt gegebenenfalls **mit demselben Schlüssel**. Der zweite
PB-Aufruf serialisiert mit einem noch laufenden ersten. Eine vorläufig nicht
gefundene Quittung ist keine Erlaubnis, einen neuen Schlüssel zu vergeben.
Begrenzte Wiederholung, danach „Ausgang noch unklar“ mit fortsetzbarem Vorgang.

Auch `runInTransaction` kann nach einem Commit durch einen After-Hook einen Fehler
zurückgeben. Daher niemals allein aufgrund eines Fehlers Gegenbuchungen, Deletes
oder eine zweite Festschreibung auslösen.

## PDF-/Dateistrategie und Fehlerfälle

Empfohlen wird **native FileField-Speicherung des vorbereiteten PDFs im Callback**,
keine separate temporäre Collection. `findUploadedFiles('pdf')` liefert PB-Dateiobjekte,
die dem innerhalb der Transaktion geladenen Rechnungsrecord zugewiesen werden.
Nicht ein HTTP-PATCH an die eigene PB-Record-API aus dem Callback senden: Das wäre
ein anderer Request und kann außerdem am gehaltenen Verbindungsslot hängen.

Das Rendering und der Netzempfang liegen außerhalb der Transaktion. Die lokale
Speicherkopie der begrenzten PDF-Bytes liegt innerhalb; ganz ohne Datei-I/O im
Callback geht dieser minimale Ablauf nicht. Bestehendes Maximum 15 MiB, zusätzliche
Requestgrenze samt Metadaten und passende Timeouts festlegen. Keine unbeschränkten
Uploads, keine SMTP-/Logo-Downloads oder PDF-Generierung bei gehaltenem Slot.

| Fehlerzeitpunkt | Erwarteter Zustand |
|---|---|
| Lesen, Rendern oder Multipart-Empfang scheitert | Noch kein fachlicher Write, kein Zählerverbrauch. |
| Verbindliche Daten-/Nummernprüfung scheitert | Vollständiger DB-Rollback, PDF wird nicht als Original veröffentlicht. |
| Datei ungültig, Schreiben/Close/Rename schlägt fehl | Save schlägt fehl; Callback muss Fehler weiterreichen, Nummer, Journal und Abschluss rollen zurück. Unreferenzierte temporäre/Teil-Dateien können bei zusätzlichem Bereinigungsfehler verbleiben. |
| Datei geschrieben, nachfolgender DB-Schritt oder Commit scheitert | DB rollt zurück; PB versucht Datei-Cleanup. Kein wirksames Journal, aber physische Restdatei möglich. |
| Commit erfolgreich, Antwort oder After-Hook scheitert | Erfolgreiche Quittung bleibt lesbar; derselbe Vorgang wird als Erfolg wiedererkannt. |
| PB-Prozess endet vor Commit | SQLite kann die uncommitted DB-Änderungen verwerfen; Dateireste werden nicht garantiert bereinigt. |
| Stromausfall oder Speicherausfall | Keine zugesagte gemeinsame Dateisystem-/DB-Dauerhaftigkeit; vorhandenes `synchronous(NORMAL)` und fehlendes Datei-fsync sind keine Grundlage für eine stärkere Garantie. |

Jeder neue Upload verwendet einen neuen PB-Dateinamen. Ein existierendes Original
wird nicht ersetzt. Neue PDF-Bytes nicht durch selbst gewählte Pfade in alte
Dateien schreiben. Die geschützte FileField-API bleibt erhalten; Downloads prüfen
weiterhin Firma und Festschreibungszustand in Next und verwenden serverseitige Tokens.
Damit werden unreferenzierte neue Dateien nicht zum abrufbaren Rechnungsoriginal.

PocketBase besitzt bereits einen temporären lokalen Dateischritt. Eine zusätzlich
vorgelagerte Staging-Collection würde Referenzübernahme, Schutzregeln, Ablaufzeiten
und Cleanup erfordern und dieselbe Crashgrenze nicht beseitigen. Sie ist erst bei
nachgewiesen zu langen Speicherzeiten oder einem geänderten Storage-Ziel zu bewerten.
Ein Umzug zu S3 wird von der lokalen Dateiaussage ausdrücklich nicht abgedeckt.

Für Restdateien genügt als spätere Betriebsmaßnahme zunächst ein Offline-Abgleich
mit DB-Dateireferenzen. Keine pauschalen Deletes im HTTP-Fehlerpfad. Eine Bereinigung
darf nur nachgewiesen unreferenzierte Dateien betreffen und keine laufenden Uploads.
Das ist keine automatische Reparatur bestehender Finanzdaten.

## Konkurrierende Änderungen und Festschreibungsimmutability

Die drei neuen Abschlussoperationen allein reichen nicht. Ein alter Entwurfswriter
kann vor der Festschreibung lesen und erst danach seinen PATCH oder DELETE senden.
Ein erneuter Guard nur im Abschluss verhindert diesen nachträglichen Write nicht.

Minimal notwendiger Begleitumfang je Stufe:

- Beleg-Update, Löschen und Dateiänderung prüfen den aktuellen Entwurf **in derselben
  PB-Transaktion wie ihre Mutation**. Das bestehende Speichern von Metadaten und
  hinzugefügten Dateien wird als zusammengehöriger Entwurfssave gebündelt.
- Rechnungskopf und Positionsersatz werden gemeinsam gespeichert. Auch Anlage und
  Löschen des Entwurfs dürfen keine halb ersetzte Positionsmenge zur Festschreibung
  freigeben. Der aktuelle `replacePositionen`-Loop über separate Requests entfällt
  an diesen Schreibstellen. Validierte Positionswerte liefert weiterhin Next.
- Diese Finanzrecords dürfen außerhalb der definierten Operationen keine Änderung
  geschützter Felder erhalten. Eng begrenzte Record-Hooks im selben PB-Modul sperren
  Umgehung per generischem CRUD, auch bei Superuser-Requests aus Next. Die Operation
  nutzt einen internen, transaktionsgebundenen Kontext: PB 0.39.10 bindet
  `new Context(parent, key, value)` sowie `saveWithContext` und `deleteWithContext`.
  Die Route setzt darin nach ihren Prüfungen die erlaubte Operation, Firma und
  Record-IDs. Der Record-Hook prüft `e.app.isTransactional()` und diesen internen
  Kontext. Kein vom HTTP-Body oder Header übernehmbares `skipGuard` und kein
  globales Boolean während eines Requests. [Context-Binding](https://github.com/pocketbase/pocketbase/blob/v0.39.10/plugins/jsvm/binds.go#L412-L431).
- Die Rechnungsfelder für Inhalt, Nummer, Journalverweis, Datum der Festschreibung
  und PDF bleiben nach Abschluss gesperrt. Zulässige spätere Zahlungs-/Stornostatus
  bleiben über definierte Pfade möglich; nicht jeden Record-PATCH pauschal verbieten.
- Relationseffekte zählen ebenfalls als Writes: Kontakt- oder Firmenlöschungen
  dürfen keine festgeschriebenen Quellen, Positionen oder Journalbezüge still
  verändern. Guards müssen solche indirekten Änderungen ablehnen. PB verwendet
  bei Cascades `Delete` und beim Leeren optionaler Relationen `SaveNoValidate`.
  Deshalb an den Record-Schreib-/Delete-Hooks schützen, nicht nur in der
  Feldvalidierung oder im HTTP-Request-Hook. [Cascade-Code](https://github.com/pocketbase/pocketbase/blob/v0.39.10/core/record_model.go#L1576-L1625).
  Die tatsächliche Abdeckung wird vor Freigabe mit echtem PB geprüft. Ein fehlender
  interner Kontext darf nie das Ändern eines festgeschriebenen Records erlauben.

Das Modul bleibt eine zentrale Persistenzimplementierung, keine Sammlung fachlicher
Hooks in vielen Collections. Falls die benötigte interne Kontextübergabe oder
Cascade-Abdeckung mit PB-JS nicht sicher nachgewiesen werden kann, ist dies ein
Abnahmeblocker; nicht mit ungeprüften globalen Flags umgehen.

## Vorschlag zur kleinsten ADR-0006-Änderung

Titelvorschlag: **Finanz-Schreibzugriffe über Next, atomare Persistenz in PocketBase**.
Den bisherigen Absatz durch folgenden Text ersetzen, erst nach Entscheidung:

> Öffentliche Finanz-Schreibzugriffe laufen ausschließlich über Next.js Server
> Actions, Route Handlers und Domain-Services. Next authentifiziert und autorisiert
> den Vorgang, validiert Eingaben und übernimmt fachliche Vorbereitung sowie
> PDF-Erzeugung. PocketBase-API-Rules sperren direkte Client-Schreibzugriffe.
> Für Festschreibungen und ihre gemeinsam geschützten Zustände verwendet Next eine
> interne, eng definierte PocketBase-Transaktionsoperation. Diese prüft den aktuellen
> Firmen-, Berechtigungs- und Quellzustand, vergibt Nummern und speichert Journal
> und Quelle in einer gemeinsamen Datenbanktransaktion. Konkurrierende Mutationen
> derselben geschützten Zustände verwenden dieselbe Persistenzgrenze. PocketBase
> erhält nur die dafür erforderliche Prüf- und Persistenzlogik. PDF-Rendering und
> externe Kommunikation erfolgen außerhalb der Transaktion. Wiederholte Vorgänge
> erkennen einen bereits committed Abschluss. Dateien verwenden weiterhin
> PocketBase-FileFields; Datenbank-Rollback und Dateibereinigung sind keine gemeinsame
> Dateisystemtransaktion. Ihre Fehler- und Wiederanlaufgrenzen sind dokumentiert.

Begründung ergänzen: Mehrere Next-zu-PB-Requests erfüllen die bisher verlangte
Atomarität nicht. Eine einzelne serverseitige Transaktion ist erforderlich.
ADR-0012 bleibt mit unveränderbaren Originalen und PocketBase-Dateispeicherung gültig.
ADR-0016 verlangt die Decimal-Bibliothek auch bei der verbindlichen Saldo-Prüfung.

## Betroffene Dateien und ungefährer Umfang

Alle folgenden Änderungen sind **geplant**, hier nicht ausgeführt.

| Dateien/Bereich | Vorgesehene Änderung |
|---|---|
| Neu: `pocketbase/pb_hooks/finanz.pb.js`, wenige gemeinsame Hilfsdateien | Feste interne Routen, Transaktionscallbacks, Nummern/Journal, Snapshot-/Idempotenzprüfung, zentrale Mutationsguards. PB-JS-geeignete Decimal-Datei mit Lizenz und gebundener Version. Kein Go-Backend. |
| `pocketbase/Dockerfile`, gegebenenfalls `entrypoint.sh` | Hooks ins Image kopieren; Hooks-Verzeichnis explizit und reproduzierbar laden. PB-Version unverändert. |
| Neu: nächste passende Datei in `pocketbase/pb_migrations/` | Partieller ursprünglicher Journalquellenindex nach Audit; in der Kassenstufe zwei Idempotenzfelder und partieller Index. Bestehende Migrationen nicht umschreiben. |
| Neu: `app/src/lib/finanz-transaktion.ts` | Kleiner Transportadapter, typisierte Quittungen/Konflikte, sichere Wiederholung. |
| `app/src/lib/pb.ts`, Nummernkreis-Tests | Bestehende endgültige Allocator-Requests ersetzen/überführen; Kandidatensuche ohne Write; Firma-JSON nicht blind ersetzen; vorhandene Formatter/Defaults erhalten. |
| `expenses/repository.ts`, gegebenenfalls `actions.ts`, benachbarte Tests | Abschluss auf Operation umstellen; Entwurfssave/Dateiänderung/Löschen verbindlich absichern. |
| `sales/repository.ts`, `dokument-layout.ts`, benachbarte Tests | Erwarteten PDF-Stand erfassen; Nummernkandidat/Render/Commit; vollständige Positionen; atomare Entwurfswrites. Renderer weitgehend unverändert. |
| `cash/repository.ts`, `actions.ts`, `kassenbuch-form.tsx`, `/app/kassenbuch/neu/page.tsx` | Anlage und Storno transaktional; stabile Formular-Vorgangs-ID und Wiederaufnahme; tatsächliche ID für Saldo. |
| `journal/repository.ts`, benachbarte Tests | Gemeinsame transaktionale Journalnummernvergabe, zulässige Quelltypen, Storno-/Zahlungsregression. |
| `platform/firma-actions.ts`, `firma-form.tsx`; gegebenenfalls Kontakt-/Angebotsaufrufer | Konfigurationsänderungen gezielt und konfliktgeprüft übermitteln; alle gemeinsamen Zählerwriter auf neuen Helfer umstellen. |
| `app/src/lib/festschreibung.integration.test.ts`, `scripts/test-festschreibung-isolated.mjs` | Testumgebung lädt reale Hooks; Fehlerbarrieren an neue Persistenzgrenze anpassen; neue Akzeptanzfälle. Historische Charakterisierung erhalten. |
| `docs/adr/0006-…`, `docs/entwicklung.md`, `docs/testphase.md`, `docs/betrieb.md` | Entscheidung, Abnahmestand, Hook-Betrieb und Datei-/Retrygrenzen nach Umsetzung dokumentieren. |

Größenordnung: ein kleines zusätzliches PB-Modul und ein Next-Adapter, etwa
12–20 bestehende Code-/Testdateien plus Teststarter und Dokumentation, einige neue
Hook-/Schema-/Testdateien. Kein Dreifunktions-Patch: Der Aufwand steckt in der
Absicherung konkurrierender Writer und in aussagekräftigen Fehlertests. Die genaue
Zeilenzahl ist vor Festlegung der Hook-Guards nicht belastbar.

## Implementierungsreihenfolge und Abnahme

Die gewünschte Reihenfolge **Beleg → Rechnung → Kasse** ist sinnvoll. Beleg prüft
die gemeinsame Persistenz ohne neue Datei und ohne Saldo. Rechnung ergänzt den
optimistischen PDF-Ablauf. Kasse ergänzt Neuanlage, Idempotenz und Saldochronologie.
Die Kassen-Serialisierung ist durch den Quellcode erklärbar; ihren isolierten
Concurrency-Nachweis sollte man dennoch schon beim ersten Infrastrukturtest führen.

1. Belegstufe einschließlich interner Route, gemeinsamer Nummern-/Journalhelfer,
   aller JSON-Writer und Beleg-Entwurfs-/Dateiguards. Vor neuen Constraints
   Read-only-Audit des Zielbestands; keine automatische Altfehlerkorrektur.
2. Rechnungsstufe einschließlich atomarer Entwurfs-/Positionswrites, Kandidat und
   Snapshotvergleich, Multipart-Rollback, Dateischutz und PDF-Inhaltsvergleich.
3. Kassenstufe einschließlich Kassenstorno und stabiler Vorgangs-ID vom Formular
   bis zur gespeicherten Quittung.

Zwischenstufen dürfen nur die tatsächlich umgestellten Vorgänge als korrigiert
ausweisen. Alte Next-Versionen dürfen nicht parallel weiter die umgestellten
Collections beschreiben. Hook- und Next-Änderung zusammen ausrollen; ein fehlendes
Hook-Modul führt zu einem klaren Fehler, nicht zum Rückfall auf unsichere Requests.

Die vorhandenen 43 Charakterisierungsfälle bleiben Referenz. Viele erwarten heute
absichtlich defekte Teilzustände; sie können nicht unverändert zum grünen
Abnahmetest werden. Historische Erwartungen erhalten, im Akzeptanzpfad auf neue
Invarianten umstellen. Die bisherigen HTTP-Barrieren zwischen Zähler-, Journal-
und Abschlussrequests existieren nach dem Umbau nicht mehr. Fehler werden im
isolierten Testbestand an den Save-/Commit-Stellen der echten PB-Operation injiziert,
ohne Produktions-Fehlerflags oder erfundene Erfolgsantworten.

Zusätzliche verbindliche Abnahmefälle:

- Fehler nach jedem internen DB-Write hinterlässt keine Nummer, kein Journal und
  keinen teilweise abgeschlossenen Quellrecord.
- Zwei Abschlüsse derselben Quelle ergeben einen Commit und dieselbe Replay-Quittung;
  verschiedene Quellen erhalten verschiedene endgültige Nummern.
- Parallelität zwischen allen Kreisen und Firmeneinstellung bewahrt jeden anderen
  Zähler und erkennt veraltete Konfigurationsänderungen.
- Entwurfsupdate, Löschen, Dateiänderung und Positionsersatz gegen Festschreibung
  sowie Kontakt-/Firmenlöschung verändern nach Abschluss keine geschützten Daten.
- Geänderte Rechnungspositionen, Kundendaten, Firma, Bankauswahl oder Nummernkandidat
  verhindern den Commit des veralteten PDFs; PDF-Nummer und GiroCode passen zum Record.
- Verlorene Antwort nach Commit, auch bei noch laufendem ersten Request, liefert
  nach Wiederholung genau dieselben IDs, Nummern und Dateireferenz.
- Kasse 100 / zweimal 80 erlaubt nur eine Entnahme; rückdatierte Einträge und Storno
  halten jeden chronologischen Zwischenstand nichtnegativ. Gleiches Datum mit
  tatsächlicher ID-Sortierung ausdrücklich testen.
- Kassen-UUID mit identischer Eingabe replayt, mit anderer Eingabe kollidiert;
  absichtlich identische neue Buchung mit neuer UUID bleibt möglich. Reload und
  Fehler-Redirect dürfen die offene Vorgangs-ID nicht verlieren.
- Echter ungültiger Dateiupload, kontrollierter Schreib-/Renamefehler und Prozessende
  vor/nach DB-Commit im isolierten Bestand. DB-Quittung und Dateireferenzen getrennt
  von physischen Restdateien auswerten; After-Hook-Fehler nach Commit berücksichtigen.
- Firmenisolation, Lesen-Rolle, direkter Zugriff auf interne Operationen, geschützte
  Originale und alte Dateilinks behalten ihre bisherigen Schutzregeln.
- Mehrere Zahlungsstaffeln und ihre einzelnen Gegenbuchungen bleiben zulässig;
  ursprüngliche Rechnungsforderung bleibt genau eine Zeile.

Die isolierte Testumgebung muss das Hook-Verzeichnis tatsächlich laden. Der heutige
Starter setzt `--hooksDir=/tmp/pb_hooks`; ohne Anpassung würde er die neue Lösung
gar nicht prüfen. Für Dateifehler genügen die bisherigen tmpfs-Tests allein nicht.
Nach fachlicher Umsetzung folgen passende Modultests, Gesamtsuite, Typecheck und
gezieltes Lint; die bestehenden Testergebnisse sind kein Nachweis des neuen Entwurfs.

## Offene Risiken und Go/No-Go

**Go zur Umsetzung des Belegschritts auf dieser Grundlage, nach ausdrücklichem
Implementierungsauftrag. Kein Go für Produktivfreigabe des ungeprüften Entwurfs.**

Vor Freigabe der jeweiligen Stufe zu schließen:

- Interne Transaktionskontexte und Mutationsguards einschließlich Relationseffekten
  in PB-JS 0.39.10 durch echte Integrationstests nachweisen.
- Bestandsaudit vor Unique-Index und vor Nutzung vorhandener Quellen als Quittung.
  Die bisherigen synthetischen Funde sagen nichts über vorhandene Produktivfehler.
- Uploaddauer, Dateifehler und Wiederholung nach unbekanntem Commit-Ausgang testen.
  Alle anderen Firmen warten ebenfalls auf den einen Schreibslot.
- Browser-Wiederaufnahme der Kassen-ID bis einschließlich Reload/Fehlerpfad festlegen
  und testen. Die ID darf nicht mit einer gewöhnlichen neuen Formularanzeige wechseln.
- Gemeinsame Nummernkreiswriter vollständig umstellen und alte Schreibversionen beim
  Rollout ausschließen. Sonst ist der Schutz gegen verlorene JSON-Änderungen falsch.

Die verbleibende Produktentscheidung ist die ausdrücklich dokumentierte Datei-
und Dauerhaftigkeitsgrenze. Wird eine vollständig gemeinsame DB-/Dateisystem-
Rollback- oder Stromausfallgarantie verlangt, lautet das Ergebnis für diesen
minimalen Ansatz **No-Go**. Option 2 liefert diese Garantie ebenso wenig. Dann
ist vor Umsetzung ein gesonderter Speicher-/Recovery-Entwurf erforderlich;
eine Staging-Collection oder aktiviertes Batch allein lösen das nicht.
