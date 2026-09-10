# Session 2026-08-12 — Bauabschnitt 6 (Angebote)

## Done

- PB-Migration `1730000500_angebote.js` — Collections `angebote` + `angebotspositionen` (firma-gebunden)
  - Angebot: Kund:in, Angebotsdatum, Gültig-bis, Notiz, Beträge, steuermodus-Snapshot, status, angebotsnummer, gesendet_am, pdf, rechnung-Relation
  - Status: entwurf | gesendet | angenommen | abgelehnt | abgelaufen | abgerechnet
  - Positionen: Menge, Einheit, Einzelpreis, Steuersatz, Beträge, optional Katalog
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- `lib/pb`: `allocateAngebotsnummer` (Nummernkreis `angebot`)
- Modul **sales** erweitert (Angebote neben Rechnungen):
  - Types, Invarianten (Positionssummen/USt, Entwurf vs. Senden, Status-Übergänge, Übernahme)
  - Repository: Entwurf CRUD + Positionen; `sendenAngebot` → Nummer + PDF (kein Journal); Status light; `uebernehmenAlsRechnung`
  - PDF mit `@react-pdf/renderer` (ADR-0014); §-19-Hinweis bei Kleinunternehmerregelung
  - Server Actions: anlegen, speichern, löschen, senden, Status, als Rechnung übernehmen
- UI: `/app/angebote` Liste/Filter, `/neu`, `/[id]` (Entwurf-Form / Read-only + Senden/Status/Übernahme), `/[id]/pdf` Stream
- App-Shell-Nav: **Angebote** (Fachbegriff)
- Labels: `ANGEBOT_STATUS_LABELS`
- Unit-Tests: 88 grün (inkl. 16 angebot)
- `docker compose build` + `up`: Migration gelaufen, Client-Write 403, bestehende Module ungebrochen

## Open / Blocked

Keine.

## Next step

Bauabschnitt 7: Zeit & Fahrten.

## Context snapshot

- Angebot = noch nicht verbindlich; **kein** Journal-Ereignis (Buchung erst über Rechnung).
- „Senden“ = fachliches Finalisieren (Nummer + PDF), analog Rechnungs-Festschreibung, aber ohne Journal.
- Angebotsnummer aus `firmen.nummernkreise.angebot` erst beim Senden (Entwurf verbraucht keinen Kreis).
- Nach Senden: Inhalt/PDF immutable light; Statuswechsel manuell in der UI erlaubt.
- Übernahme: angenommenes Angebot → Rechnungs-Entwurf + Status abgerechnet + `rechnung`-Relation.
- PDF in PB-Files; Download nur über Next (`/app/angebote/[id]/pdf`).
