# Session 2026-08-11 — Bauabschnitt 1 (Fundament)

## Done

- Compose-Stack: Caddy + Next.js 16 + PocketBase, named Volume `zettelruhe_pb_data`
- PocketBase-Migration: `users` (Auth, Rolle Eigentümer:in), `firmen` (Steuer-Modus, SKR03/04, Nummernkreise-JSON)
- Setup-Wizard, Login/Logout, httpOnly JWT-Session, geschützte App-Shell
- Domain-Skelett unter `app/src/modules/*`, Libs `pb` / `money` / `session`
- Unit-Tests (money, session-token), AGPL-3.0 LICENSE, README + `.env.example`

## Open / Blocked

Keine.

## Next step

Bauabschnitt 2: Kontakte + Katalog.

## Context snapshot

- DoD Abschnitt 1 erfüllt; keine Journal-/Rechnungs-Features.
- PB-Client-Writes auf `firmen`/`users` per Rules gesperrt; Next schreibt mit Superuser.
- Session-Cookie `secure` nur bei `APP_URL` mit HTTPS (HTTP-Self-Host).
- `/api/*` hinter Caddy = PocketBase; App-Form-Submits nicht unter `/api/`.
