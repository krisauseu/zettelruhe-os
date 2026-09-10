# Session 2026-08-12 — Bauabschnitt 11 (Bank-Import + Matching)

## Done

- PB-Migration `1730001000_bank_import.js`:
  - `bankkonten` — Stammdaten (name, iban, bic, aktiv, notiz; firma-gebunden)
  - `bank_import_laeufe` — Import-Lauf light (format csv|mt940, Dateiname, Zähler)
  - `bank_bewegungen` — Auszugszeilen (datum, richtung eingang|ausgang, betrag Text, Verwendungszweck/Gegenkonto/Referenz, status offen|gematcht|ignoriert, idempotenz_schluessel, Relation rechnung/zahlung)
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
  - Unique Index: `(firma, bankkonto, idempotenz_schluessel)`
- Modul `modules/banking` aus Skelett befüllt:
  - Bankkonto CRUD light
  - CSV-Parser de-DE (Delimiter `;`/`,`; Betrag Komma/Punkt; Vorzeichen = Richtung)
  - Import mit Idempotenz (SHA-256 über bankkonto|datum|richtung|betrag|VWZ|IBAN|Referenz)
  - Match-Score light (Betrag + Rechnungsnummer im Verwendungszweck) + Vorschläge
  - Matching → `payments.createZahlung` (Status-Ableitung wiederverwendet; **kein Journal**)
  - Ignorieren / wieder öffnen light
- UI:
  - `/app/bankkonten` Liste/Anlegen/Detail/Import
  - `/app/kontoauszug` Bewegungen + Match-UI (Vorschlag annehmen / manuell wählen / ignorieren)
  - Nav **Bankkonten**, **Kontoauszug**
- Unit-Tests: CSV, Betragszeichen, Idempotenz-Schlüssel, Match-Score, Bankkonto-Validierung — 186 gesamt grün
- `docker compose build` + `up`: Collections/Rules OK; App-Routen 307→Login

## Schema-Dokumentation (minimal)

| Collection | Zweck |
|---|---|
| bankkonten | Zahlweg-Stammdaten (≠ Kassenbuch) |
| bank_import_laeufe | Ein Import-Vorgang (Audit light) |
| bank_bewegungen | Eine Kontoauszugszeile; Match-Status |

**Idempotenz:** `idempotenz_schluessel` = hex(SHA-256(`bankkonto|datum|richtung|betrag|vwz_norm|iban_norm|referenz_norm`)). Re-Import derselben Zeile → Duplikat-Zähler, kein zweiter Datensatz, keine Doppel-Zahlung.

**CSV-Default-Vorlage:**
```text
Datum;Betrag;Verwendungszweck;Gegenkonto;IBAN;Referenz
12.08.2026;119,00;Rechnung R-0001;Muster GmbH;DE89…;R-0001
13.08.2026;-25,50;Lastschrift Hosting;Provider AG;;
```

## Explizit nicht / Follow-up

- **MT940:** Format-Enum vorbereitet; Parser v1 = CSV only → Follow-up
- PSD2 / FinTS / Live-Bank
- Silent-Auto-Match ohne UI-Bestätigung
- Journal bei Zahlung (bleibt Ist-Versteuerung Follow-up)
- Beleg-Matching heavy (optional light ausgelassen)
- Kassenbuch-Kopplung

## Next step

Bauabschnitt 12: E-Rechnung Empfang.

## Context snapshot

- Matching schreibt nur `zahlungen` + `rechnungen.status` + `bank_bewegungen` (status/rechnung/zahlung).
- PDF/Journal der Rechnung unverändert.
- Kassenbuch und Bankkonto strikt getrennt.
