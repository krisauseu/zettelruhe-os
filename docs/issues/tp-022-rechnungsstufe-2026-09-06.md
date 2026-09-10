# TP-022: Abnahme der Rechnungsstufe

Stand: 2026-09-06. TP-022 Stufe 2 ist lokal umgesetzt und vollständig geprüft.
Stufe 1, Beleg, bleibt abgeschlossen. Stufe 3, Kasse, bleibt offen.

## Ausgangsstand und Writer-Inventur

Basis war Commit `475040daf5849c0e488c1392a9f564d2e514c516` auf `main` mit
`origin/main` ohne Abweichung. Vor der Umsetzung war nur
`docs/Bericht_Test_VPS_06092026` unversioniert. Die Datei blieb unverändert und
wird nicht automatisch committet.

Vier Rechnungswriter mussten auf die feste PocketBase-Grenze wechseln:

- `createRechnung` legte Kopf und Positionen über getrennte Requests an.
- `updateRechnung` änderte den Kopf und ersetzte Positionen einzeln.
- `deleteRechnung` löschte Positionen und Kopf getrennt.
- `festschreibenRechnung` vergab Nummer, erzeugte Journal und speicherte das PDF
  in mehreren Schritten.

Angebots-, Zeit- und Fahrtübernahme verwenden bereits `createRechnung` und laufen
damit ohne Sonderweg über die neue Entwurfsoperation. Wiederkehrende Rechnungen
verwenden denselben Pfad mit einem firmengebundenen Systemakteur. Zahlungen,
Bank-Matching und Rechnungsstorno bleiben Regressionsteilnehmer. Vorschau,
Originaldownload, E-Rechnung, SMTP, Suche und Reporting bleiben nachgelagerte
Leser oder eigene Fachvorgänge.

## Umsetzung

Die internen, nur für PocketBase-Superuser erreichbaren Operationen wurden um
zwei feste Routen ergänzt:

- `POST /internal/zettelruhe/finanz/v1/rechnung/entwurf`
- `POST /internal/zettelruhe/finanz/v1/rechnung/festschreiben`

Die Entwurfsoperation legt Rechnung und vollständige Positionsmenge gemeinsam
an. Beim Update prüft sie die erwartete Projektion und ersetzt alle Positionen in
derselben Transaktion. Beim Löschen entfernt sie Positionen und Rechnung
gemeinsam. Ein inzwischen geänderter oder festgeschriebener Entwurf wird nicht
überschrieben.

Next rekonstruiert beim Abschluss die fachliche Rechnungsvalidierung aus den
gespeicherten Daten. Es vergleicht normalisierte Positionen und berechnete
Kopfsummen mit dem Bestand. Der in der Rechnung gespeicherte Steuermodus ist
dabei maßgeblich. Next lädt alle Positionen und aktiven Bankkonten vollständig,
bindet die verwendeten Firmen-, Kunden- und Layoutdaten an die erwartete
Projektion und rendert erst danach das PDF.

Der Nummernkandidat ist ein reiner Read. PocketBase bestimmt die freie Nummer in
der Transaktion erneut. Bei `NUMBER_CHANGED` lädt Next den gesamten Stand neu und
rendert neu, höchstens dreimal pro Benutzeraktion. `SOURCE_CHANGED` wird nicht
automatisch wiederholt.

PocketBase prüft Akteur, Mitgliedschaft, Firma, Entwurfszustand, vollständige
Kopf- und Positionsprojektion, PDF-relevante Stammdaten, Nummernkreiskonfiguration
und vorhandene ursprüngliche Rechnungsjournale erneut. In einer
`runInTransaction`-Operation werden danach verbunden:

- genau eine endgültige Rechnungsnummer,
- genau eine ursprüngliche Journalzeile mit `quelle_typ=rechnung`,
- Journalnummer und Rückverweis,
- Status `offen`,
- ein gemeinsamer UTC-Festschreibungszeitpunkt,
- das vorbereitete PDF im nativen PocketBase-FileField,
- genau ein Fortschritt des Rechnungsnummernkreises.

Die Quittung enthält Ergebnisart, Rechnungs- und Journal-ID, Rechnungs- und
Journalnummer, Zeitpunkt und den tatsächlich gespeicherten PDF-Dateinamen. Next
prüft diese Felder strikt. Bei unbekanntem Ausgang sendet es höchstens einen
zweiten Multipart-Request mit demselben Payload und denselben PDF-Bytes.

Ein vollständiger erneuter Aufruf liefert `replayed`. Er ändert weder PDF,
Nummer, Journal, Zeitpunkt, Zähler noch einen späteren zulässigen Status. Ein
unvollständiger Altzustand liefert `INCONSISTENT_STATE` und wird nicht repariert.

Record-Hooks sperren generische Writes auf Rechnungsentwürfe, festgeschriebene
Rechnungsinhalte, Nummer, Journalverweis, Zeitpunkt, PDF, Positionen und
ursprüngliche Rechnungsjournale. Statusfortschreibungen zwischen den bestehenden
Endstatuswerten bleiben erlaubt, wenn alle geschützten Felder unverändert sind.
Zahlungen und Rechnungsstorno wurden nicht atomarisiert.

Es gibt keine neue Migration und keinen neuen Unique-Index. Die Transaktion und
die Record-Guards reichen für den neuen Write-Pfad aus. Bestehende Daten wurden
nicht verändert oder automatisch korrigiert.

## Transaktions- und Dateigarantien

Die fachlichen Datenbankänderungen committen gemeinsam oder rollen vollständig
zurück. Das gilt für Entwurfsanlage, vollständigen Positionsersatz,
Entwurfslöschung und Rechnungsabschluss.

PocketBase-Datenbank und Dateisystem bilden keine gemeinsame ACID-Transaktion.
PocketBase speichert das PDF über das native FileField im transaktionalen
Record-Save und entfernt neue Dateien beim Rollback nach Möglichkeit. Bei einem
zusätzlichen Cleanup-Fehler kann eine physische, nicht referenzierte Restdatei
bleiben. Eine stärkere Dateigarantie wird nicht behauptet.

Ein fehlendes optionales Logo und eine leere Auswahl aktiver Bankkonten sind
reproduzierbare Fallbacks. Ein gesetztes, aber nicht ladbares Logo, ein
fehlgeschlagener Bankkonto-Read oder ein Rendererfehler brechen vor dem Commit
ab. Der Multipart-Endpunkt verlangt bei einem Entwurfsabschluss genau ein PDF
mit `application/pdf`, mindestens fünf Bytes und höchstens 15 MiB. Die
PocketBase-FileField-Validierung prüft den Inhalt zusätzlich.

## Verifikation

### Isolierte PocketBase-Akzeptanz

`node scripts/test-festschreibung-isolated.mjs` verwendet PocketBase 0.39.10,
einen leeren `tmpfs`-Bestand, echte Produktionshooks und getrennte
Fehlerinjektionsfixtures.

- Belegstufe: 29 von 29 Tests bestanden.
- Rechnungsstufe: 43 von 43 Tests bestanden.
- Historische Charakterisierung: 43 Tests bestanden, 2 erwartete Kassenfehler.
- Rechnungs- und Beleg-Akzeptanz gemeinsam: 72 von 72 Tests bestanden.

Die Rechnungsfälle prüfen normalen Abschluss, PDF-Inhalt und Hash, Replay,
verlorene Erfolgsantwort, alle DB-Write-Grenzen, FileField-Fehler, gleiche und
verschiedene Rechnungen parallel, drei fortgesetzte Nummernkonflikte,
rückwärts gesetzten Zähler, zwei Firmen, Source-Races, mehr als 200 Positionen,
Entwurfsrollback, Fremdbeziehungen, Rollenentzug, Steuervarianten und direkte
Superuser-Bypässe.

Der letzte gemeinsame Rechnungs-/Beleg-Lauf hatte vor der automatischen
Bereinigung folgenden synthetischen Bestand: 81 Firmen, 49 Kontakte, 53
Rechnungen, 258 Positionen, 32 Belege, 44 Journalzeilen und 44 Storage-Dateien.
Der gesonderte historische Lauf hatte 52 Firmen, 14 Kontakte, 14 Rechnungen, 14
Positionen, 16 Belege, 19 Kassenzeilen, 44 Journalzeilen und 18 Storage-Dateien.
Beide Container samt `tmpfs` wurden entfernt.

Die zwei erwarteten Fehler gehören ausschließlich zu TP-022 Stufe 3:

- Ein fehlgeschlagener finaler Kassen-Write kann ein aktives Journal
  hinterlassen.
- Zwei konkurrierende Auszahlungen können auf Basis veralteter Salden einen
  negativen Kassenbestand erzeugen.

### Fachmodule und Gesamtsuite

- Sales, PDF, Journal, Payments, Banking, E-Invoice, Reporting und Expenses:
  423 von 423 Tests bestanden.
- Vollständige Vitest-Suite: 629 Tests bestanden, 117 isolierte Tests ohne ihren
  sicheren Starter übersprungen.
- TypeScript: `tsc --noEmit --incremental false` bestanden.
- Gezieltes ESLint: keine Fehler. Es bleibt eine bereits vorhandene Warnung für
  eine unnötige `no-var`-Unterdrückung in `modules/jobs/runner.ts`.
- Syntaxprüfung aller geänderten PB-Hooks, Fixtures und des Starters: bestanden.
- `git diff --check`: bestanden.

Vitest meldet weiterhin, dass `vitest.config.ts` ESM-Syntax in einer als CommonJS
geladenen Datei verwendet. Der Next-Build meldet weiterhin die veraltete
`middleware`-Konvention. Beide Hinweise bestanden vor dieser Stufe und wurden
nicht in TP-022 umgebaut.

## Deploymentnaher lokaler Docker-Smoke

Next und PocketBase wurden mit `docker compose build --pull --no-cache next
pocketbase` aus dem aktuellen uncommitteten Worktree gebaut.

- Next-Image: `8837d1e4ebff789ee70eb9d60a02a62ba41a20863802d95b00895f77d3d86326`
- PocketBase-Image: `bed062ffb63f4dfce27754e3699141a9c0a24734f0d61d0c4869253c29e94129`
- Beide Image-Metadaten: `arm64`
- PocketBase-Binary: 0.39.10
- `finanz.js`: `9f6ae953822e14dc81f7953defbef90ed4875850cf16b8a224ca8a9af2118e74`
- `finanz.pb.js`: `d93c3541cc2d0cf085bb75381391a37340d865cfbc7af819e70ea2a24e477878`

Die beiden Hook-Hashes waren im Image und im Worktree bytegleich. Der Smoke lief
mit zwei eigenen Containern, eigenem Netz und leerem `tmpfs`; das vorhandene
`zettelruhe_pb_data` wurde nicht eingebunden.

Über den echten Next-Pfad wurden ein Entwurf angelegt, neu geladen, geändert und
als Vorschau-PDF gelesen. Der Abschluss erhielt `R-0001`, Journalnummer 1,
Status `offen`, einen gemeinsamen Zeitpunkt und 120,00 Euro Brutto. Das über
Next geladene Original begann mit `%PDF-`, enthielt `R-0001` und hatte den
SHA-256-Wert `dad0d75b68c394ed0200be4920d97f3153cad851e2358720848104aea897fd11`.
Der anonyme PB-Dateizugriff lieferte 404.

Der zweite Abschlussaufruf ließ PDF-Hash, Dateiname, Journalanzahl 1 und
Zählerstand 2 unverändert. Direkte Superuser-Versuche für Rechnungsupdate,
Rechnungslöschung, Positionsupdate und Positionslöschung lieferten jeweils HTTP
400 mit `MUTATION_FORBIDDEN`. Eine zweite Rechnung erhielt `R-0002` und
Journalnummer 2. Der Rechnungszähler stand danach auf 3.

Die Endbilanz bestand aus einer Firma, einem Kontakt, einem Bankkonto, zwei
Rechnungen, zwei Positionen, zwei ursprünglichen Rechnungsjournalen, keiner
Zahlung und zwei PDF-Dateien samt Metadaten. Es gab keine doppelte ursprüngliche
Rechnungsquelle.

Beim ersten Formularversuch war der Smoke-`Origin` fälschlich `localhost`, der
weitergeleitete Host aber `127.0.0.1`. Next brach diesen Request wie vorgesehen
mit einem 500er `Invalid Server Actions request` ab. Nach Korrektur des Origin
liefen alle fachlichen Requests ohne weiteren 500er. Next warnte erwartungsgemäß
vor HTTP ohne Secure-Cookie; PocketBase meldete keine Hook- oder Laufzeitfehler.

Die Smoke-Container und ihr Netz wurden entfernt. Der vorhandene Standard-Stack
blieb durchgehend auf seinen bisherigen Image-IDs aktiv und ist gesund.

## Freigabe und verbleibende Grenzen

Für Commit und Push der Rechnungsstufe lautet das technische Ergebnis **Go**.
Commit und Push wurden nicht ausgeführt.

Für einen späteren Test-VPS-Build aus einem freigegebenen Commit lautet das
Ergebnis **Go**. Diese Session hat keinen VPS kontaktiert und nichts deployt.

Für ein Produktivdeployment lautet das Ergebnis noch **No-Go**. Vorher ist ein
ausschließlich lesender Audit des echten produktiven Rechnungsbestands nötig.
Er muss mindestens doppelte ursprüngliche Rechnungsjournale, unvollständige
Abschlüsse, falsche Firmen- und Quellenbezüge, Nummerndubletten, Journalrückverweise
und vorhandene PDF-Dateireferenzen prüfen. Der frühere Produktionsaudit deckte
die Belegstufe ab, nicht automatisch Rechnungen. Ein lokaler oder Test-VPS-Smoke
ersetzt diesen Audit nicht.

TP-022 Stufe 3 bleibt auf Kassenanlage, Kassenfestschreibung und Kassenstorno
begrenzt. Rechnungszahlungen und Rechnungsstorno gehören weiterhin nicht zur
Atomaritätsgarantie dieser Stufe.
