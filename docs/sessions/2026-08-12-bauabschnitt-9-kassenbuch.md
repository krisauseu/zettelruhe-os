# Session 2026-08-12 — Bauabschnitt 9 (Kassenbuch)

## Done

- PB-Migration `1730000800_kassenbuch.js` — Collection `kassenbuch_eintraege` (firma-gebunden)
  - Felder: datum, richtung, Beträge (Text), steuersatz, text, kategorie, notiz, belegnummer, festgeschrieben_am, kontakt, journal_eintrag, storno_von (Self-Relation)
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- `lib/pb`: `allocateKassenbuchBelegnummer` (Nummernkreis-Key `kasse`, Prefix `K-`)
- Modul `modules/cash` aus Skelett befüllt:
  - Types, Invarianten (Validierung, Saldo chronologisch datum+id, **negativer Saldo abgelehnt**, Storno-Guards, Journal-Input `quelle_typ=kasse`)
  - Repository: `festschreibenKassenbuchEintrag` (Belegnr. + Eintrag + Journal + Verknüpfung), `storniereKassenbuchEintrag` (Gegenbuchung Kasse + `storniereBuchung` Journal), Liste mit Saldo
  - Server Actions, Form (USt nur Regelbesteuerung)
- UI: `/app/kassenbuch` Liste/Saldo/Filter, `/neu` Bareinnahme/Barausgabe, `/[id]` Detail light + Storno
- App-Shell-Nav: **Kassenbuch** (Fachbegriff)
- Zahlung-Form: Hinweis „Bar ≠ automatischer Kassenbuch-Eintrag“
- Unit-Tests: 148 grün (inkl. 18 cash)
- `docker compose build` + `up`: Migration gelaufen, Client-Write 403, Login/Shell ungebrochen

## Open / Blocked

- Keine automatische Kassenbuch-Buchung aus Rechnungszahlung (Zahlungsweg bar) — bewusst Follow-up
- Bankkonten / CSV/MT940 → Abschnitt 11
- Multi-Kasse, Kassenabschluss, TSE — bewusst nicht v1 light

## Next step

Bauabschnitt 10: Wiederkehrend + SMTP + Jobs.

## Context snapshot

- Anlegen = Festschreibung (kein Entwurf); Belegnummer bei Anlegen.
- Saldo berechnet (nicht denormalisiert); Reihenfolge datum, id; Regel: Saldo ≥ 0.
- Journal: `quelle_typ=kasse`, `quelle_id` = Kassenbuch-Eintrag; Storno nutzt Journal-Storno-Pattern.
- Eine Kasse pro Firma; getrennt von Bankkonten.
- Superuser-PB könnte technisch patchen; Anwendungs-Repository blockiert Update/Delete bewusst.
