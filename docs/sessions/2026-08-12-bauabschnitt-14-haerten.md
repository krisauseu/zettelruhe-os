# Session 2026-08-12 — Bauabschnitt 14 (Härten)

## Done

### Betrieb & Doku
- **`docs/betrieb.md`**: Backup/Restore konkret (Volume `zettelruhe_pb_data`, Was/Wann/Wie, `.env` separat), Secrets, Session/CSRF light, Health, Updates, Jobs
- **README** poliert: Start, ENV, Backup, Security light, Status Meilenstein 1
- **`.env.example`**: klare Prod-Warnungen, Verweis Betrieb
- **`docs/verfahrensdokumentation.md`**: Datensicherung + Zugriffsabschnitt mit Verweis auf `betrieb.md`
- **Roadmap**: M1 „hartbar abgeschlossen“; Suche + Betrieb/Härten markiert

### Security / Betriebsfestigkeit (light)
- **`GET /health`**: Liveness + ENV-Check + PB-Ping (`ok` / Warnings)
- **ENV-Check** (`lib/env.ts`): Startup-Log, Platzhalter-Warnungen, Unit-Tests
- **Compose-Healthchecks** next + pocketbase; Caddy wartet auf healthy
- **Caddy Security-Header**: nosniff, DENY frame, Referrer-Policy, …
- **Server Actions allowedOrigins** aus `APP_URL` (Build-Arg)
- PocketBase-Image: `wget` für Healthcheck

### UX-Polish
- Nav-Gruppen (Stammdaten / Zeit / Verkauf / Belege / Auswertungen) + **Suche**
- Übersicht: Schnellstart-Links, ruhiger-Monat-Hinweis, ehrlicher Journal/Zahlungen-Hinweis
- `EmptyState`-Komponente; kritische Listen (Kontakte, Rechnungen, Belege, Zahlungen, Journal)
- Zahlungen-Copy: Bank-Import nicht mehr als „folgt“

### Suche light (Roadmap)
- Modul `search`: parallele Filter über Kontakte, Rechnungen, Belege, Angebote
- UI `/app/suche` (min. 2 Zeichen, Trefferliste mit Badge)

## Verifikation
- **237** Unit-Tests grün
- `docker compose build` + `up`: next/pocketbase **healthy**
- `/health` → `ok` + PB ok; `/app/*` → 307 Login; Login-Fehler de-DE
- Security-Header über Caddy sichtbar
- Authentifizierte UI-Klicks im Browser nicht mit Session-Credentials in dieser Session verifiziert (nur Gate + öffentliche Pfade)

## Explizit nicht / Follow-up
- Multi-Firma-UI, ELSTER, E-Rechnungs-Versand, PSD2, OCR, REST-API
- Journal-Nachzug für Zahlungen (Open Decision)
- GoBD-/DATEV-Zertifizierung
- Volltext-Index / Elasticsearch
- TLS/HSTS am Caddy (Host-abhängig dokumentiert)

## Next step
Meilenstein 2 nach Roadmap (Steuer/Compliance vertiefen) oder Feinschliff aus Open Decisions.
