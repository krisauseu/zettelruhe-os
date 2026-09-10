# Session 2026-08-12 — Bauabschnitt 7 (Zeit & Fahrten)

## Done

- PB-Migration `1730000600_projekte_zeit_fahrten.js` — Collections `projekte`, `zeiteintraege`, `fahrten` (firma-gebunden)
  - Projekt: Kund:in, Name, Notiz, aktiv (light Stammdaten, keine Budgets)
  - Zeiteintrag: Kund:in Pflicht, Projekt optional; Datum; `dauer_minuten` (≥ 1); Beschreibung; Status; optional Stundensatz; optional `rechnung`
  - Fahrt: Kund:in Pflicht, Projekt optional; Datum; km (Text/Decimal); Strecke/Zweck; Status (Default abrechenbar); steuerlich_relevant light; optional km-Satz; optional `rechnung`
  - Status: `abrechenbar | nicht_abrechenbar | abgerechnet`
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- Module aus Skeletten befüllt:
  - **projects**: Types, Invarianten, Repository, Actions, Form, UI
  - **time**: Types, Dauer-Normalisierung (h+min / Dezimalstunden → Minuten), Status, Repository, Actions, Form, UI
  - **travel**: Types, km > 0, Status, Repository, Actions, Form, UI
- Light-Übernahme: abrechenbare Zeiten + Fahrten je Kund:in → Rechnungs-Entwurf (`modules/time/uebernahme.ts`, Pattern `createRechnung`); Status → abgerechnet + `rechnung`-Relation
- UI: `/app/projekte`, `/app/zeiten`, `/app/fahrten` (Liste/Filter, neu, Detail); Nav **Projekte**, **Zeiten**, **Fahrten**
- Labels: `ABRECHNUNGSSTATUS_LABELS` (de-DE)
- Unit-Tests: 109 grün (inkl. projects/time/travel)
- `docker compose build` + `up`: Migration gelaufen, Collections vorhanden, Client-Write gesperrt, bestehende Module ungebrochen

## Open / Blocked

Keine.

## Next step

Bauabschnitt 8: Zahlungen manuell.

## Context snapshot

- **Kein Journal** bei Zeit/Fahrt — Buchung erst über Rechnung (Festschreibung).
- Dauer intern als **Minuten** (number, min 1 wegen PB required-number-0=blank); UI: Stunden+Minuten (Vorrang) oder Dezimalstunden.
- km als Text (decimal.js-Normalisierung), analog Geldbeträge.
- Abgerechnet + verknüpfte Rechnung → Inhalt immutable light; reiner Status „abgerechnet“ ohne Rechnung bleibt editierbar.
- Übernahme: alle abrechenbaren Einträge einer:s Kund:in (IDs optional vorbereitet für Teilmengen-UI Follow-up).
- Stundensatz / km-Satz optional am Eintrag; leerer Satz → Position mit 0,00 (im Rechnungs-Entwurf nachziehbar).
- Explizit nicht: Live-Timer, Projekt-Budgets, Verpflegungspauschalen, Katalog-Tarife, heavy Teilmengen-UI.
