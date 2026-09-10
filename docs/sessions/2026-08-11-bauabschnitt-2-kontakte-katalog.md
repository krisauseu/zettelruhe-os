# Session 2026-08-11 — Bauabschnitt 2 (Kontakte + Katalog)

## Done

- PB-Migrationen:
  - `1730000100_contacts_catalog.js` — `kontakte`, `ansprechpartner`, `katalog_positionen` (firma-gebunden; Client-Writes gesperrt)
  - `1730000150_users_firma_role.js` — Nachzug `role`/`firma` auf Default-`users` (Foundation hatte bestehende Auth-Collection übersprungen)
  - Foundation-Migration ergänzt: role/firma auf bestehender `users`-Collection immer nachziehen
- Modul **contacts**: Types, Repository, Server Actions, CSV Parse/Serialize + Tests
- UI Kontakte: Liste/Filter/Suche, Anlegen, Detail/Bearbeiten, Ansprechpartner light, CSV-Import/Export unter `/app/kontakte/*`
- Modul **catalog**: Types, Repository (`normalizePreisInput` + money), Actions, CSV light
- UI Katalog: Liste, Anlegen/Bearbeiten, CSV-Import/Export; USt-Felder nur bei Regelbesteuerung
- App-Shell-Nav: Kontakte, Katalog (de-DE Fachbegriffe)
- `lib/pb`: generische Superuser-CRUD-Helfer; `requireFirmaSession` mit Fallback erste Firma
- Unit-Tests: 26 grün (money, session, contacts/csv, catalog/preis)

## Open / Blocked

Keine.

## Next step

Bauabschnitt 3: Journal-Kern.

## Context snapshot

- DoD Abschnitt 2 erfüllt; keine Sales/Journal/Beleg-Features.
- Preise als Text + decimal.js; keine Floats.
- Form-Submits/CSV-Export-Routen nicht unter `/api/*`.
- Bestehende Volume-Daten: Migration 0150 muss gelaufen sein; User ggf. `firma` verknüpfen (Setup setzt sie bei Neuinstallation).
