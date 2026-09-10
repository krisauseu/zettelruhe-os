# Session 2026-08-11 — Bauabschnitt 4 (Belege manuell + Dateien)

## Done

- PB-Migration `1730000300_belege.js` — Collection `belege` (firma-gebunden)
  - Felder: belegdatum, buchungsdatum, richtung, Beträge (Text), steuersatz, kategorie, notiz, konto, status (entwurf|festgeschrieben), belegnummer, festgeschrieben_am, datei (PDF/Bild max 15 MiB), lieferant → kontakte, journal_eintrag → buchungsjournal
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- `lib/pb`: multipart create/update, `fetchRecordFile`, `getFirmaById`, `allocateBelegnummer` (Nummernkreis Firma)
- Modul **expenses**:
  - Types, Invarianten (Entwurf vs. Festschreibung, Datei-MIME/Größe, Journal-Input `quelle_typ=beleg`)
  - Repository: Entwurf CRUD + Datei; `festschreibenBeleg` → `festschreibenBuchung`; danach immutable
  - Server Actions: anlegen, speichern, löschen (Entwurf), Datei entfernen, Festschreiben
- UI: `/app/belege` Liste/Filter, `/neu`, `/[id]` (Entwurf-Form / Read-only + Festschreiben), `/[id]/datei` Stream
- App-Shell-Nav: **Belege** (Fachbegriff)
- Labels: `BELEG_STATUS_LABELS`
- Unit-Tests: 57 grün (inkl. 12 expenses)
- `docker compose build` + `up`: Migration gelaufen, Client-Write 403, Login/Journal ungebrochen

## Open / Blocked

Keine.

## Next step

Bauabschnitt 5: Sales light (Rechnung Festschreiben/PDF/Journal).

## Context snapshot

- Beleg = UX-Schicht; Festschreibung schreibt Journal mit `quelle_typ=beleg`, `quelle_id=beleg.id`.
- Nach Festschreibung: Metadaten + Datei immutable (ADR-0012); Korrektur über neuen Beleg / Storno-Journal.
- Belegnummer aus `firmen.nummernkreise.beleg` erst bei Festschreibung.
- Dateien in PB-Files/`pb_data`; Download nur über Next (`/app/belege/[id]/datei`).
