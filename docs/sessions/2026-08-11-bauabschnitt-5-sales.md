# Session 2026-08-11 — Bauabschnitt 5 (Sales light: Rechnung)

## Done

- PB-Migration `1730000400_rechnungen.js` — Collections `rechnungen` + `rechnungspositionen` (firma-gebunden)
  - Rechnung: Kund:in, Rechnungsdatum, Leistungszeitraum, Fälligkeit, Notiz, Beträge, steuermodus-Snapshot, status (entwurf|offen), rechnungsnummer, festgeschrieben_am, pdf, journal_eintrag
  - Positionen: Menge, Einheit, Einzelpreis, Steuersatz, Beträge, optional Katalog
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- `lib/pb`: `allocateRechnungsnummer` (Nummernkreis `rechnung`), generischer `allocateNummernkreis`, Firma-Adresse für PDF
- Modul **sales**:
  - Types, Invarianten (Positionssummen/USt, Entwurf vs. Festschreibung, Nummern erst bei Festschreibung)
  - Repository: Entwurf CRUD + Positionen ersetzen; `festschreibenRechnung` → Nummer + PDF + `festschreibenBuchung` (`quelle_typ=rechnung`)
  - PDF mit `@react-pdf/renderer` (ADR-0014); §-19-Hinweis bei Kleinunternehmerregelung
  - Server Actions: anlegen, speichern, löschen (Entwurf), Festschreiben
- UI: `/app/rechnungen` Liste/Filter, `/neu`, `/[id]` (Entwurf-Form / Read-only + Festschreiben), `/[id]/pdf` Stream
- App-Shell-Nav: **Rechnungen** (Fachbegriff)
- Labels: `RECHNUNG_STATUS_LABELS`
- Unit-Tests: 72 grün (inkl. 15 sales)
- `docker compose build` + `up`: Migration gelaufen, Client-Write 403, Login/Belege/Journal ungebrochen

## Open / Blocked

Keine.

## Next step

Bauabschnitt 6: Angebote.

## Context snapshot

- Rechnung = UX-Schicht; Festschreibung schreibt Journal mit `quelle_typ=rechnung`, `quelle_id=rechnung.id` (Einnahme).
- Nach Festschreibung: Metadaten + PDF immutable (ADR-0012); Korrektur später über Gutschrift/Storno.
- Rechnungsnummer aus `firmen.nummernkreise.rechnung` erst bei Festschreibung (Entwurf verbraucht keinen Kreis).
- Status light: `entwurf` → `offen` (Teilbezahlt/Bezahlt/… folgen mit Zahlungen).
- PDF in PB-Files/`pb_data`; Download nur über Next (`/app/rechnungen/[id]/pdf`).
