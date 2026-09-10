# Zettelruhe

Self-hosted Open-Source-Buchhaltung für Solo-Selbstständige in Deutschland  
Website: [zettelruhe.de](https://zettelruhe.de)

EÜR und Steuerübersichten light, DATEV-light-CSV und E-Rechnungs-XML. Eine Instanz, eine oder mehrere Firmen, Nutzer:innen über Mitgliedschaft.

Lizenz: [AGPL-3.0](./LICENSE)

## Funktionen

- Kontakte, Katalog, Projekte, Zeiten und Fahrten; Angebote, Rechnungen,
  wiederkehrende Rechnungen, PDF und optionaler E-Mail-Versand.
- Belege mit mehreren PDF-/Bilddateien, Kategorien für Einnahmen und Ausgaben,
  Kassenbuch sowie CSV-/MT940-Bankimport mit bestätigtem Rechnungsmatching.
- EÜR und BWA light, UStVA-Kennzahlen, ZM-Übersicht, Journal-CSV und Belegarchiv.
  E-Rechnungsempfang und XML-Versand unterstützen XRechnung-UBL und ZUGFeRD-CII.
- Reverse Charge für betriebliche EU-/Drittlandsdienstleistungen in EUR,
  einschließlich Kleinunternehmerregelung. Lieferantenstandards liefern Vorschläge;
  der Beleg hält die gewählte Behandlung. Deutsche Steuerschuld und abziehbare
  Vorsteuer werden getrennt von Rechnungsbetrag und Lieferantenzahlung berechnet.
  UStVA und XML berücksichtigen den gespeicherten Steuerzeitpunkt.

Reverse Charge ist freigegeben und laut Betreiberbestätigung vom 10. September 2026
auf dem Produktions-VPS getestet und live. Die Festschreibung
unterstützt einen Dienstleistungsfall je Beleg und eine vollständige Zahlung;
Teilzahlungen, mehrere Zahlungen, Waren, Fremdwährungen und teilweise abziehbare
Vorsteuer sind nicht unterstützt. DATEV light lehnt RC-Zeiträume vollständig ab;
der Journal-CSV enthält die RC-Daten. Der lokale UStVA-XML-Export ist auf 2026 und
Monat/Quartal begrenzt. Es gibt keinen ELSTER-Versand und keinen nachgewiesenen
amtlichen XML-Import. Details: [RC-Umsetzung](docs/reverse-charge-umsetzung.md).

## Stack (v1)

| Komponente | Rolle |
|------------|--------|
| **Next.js 16** (App Router, Server Actions) | UI + Domain + Session-Gate |
| **PocketBase** (SQLite) | Auth-Quelle, Daten, Dateien |
| **Caddy** | Reverse Proxy + Security-Header light |
| **Docker Compose** | Caddy + Next + PocketBase, Volume `zettelruhe_pb_data` |

Finanz-Writes laufen nur über Next (nicht per Client-PB-SDK). Details: [`docs/adr/`](./docs/adr/).  
Betrieb (Backup, Secrets, Health): [`docs/betrieb.md`](./docs/betrieb.md).

## Schnellstart

### Voraussetzungen

- Docker + Docker Compose; das mitgelieferte PocketBase-Image verwendet **linux/amd64**.
  ARM-Nativbetrieb ist nicht abgenommen; auf Apple Silicon wurde über OrbStack geprüft.
- Kopie von `.env.example` → `.env` mit **echten** Secrets (keine `change-me`-Werte in Produktion)

```bash
git clone https://github.com/krisauseu/zettelruhe.git
cd zettelruhe
cp .env.example .env
# Pflicht setzen:
#   SESSION_SECRET  → openssl rand -base64 48  (≥ 32 Zeichen)
#   PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD  → starke, einzigartige Werte
#   APP_URL         → öffentliche URL, ohne Slash (lokal z. B. http://localhost)

docker compose up --build
```

App: [http://localhost](http://localhost) (Caddy Port `CADDY_HTTP_PORT`, default 80)  
Health: [http://localhost/health](http://localhost/health)

Produktion: `APP_URL` auf die öffentliche HTTPS-URL setzen. TLS vor der App terminieren (eigener Reverse Proxy). Der Compose-Default bleibt HTTP auf Port 80.

Beim ersten Start:

1. PocketBase wendet `pocketbase/pb_migrations` an und legt den Superuser an
2. Die leere Instanz zeigt den **Setup-Wizard** (Eigentümer:in, erste Firma, Steuer-Modus)
3. Danach Login/Logout über httpOnly Session-Cookie; weitere Firmen unter `/app/firma/neu`, Wechsel in der Shell

PocketBase-Admin (Betrieb/Schema, **nicht** App-Login): [http://localhost/_/](http://localhost/_/). Superuser stark halten.

### Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `APP_URL` | ja | Öffentliche URL der App (ohne `/` am Ende); `https://` → Secure-Cookie |
| `PB_URL` | ja | PocketBase aus Sicht von Next (`http://pocketbase:8090` in Compose) |
| `PB_SUPERUSER_EMAIL` | ja | PB-Superuser (nur Betrieb) |
| `PB_SUPERUSER_PASSWORD` | ja | PB-Superuser-Passwort |
| `SESSION_SECRET` | ja | Signatur Session-Cookie (≥ 32 Zeichen Zufall) |
| `SMTP_*` | nein | Optional; E-Mail Angebot/Rechnung/Zahlungserinnerung |
| `JOB_TICK_INTERVAL_MS` | nein | Optional; Intervall In-Process-Jobs (Default 15 min) |
| `JOBS_DISABLED` | nein | Optional; `true` schaltet Scheduler ab |

Siehe [`.env.example`](./.env.example) und [`docs/betrieb.md`](./docs/betrieb.md).

### Entwicklung ohne Compose (optional)

```bash
# PocketBase lokal (Binary + Migrationen), dann:
cd app
cp ../.env.example .env.local
# PB_URL=http://127.0.0.1:8090 und Secrets anpassen
npm ci
# Nur einen eigenen, synthetischen Entwicklungsbestand verwenden.
# JOBS_DISABLED=true verhindert automatische Entwürfe.
npm run dev
```

### Tests

```bash
cd app
npm ci
npm test
npm run typecheck
npm run lint -- --max-warnings=0
```

Die CI führt diese Prüfungen und den Abgleich der generierten Finanz-Hooks aus.
Die echte Finanz-/RC-Integration läuft separat mit
`node scripts/test-festschreibung-isolated.mjs` vom Repository-Root.
Einrichtung und isolierter Installations-/Restoretest: [Entwicklung](docs/entwicklung.md).

## Backup & Restore

**Ein Volume trägt die Fachdaten:** `zettelruhe_pb_data` (SQLite + Dateien).  
`.env` separat sichern. Ausführlich: [`docs/betrieb.md`](./docs/betrieb.md).

```bash
docker compose stop

docker run --rm \
  -v zettelruhe_pb_data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf "/backup/pb_data-$(date +%Y%m%d-%H%M).tar.gz" -C /data .

docker compose start
```

Wiederherstellung: Stack stoppen, Archiv ins Volume entpacken, `.env` abstimmen, `docker compose up -d`. Restore einmal testen und dokumentieren.

## Sicherheit (light)

- Secrets nur in `.env` / Host-Secret — nicht committen, keine Defaults in Produktion
- Session: httpOnly, `SameSite=Lax`, HMAC; Secure nur bei HTTPS-`APP_URL`
- CSRF light: Origin-Prüfung der Server Actions; Login per Form-POST
- Caddy setzt u. a. `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Finanzaggregate: Writes nur Next-Server (ADR-0006)

Details und Empfehlungen: [`docs/betrieb.md`](./docs/betrieb.md).
Sicherheitsbefunde: [SECURITY.md](SECURITY.md). Beiträge: [CONTRIBUTING.md](CONTRIBUTING.md).

## Repo-Layout

```
app/                      Next.js (src/modules/*, src/lib/*)
pocketbase/               Dockerfile, pb_migrations/
Caddyfile                 Reverse Proxy (HTTP :80)
docker-compose.yml
.env.example
docs/                     Roadmap, ADRs, Status, Betrieb, Verfahrensdoku
CONTEXT.md                Domain-Sprache
LICENSE                   AGPL-3.0
```

## Dokumentation

| Datei | Zweck |
|-------|--------|
| [`docs/README.md`](./docs/README.md) | Dokumentenübersicht und verbindliche Pflege je Änderung |
| [`docs/testphase.md`](./docs/testphase.md) | Einzelne Änderungen, Fehlerbehebungen und offene Funde |
| [`docs/reverse-charge-umsetzung.md`](./docs/reverse-charge-umsetzung.md) | RC-Umfang, Bedienung, Implementierung und Abnahmen |
| [`docs/entwicklung.md`](./docs/entwicklung.md) | Code-Einstiege, vorhandene Skills, Prüfkommandos und Bestandsaufnahme für Entwicklung mit Codex und grok-build |
| [`CONTEXT.md`](./CONTEXT.md) | Glossary und Scope |
| [`docs/feature-roadmap.md`](./docs/feature-roadmap.md) | v1 / M2 / später |
| [`docs/betrieb.md`](./docs/betrieb.md) | Backup, Secrets, Health, Updates |
| [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md) | Manueller Funktionstest Meilenstein 1 |
| [`docs/funktionstest-m2.md`](./docs/funktionstest-m2.md) | Manueller Funktionstest Meilenstein 2 |
| [`docs/verfahrensdokumentation.md`](./docs/verfahrensdokumentation.md) | GoBD-Vorlage |
| [`docs/adr/`](./docs/adr/) | Architekturentscheidungen |
| [`docs/90-status.md`](./docs/90-status.md) | Projektstand |

## Status

Stand: 10. September 2026, lokale Releasevorbereitung auf `main` ab `f48be21`.

Scheduler, Zahlungen, Bankzuordnung und Rechnungsstorno wurden gegen konkrete
Fehler-, Replay- und Parallelitätsfälle abgesichert. Tests, Typecheck, Lint,
Dockerbuild sowie synthetische Installation und Upgrade/Restore sind lokal
geprüft. [Abnahme und Prüfgrenzen](docs/issues/release-abnahme-2026-09-10.md),
[fertige Release Notes](CHANGELOG.md). **Noch kein stabiler Release:** Über den
Umgang mit vertraulichen Arbeitsmaterialien in der bereits öffentlichen
Git-Historie ist gesondert zu entscheiden. Der Arbeitsbaum wurde bereinigt;
das entfernt frühere Veröffentlichungen nicht. [Materialbefund](docs/issues/release-materialpruefung-2026-09-10.md).

Nach M2 wurden unter anderem Belegerfassung, Finanzfestschreibung und Exporte
verbessert sowie Reverse Charge ergänzt. Der Betreiber hat am 10. September
den getesteten Produktivbetrieb von Reverse Charge bestätigt. Der XML-Export
benötigt keine Freigabe einer von Zettelruhe betriebenen ELSTER-Schnittstelle;
eine solche Schnittstelle gibt es nicht. Aktuelle Abnahmen und offene Punkte
stehen im [Status](docs/90-status.md).

Das Repository ist bereits öffentlich; ein GitHub-Release wird vorbereitet.
Der heutige Funktionsumfang bleibt Open Source. Neue Komfortfunktionen wie
Belegerkennung und Briefpapier sind für das separate Aboangebot
`zettelruhe-cloud` vorgesehen. [Release- und Cloud-Plan](docs/release-und-cloud-plan.md).

**Meilenstein 1** (Bauabschnitte 1–14) — abgeschlossen.  
Funktionstest: [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md).

**Meilenstein 2** (Steuer & Compliance) — abgeschlossen.  
Funktionstest lokal und unter HTTPS **bestanden**. Freigabe Alltag trägt. Lokaler historischer Tag `meilenstein-2`; kein GitHub-Release dazu nachgewiesen.

| Keil | Ort | Hinweis |
|------|-----|---------|
| Kategorien | `/app/kategorien` | gemeinsame Liste Beleg + Kassenbuch |
| Multi-Firma | Shell + `/app/firma/neu` | Session wechselt die aktive Firma |
| UStVA / ELSTER-XML light | `/app/ust` | Self-File, kein Versand |
| ZM-Übersicht | `/app/zm` | Self-File, kein Versand |
| USt-IdNr.-Prüfung (BZSt) | Firma + Kontakt | Schnappschuss, kein Dauer-Stempel |
| E-Rechnungs-Versand | festgeschriebene Rechnung | XRechnung-UBL / ZUGFeRD-CII als XML |

Checklisten: [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md), [`docs/funktionstest-m2.md`](./docs/funktionstest-m2.md).  
Stand im Repo: [`docs/90-status.md`](./docs/90-status.md).
