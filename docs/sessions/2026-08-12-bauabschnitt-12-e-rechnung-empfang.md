# Session 2026-08-12 — Bauabschnitt 12 (E-Rechnung Empfang)

## Done

- PB-Migration `1730001100_e_rechnung_empfang.js` — Collection `e_rechnungen_empfang`
  - firma-gebunden; `original_datei` (PB-Files, 15 MiB, XML/PDF); geparste Felder separat (`geparst_json`)
  - format, parse_status, parse_fehler, Denorm-Felder Liste, status, optional `beleg` → belege
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- Modul **einvoice** aus Skelett befüllt (ADR-0015 Anti-Corruption-Layer):
  - Stabiles DTO `ParsedEInvoice` — Domain hängt nicht an Parser-Lib
  - Adapter light: **XRechnung/UBL-XML** (primär) + **ZUGFeRD/CII-XML** + light PDF-Embedded-XML-Extraktion
  - Kein Mustang-Sidecar, keine Live-Netzwerk-Abhängigkeit
  - Mapping DTO → `BelegInput` (expenses); Kleinunternehmerregelung → USt light 0
  - Upload archiviert Original auch bei Parse-Fehler; Beleg-Entwurf nur bei parse ok
  - Lieferant:in-Match light (Name / USt-Id in Kontakt-Notiz)
- Repository: `uploadERechnung`, `createBelegFromERechnungSafe` → `expenses.createBeleg`, Download-Stream, Archiv-Status
- UI unter `/app/e-rechnungen/*`:
  - Liste/Filter, Upload, Detail mit Parse-Vorschau, „Beleg-Entwurf anlegen“, Original-Download
  - Nav **E-Rechnungen**
- Labels de-DE: Format / Parse-Status / Empfangs-Status
- Unit-Tests: UBL- + CII-Fixtures, Mapping, unparseable Guard, Match — **204** gesamt grün
- `docker compose build` + `up`: Collection/Rules OK (Client-Create 403); Routen 307→Login

## Schema-Dokumentation (minimal)

| Collection | Zweck |
|---|---|
| `e_rechnungen_empfang` | Inbox: Original + Parse-DTO + optional Beleg-Verweis |

**Felder (light):** `firma`, `original_datei`, `original_dateiname`, `format` (xrechnung_ubl \| zugferd_cii \| unbekannt), `parse_status` (ok \| fehler), `parse_fehler`, `geparst_json`, `rechnungsnummer`, `rechnungsdatum`, `lieferant_name`, `betrag_brutto`, `status` (neu \| beleg_erstellt \| archiviert), `beleg`, `empfangen_am`, `notiz`

**Original vs. Belegdatei:** XML-Original bleibt in der Inbox (Beleg-Collection erlaubt nur PDF/Bild). ZUGFeRD-PDF wird zusätzlich am Beleg abgelegt. Festschreibung nur über expenses/Journal.

## Explizit nicht / Follow-up

- E-Rechnungs-**Versand** / ZUGFeRD-Export aus eigenen Rechnungen (Meilenstein 2)
- Vollständige EN-16931-Validierung / Zertifizierungs-Claim
- Robustes PDF-Attachment-Parsing (nur light Byte-Scan)
- OCR/KI-Belegerkennung
- Reporting/DATEV/EÜR (Abschnitt 13)

## Next step

Bauabschnitt 13: Reporting/Export.

## Context snapshot

- Empfang vor Versand (ADR-0003); Original immutable + geparste Felder separat (ADR-0012); stabiles DTO hinter Adapter (ADR-0015).
- Beleg-Entwurf über expenses — kein Duplikat der Beleg-/Journal-Logik; Empfang allein festschreibt nicht.
- Parser: reines Node (Regex/Namespace-Strip), keine Java-Lib.
