# Session 2026-08-12 — Bauabschnitt 10 (Wiederkehrend + SMTP + Jobs)

## Done

- PB-Migration `1730000900_wiederkehrend_jobs.js`:
  - `wiederkehrende_rechnungen` + `wiederkehrende_rechnungspositionen` (firma-gebunden, Client-Write gesperrt)
  - `job_locks` (globaler DB-Lock, unique key)
  - `job_runs` (light Laufprotokoll)
- **Rhythmus-Modell** (dokumentiert): `monatlich` | `quartalsweise` | `jaehrlich` | `tage` (+ `intervall_tage`)
- **Erzeugungsregel**: fällige Vorlage → **Rechnungs-Entwurf** über `createRechnung` (Sales); Nummernkreis erst bei manuellem Festschreiben; `naechstes_datum` vorschieben (Europe/Berlin)
- Modul `modules/sales`: `wiederkehrend-*` (Types, Invarianten, Repository, Actions, Form)
- Modul `modules/jobs` aus Skelett: Lock, Runs, Runner, Scheduler, Mail-Actions
- `lib/smtp.ts` (Nodemailer): ENV `SMTP_*`; ohne Host klarer Fehler / UI-Hinweis
- In-Process-Scheduler: `src/instrumentation.ts` + Intervall (Default 15 min), `JOBS_DISABLED` / `JOB_TICK_INTERVAL_MS`
- UI: `/app/wiederkehrende-rechnungen` Liste/Detail/Neu; Nav **Wiederkehrende Rechnungen**
- Versand-Buttons: Angebot + Rechnung per E-Mail (PDF); Zahlungserinnerung manuell light an Rechnung
- Unit-Tests: Rhythmus/Datum, Mapping, Lock-Helfer, SMTP-Config-Guard — 163 grün
- `docker compose build` + `up`: Migrationen 200, Client-Write 403, Scheduler-Log, Login/UI, manuell „Jetzt erzeugen“ → Entwurf ohne Nummer

## Entscheidungen (light, nicht neu verhandeln)

| Thema | Wahl |
|-------|------|
| Rhythmus | Select monatl./quartal/jährl./Tage(+Intervall) |
| Job-Output | Rechnungs-**Entwurf** (Owner prüft → Festschreiben) |
| Lock | PB `job_locks` unique key + TTL, release nach Tick |
| Scheduler | In-Process Next, kein Worker-Container |
| SMTP | Optional; Nodemailer; Secrets nur ENV |

## Open / Follow-up

- Automatischer 1.–3.-Mahnlauf / Status „Gemahnt“ — bewusst nicht v1
- SMTP-E2E gegen echten Server — manuell/ENV
- Multi-Instanz: Lock greift; Solo-Compose korrekt
- Bank-Import → Abschnitt 11

## Next step

Bauabschnitt 11: Bank-Import + Matching.

## Context snapshot

- Vorlagen: aktiv/pausiert, nächstes Datum, Positionen analog Rechnung, Summen via Sales-Invarianten
- Job-Key: `wiederkehrende_rechnungen`
- Catch-up: max. 12 Perioden pro Vorlage pro Tick
- Zahlungserinnerung: manuell, ändert keinen Rechnungsstatus
