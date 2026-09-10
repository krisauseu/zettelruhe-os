# Session 2026-08-11 — Bauabschnitt 3 (Journal-Kern)

## Done

- PB-Migration `1730000200_journal.js` — Collection `buchungsjournal` (firma-gebunden)
  - Felder: laufende_nr, buchungsdatum, belegdatum, buchungstext, richtung, Beträge (Text), steuersatz, konto, kontakt, quelle_typ/id, storno_von, festgeschrieben_am
  - API-Rules: list/view nur Auth; create/update/delete = null (Client-Write gesperrt)
- Modul **journal**:
  - Types, Invarianten (Validierung, Betrags-Normalisierung, Storno-Gegenbuchung, Immutability-Guard)
  - Repository: `festschreibenBuchung`, `storniereBuchung`, `listJournal`, `getJournalEintrag`, `findStornoFuer`; Update/Delete werfen immer
  - Server Actions: manuelle Festschreibung, Storno
- UI: `/app/journal` Liste/Filter, `/app/journal/neu` manuelle Buchung, `/app/journal/[id]` Detail light + Storno
- App-Shell-Nav: **Buchungsjournal** (Fachbegriff)
- Labels: Richtung, Quelle, Datum de-DE
- Unit-Tests: 45 grün (inkl. 19 journal)
- `docker compose build` + `up`: PB-Migration gelaufen, Client-Write 403, Login ungebrochen

## Open / Blocked

Keine.

## Next step

Bauabschnitt 4: Belege manuell + Dateien (Anbindung ans Buchungsjournal).

## Context snapshot

- Anlegen = Festschreibung; Korrekturen nur über Storno/Gegenbuchung (append-only).
- Geldbeträge Text + decimal.js; Buchungstag YYYY-MM-DD, Auswertung Europe/Berlin.
- quelle_typ vorbereitet für beleg/rechnung/kasse (noch ohne UI/Collections).
- Superuser-PB könnte technisch patchen; Anwendungs-Repository blockiert Update/Delete bewusst.
