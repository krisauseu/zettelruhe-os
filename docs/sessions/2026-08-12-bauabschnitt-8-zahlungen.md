# Session 2026-08-12 — Bauabschnitt 8 (Zahlungen manuell)

## Done

- PB-Migrationen:
  - `1730000700_zahlungen.js` — Collection `zahlungen` (firma-gebunden; Relation `rechnung`; Betrag Text; Datum; optional Zahlungsweg/Notiz)
  - `1730000701_rechnungen_status_extend.js` — Rechnungsstatus: `entwurf | offen | teilbezahlt | bezahlt | ueberfaellig | storniert`
  - API-Rules: list/view Auth; create/update/delete = null (Client-Write gesperrt)
- Modul `modules/payments` aus Skelett befüllt:
  - Types, Invarianten (Teilzahlung, Überzahlung ablehnen, Status ableiten), Repository, Actions, Form
  - Zahlung anlegen/löschen light; offener Betrag = Brutto − Summe Zahlungen
  - Status-Ableitung: bezahlt / teilbezahlt / ueberfaellig (Fälligkeit) / offen
  - **Kein Journal** bei Zahlung (Ist-Versteuerung Follow-up; Rechnungs-Journal bleibt bei Festschreibung)
- Sales: `RechnungStatus` + Labels + `isFestgeschrieben` (alle nicht-Entwurf) + Listenfilter
- UI:
  - Rechnungsdetail: Zahlungsliste, offener Rest, Zahlung erfassen (de-DE)
  - `/app/zahlungen` — Offene Posten light
  - Nav **Zahlungen**
- Unit-Tests: 130 grün (inkl. payments 21)
- `docker compose build` + `up`: Migrationen gelaufen, Collections/Rules OK

## Open / Blocked

- Journal-Wirkung Zahlung (Ist-Versteuerung) — bewusst Follow-up
- Bank-Import/Matching → Abschnitt 11
- Stille Überfälligkeits-Aktualisierung beim Öffnen der Rechnung (light); kein Batch-Job

## Next step

Bauabschnitt 9: Kassenbuch.

## Context snapshot

- Zahlung = eigener Datensatz an Rechnung; PDF/Journal der Rechnung unverändert.
- Überzahlung abgelehnt; mehrere Teilzahlungen bis Brutto.
- Löschen light nur manuelle Korrektur (kein stilles Überschreiben der Rechnung).
- Zahlungsweg light: Bar / Überweisung / Sonstiges.
- Explizit nicht: CSV/MT940, Matching, Kasse, Mahnungen, PSD2, PayPal/Stripe.
