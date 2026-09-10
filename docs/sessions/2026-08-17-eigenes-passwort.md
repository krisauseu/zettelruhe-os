# Session 2026-08-17 — Eigenes Passwort ändern

## Done

Dünner Nachzug zu ADR-0025: jede angemeldete Nutzer:in ändert nur das eigene Passwort.

- Seite `/app/passwort`: altes Passwort + neues Passwort + Bestätigung, mindestens 8 Zeichen (wie Setup/Einladen).
- Zugang für Instanz-Eigentümer:in und Eingeladene, alle drei Rollen inkl. Lesen (`requireSession`, kein Schreib-/Verwaltungsrecht).
- Fremdes Passwort unter `/app/nutzer` unverändert; Hinweis auf die eigene Seite statt Formular für das eigene Konto.
- Kein SMTP, kein Reset-per-Mail, kein Profil-Studio. Dünner Link in der Sidebar neben Abmelden, kein CSS-Umbau der Shell.
- Altes Passwort gegen PocketBase-Auth; Schreiben über Superuser (ADR-0006). Next-Session bleibt gültig (ADR-0009).

## Verifikation

431 Unit-Tests + `tsc --noEmit` grün. Lokal hinter Caddy: Rolle Lesen sieht `/app/passwort`; falsches altes Passwort und abweichende Bestätigung werden abgewiesen; Wechsel gelingt; Next-Session bleibt gültig; neues Passwort loggt ein, das alte nicht. `/app/nutzer` bleibt für Lesen gesperrt. Wegwerf-Konto wieder entfernt. Commit/Push auf ausdrückliche Bitte. Server-Nachtest durch kf nach Deploy.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout-Vertiefung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- UX/UI (App-Layout / CSS-Modernisierung)
- Einladen/Rollen außer dem Hinweis auf `/app/passwort`
- Hybrid-PDF, Open Decisions

## Next step

UX/UI (App-Layout / CSS-Modernisierung), eigener Chat. Hybrid-PDF und übrige Open Decisions separat.
