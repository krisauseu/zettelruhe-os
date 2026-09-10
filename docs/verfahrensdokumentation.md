# Verfahrensdokumentation (Vorlage) — Zettelruhe

_GoBD-Mindeststandard light (ADR-0004). Keine externe Zertifizierung.  
Anpassungen an den eigenen Betrieb sind Pflicht der betreibenden Person._

## 1. Zweck und Geltungsbereich

Diese Vorlage beschreibt, wie in **Zettelruhe** (self-hosted) Belege, Buchungen und
Auswertungen für eine Solo-Firma in Deutschland geführt werden. Sie ist als
Ausgangspunkt für die individuelle Verfahrensdokumentation gedacht.

| Punkt | Inhalt v1 |
|-------|-----------|
| System | Zettelruhe (Next.js + PocketBase/SQLite) |
| Nutzerkreis | Instanz-Eigentümer:in plus eingeladene Nutzer:innen mit grober Rolle je Firma |
| Steuerziel | EÜR; USt- und ZM-Übersicht bei Regelbesteuerung/Ist; begrenzte RC-USt-Übersicht auch unter § 19 |
| Standort Daten | Volume `zettelruhe_pb_data` (Docker Compose) bzw. konfigurierter PB-Datenpfad |

## 2. Verantwortlichkeiten

- **Instanz-Eigentümer:in**: Betrieb, Backup, Setup, weitere Firmen anlegen.
- **Eigentümer:in der Firma**: Firmeneinstellungen, Einladen, inhaltliche Richtigkeit der Buchungen.
- **Bearbeiten / Lesen**: Alltag schreiben bzw. nur sehen (ADR-0025).
- **System**: Erzwingt Festschreibung (keine stillen Änderungen an Journal/Belegdateien),
  firmengebundene Datentrennung im Schema, Zugang nur mit Mitgliedschaft, Exporte nur für authentifizierte Session.

## 3. Beleg- und Buchungsprozess (Überblick)

1. **Stammdaten**: Firma inkl. Steuer-Modus (Kleinunternehmerregelung oder Regelbesteuerung/Ist-Versteuerung).
2. **Belege**: Entwurf mit optionaler Datei → **Festschreibung** → Journal-Eintrag + Belegnummer; Datei danach immutable.
3. **Rechnungen**: Entwurf → Festschreibung → Rechnungsnummer, PDF, Forderungsbuchung im Journal (`quelle_typ=rechnung`).
4. **Kassenbuch**: Anlegen = Festschreibung → Journal; Korrektur nur Storno/Gegenbuchung.
5. **Manuelle Journal-Buchung**: Anlegen = Festschreibung.
6. **Storno**: Gegenbuchung mit Verweis `storno_von`; Original bleibt erhalten. Rechnungs-Storno storniert auch die Zahlungsjournale.
7. **Zahlungen**: Manuell oder per Bank-Match; erzeugen eine Zufluss-Buchung (`quelle_typ=zahlung`, Buchungsdatum = Zahlungsdatum). Teilzahlungen anteilig nach Steuerstaffel. Löschen storniert die Zufluss-Buchung (ADR-0024).
7a. **Bank-Import**: CSV (de-DE) oder klassisches SWIFT-MT940/STA je aktivem Bankkonto der Session-Firma. Idempotenz über SHA-256; Re-Import derselben Zeile legt keine zweite Bewegung und keine zweite Zahlung an. `:25:` mit IBAN muss zum gewählten Konto passen. Match nur nach Bestätigung in der UI (ADR-0028).
8. **E-Rechnung Empfang**: Original archivieren → Parse (XRechnung-UBL, CII-XML, PDF-Anhang auch Flate) → optional Beleg-Entwurf → Festschreibung wie Beleg. Scan-PDF ohne Anhang: Parse-Fehler, Original bleibt, Beleg manuell (ADR-0029).
9. **E-Rechnung Versand**: aus festgeschriebener Rechnung XML (XRechnung-UBL oder ZUGFeRD-CII) erzeugen und unveränderbar ablegen; Rechnungs-PDF bleibt unangetastet. Kein Hybrid-PDF/A-3, kein Zertifizierungs-Claim (ADR-0026: Hybrid erst mit eigener PDF/A-3-Pipeline).
10. **USt-IdNr.**: eigene an der Firma, fremde am Kontakt; BZSt-Bestätigung auf Klick als unveränderlicher Schnappschuss (kein Stamm-Stempel, keine Änderung festgeschriebener Belege).

### Reverse Charge: im Code freigegeben

Die gesonderte [RC-Umsetzung](reverse-charge-umsetzung.md) ergänzt betriebliche
EU-/Drittlandsdienstleistungen in EUR. Am Beleg werden Behandlung, Leistungsabschnitt,
Zahlungsstatus/-datum und Vorsteuerberechtigung erfasst. Zahlbetrag, Buchungsdatum,
Firmenmodus und Standard-Nachweis werden im aktuellen Formular übernommen;
weitere Angaben liegen unter „Weitere steuerliche Details“. Die genaue Bedienung
und die Änderungen gegenüber dem ursprünglichen Plan stehen in der RC-Referenz. Lieferantenstandards sind
nur Vorschläge für neue Belege. Kontaktänderungen verändern bestehende Belege nicht.
Rechnungs-USt und Lieferantenzahlbetrag bleiben von der berechneten §-13b-Steuer getrennt.
Auch Kleinunternehmer können zusätzliche Steuerschuld haben; im unterstützten
KU-Fall besteht kein Vorsteuerabzug.

Nur eine vollständige Zahlung wird automatisch verarbeitet. Unbezahlte,
teilbezahlte und in mehreren Zahlungen ausgeglichene Fälle bleiben gesperrt.
Das verschiebt keine Erklärungspflicht; gegebenenfalls separat erklären.
Buchungsdatum ist das Abflussdatum, der Steuerzeitpunkt folgt dem gespeicherten
Leistungs-/Rechnungs-/Vorauszahlungsvertrag. Ein Entwurf ist keine Erklärung.

E-Rechnungen mit RC-Hinweisen werden zur manuellen Prüfung verwiesen und nicht
still als gewöhnliche 0-%-Belege übernommen. Nicht-EUR oder unbekannte Währung
sperren die Übernahme; das Original bleibt archiviert. Die Übernahme prüft das
Original erneut, auch bei älteren Parse-Daten. In der Kontaktverwaltung ist der
Ausgaben-Steuerstandard optional; das bestehende Kontakt-CSV enthält ihn noch nicht.

RC-Erfassungsfehler und vollständige Rückzahlungen erhalten unterschiedliche
Korrekturgründe, Datumsbezüge und Nachweise im Journal. Reporting und Exporte sind
lokal abgenommen, die öffentliche Verarbeitung ist im Code freigegeben. Es gibt
keine direkte ELSTER-Schnittstelle. Der XML-Download ist lokal; eine amtliche
XSD-/Plausibilitätsprüfung oder ein erfolgreicher Mein-ELSTER-Import ist nicht
nachgewiesen. Die Freigabe ist keine Bestätigung einer Abgabe. Der Betreiber hat am
2026-09-10 den Produktions-VPS-Test und Livebetrieb bestätigt; die frühere
ELSTER-Prüfsperre ist verworfen.

Beleg- und Rechnungsabschluss sowie Kassenanlage/-storno verbinden Quelle,
Journal und Nummernkreis in einer PocketBase-Datenbanktransaktion. Auch die
RC-Korrektur hat eine feste transaktionale Operation. Datenbank und Dateisystem
bilden keine gemeinsame ACID-Transaktion. Seit der lokalen Releasekorrektur vom
2026-09-10 committen auch Zahlung samt Steuerstaffeln/Status, Bankmatching samt
Zahlung und gewöhnlicher Rechnungsstorno samt Gegenbuchungen/Status jeweils in
einer festen PB-Datenbanktransaktion. Das Löschen einer Bankzahlung gibt die
Bankbewegung wieder zur Zuordnung frei. Historische Teiljournale werden bei
erkannter Abweichung abgewiesen und müssen gesondert geprüft werden.
Die frühere Produktionsbestätigung belegt nicht diese neuen Korrekturen. Siehe ADR-0006 und
[Entwicklung](entwicklung.md).

## 4. Unveränderbarkeit und Korrekturen

- Festgeschriebene Journal-Zeilen: kein Update/Delete über die Anwendung.
- Festgeschriebene Belegdateien und Rechnungs-PDFs: keine stille Ersetzung.
- Korrekturen: Storno/Gegenbuchung bzw. neuer Beleg/neue Rechnung — nachvollziehbar im Journal.

## 5. Auswertungen und Export

| Export | Inhalt | Hinweis |
|--------|--------|---------|
| EÜR light | Summen aus Journal nach Zufluss, Kategorien light | Beide Steuer-Modi; Rechnungs-Einnahmen mit Zahlungsdatum |
| USt-Übersicht | USt/Vorsteuer aus Journal; RC nach gespeichertem Steuerdatum | Regelbesteuerung; bei § 19 nur begrenzter RC-Arbeitsfall; kein ELSTER-Versand |
| UStVA / ELSTER-XML light | Kz 81/86/66/83 sowie RC 46/47, 84/85 und 67 | Self-File (`zettelruhe-ustva-elster-xml-light-v1`); nur 2026 Monat/Quartal; amtliche XSD-/Importkonformität nicht nachgewiesen; kein Versand |
| ZM-Übersicht | 0-USt-Einnahmen + Kontakt-Land + Stamm-USt-Id | Self-File (`zettelruhe-zm-uebersicht-v2`); Kandidaten, keine Art; USt-Id Stamm/Notiz/Schnappschuss, kein Versand |
| USt-IdNr. / BZSt | Eigene Nummer an der Firma, fremde am Kontakt | eVatR-REST-Schnappschuss (`ust_id_pruefungen`); kein Dauer-Stempel, kein Versand |
| E-Rechnung Versand | XML aus festgeschriebener Rechnung | Profile XRechnung-UBL / ZUGFeRD-CII (`e_rechnungen_versand`); kein Hybrid-PDF, kein KoSIT-Claim (ADR-0026) |
| DATEV light CSV | Journal-Zeilen EXTF-ähnlich | Format-ID `zettelruhe-datev-csv-light-v1`, **nicht** DATEV-zertifiziert; RC-Zeiträume werden vollständig abgelehnt |
| Journal-CSV | Alle Journal-Zeilen samt vollständigem RC-Schnappschuss | Semikolon, UTF-8 BOM |
| Belegarchiv-ZIP | Metadaten samt RC-Steuerdaten + Dateien festgeschriebener Belege | Zeitraum nach Belegdatum; Originaldateien unverändert |
| Kontakte/Katalog-CSV | Stammdaten | Bestehende Modul-Exporte |

Journal- und Belegexporte lesen alle Seiten. Fehlende referenzierte Dateien oder
inkonsistente Seiten verhindern den Export. Das Belegarchiv wird im Speicher
erzeugt und bricht bei mehr als 256 MiB summierter Dateinutzlast ab; dann den
Zeitraum verkleinern. Ein Export ersetzt kein vollständiges Volume-Backup.

Perioden und steuerliche Tagesgrenzen: **Europe/Berlin** (ADR-0016).

## 6. Datensicherung

Konkrete Befehle und Restore: [`docs/betrieb.md`](./betrieb.md).

| Punkt | Vorgabe v1 / Vorlage |
|-------|----------------------|
| Was | Volume `zettelruhe_pb_data` (SQLite + Dateien); plus `.env` separat |
| Wann | Täglich empfohlen; vor Updates und großen Importen extra |
| Wo | _[Aufbewahrungsort hier eintragen]_ |
| Prüfung | Restore mindestens jährlich testen und hier datieren: _[ ]_ |

Wiederherstellung nur aus geprüften Backups; nach Restore Login und Stichprobe Beleg/Journal.

## 7. Zugriffs- und Betriebssicherheit

- Authentifizierung über PocketBase-Nutzer; Next.js Session (httpOnly Cookie, `SameSite=Lax`).
- Finanz-Writes nur serverseitig über Next (nicht Client-direkt an PB für Finanzaggregate).
- Superuser-Zugangsdaten und `SESSION_SECRET` nur in `.env` / Host-Secret — nicht im Git.
- Production: HTTPS, keine Default-Secrets. PocketBase-Admin `/_/` auf dieser Instanz über denselben Host erreichbar (ADR-0023, explizit); Superuser stark, nicht mit dem App-Login der Eigentümer:in verwechseln.
- Details: [`docs/betrieb.md`](./betrieb.md) Abschnitte Secrets und Session.

## 8. Individuell zu ergänzen

- [ ] Konkrete Backup-Rhythmus und Aufbewahrungsort  
- [ ] Letzter erfolgreicher Restore-Test (Datum)  
- [ ] Verantwortliche Person / Vertretung  
- [ ] Hardware-/Hosting-Standort  
- [ ] Ablage gescannter Papierbelege außerhalb des Systems (falls vorhanden)  
- [ ] Steuerberater-Übergabeprozess (DATEV-Datei / Zeitraum)  

---

_Vorlagenstand: 2026-09-10, Codebasis `0842832`. Betriebliche Angaben und tatsächlich ausgeführte Kontrollen ergänzt die betreibende Person._
