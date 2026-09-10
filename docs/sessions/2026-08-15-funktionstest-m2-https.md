# Session 2026-08-15 — Funktionstest-Protokoll M2 + HTTPS-Schnitt

## Done

### A) Protokoll

Manuelle Checkliste [`docs/funktionstest-m2.md`](../funktionstest-m2.md), analog M1. Zwei Läufe: lokal/HTTP (ohne BZSt-Klick) und Server/HTTPS (Abschnitt 8 inkl. BZSt). M1-Checkliste nur ein Verweis, nicht umgebaut.

Verweise: `docs/90-status.md`, `docs/feature-roadmap.md`, `README.md`, `docs/betrieb.md` §10, `CONTEXT.md`.

### B) HTTPS — Schnitt mit kf, Repo vorbereitet

Entscheidung (nicht geraten):

| Punkt | Wahl |
|-------|------|
| Variante | Caddy **nativ auf dem Host** |
| Hostname | `app.zettelruhe.de` |
| Zertifikat | Let’s Encrypt (Caddy ACME) |
| `/_/` | weiter über denselben Host |

Umsetzung im Repo (ADR-0023):

- `deploy/Caddyfile.host` — Site-Block, TLS, Proxy auf `127.0.0.1:3000` / `:8090`, HSTS
- `docker-compose.server.yml` — Compose-Caddy aus, Next/PB nur localhost
- Lokal: `Caddyfile` + `docker compose up` unverändert HTTP:80
- `APP_URL=https://app.zettelruhe.de` (Build-Arg, Secure-Cookie); `PB_URL` intern

Auf der **Maschine** noch: DNS, Host-Caddy installieren/Site-Block, `.env` + Rebuild mit Overlay. Das kann dieses Repo nicht allein.

## Nicht angefasst

- Setup-`verified`, Dokumenten-Layout, Logo/Favicon
- Multi-User, Open Decisions, Empfang, Hybrid-PDF
- Commit/Push
- Kein App-Code, keine Tests (kein Domain-Schnitt)

## Next step

Auf dem Server Host-Caddy + Overlay einschalten. Danach Funktionstest M2 Abschnitt 8 inkl. BZSt-Klick.
