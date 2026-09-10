# Session 2026-08-17 — Multi-User / grobe Rechte

## Done

Mitgliedschaft je Firma, Einladen und drei grobe Rollen (ADR-0025).

- Collection `mitgliedschaften` (`user` + `firma` + Rolle). `users.firma` bleibt zuletzt aktiv.
- Rollen: Eigentümer:in (verwalten/einladen), Bearbeiten (Alltag schreiben), Lesen (nur sehen).
- Instanz-Eigentümer:in (`users.role=eigentuemer`) legt weitere Firmen an; eingeladene Konten `users.role=nutzer`.
- `/app/nutzer`: Einladen mit Startpasswort (kein SMTP-Pflicht), optional Hinweis-Mail ohne Passwort wenn SMTP steht; Rolle ändern, Passwort setzen, Mitgliedschaft entfernen. Letzte Eigentümer:in geschützt.
- Session und Firmenwechsler nur mit Mitgliedschaft. Schreib-Actions serverseitig (`requireSchreibenSession` / `requireVerwaltenSession`).
- Backfill: bestehende Instanz-Eigentümer:innen werden Eigentümer:in aller vorhandenen Firmen.
- Migration `1730001900_mitgliedschaften.js`.

Nicht vermischt: UX/UI-Modernisierung, Marke, Dokumenten-Layout, UStVA/ZM-Logik, Ist-Versteuerung, Hybrid-PDF, Open Decisions.

## Verifikation

419+ Unit-Tests + `tsc --noEmit` grün. Browser-Nachtest Rollen durch kf bestätigt. Server-Nachtest kf inkl. SMTP: keine Fehler. Commit/Push `1ae4965`.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout-Vertiefung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- UX/UI (App-Layout / CSS-Modernisierung) — nur das für Rechte nötige (Nav, Banner, CTAs)
- Hybrid-PDF, Kassenbuch aus Barzahlung, MT940, ZUGFeRD-PDF-Parsing
- Commit/Push auf ausdrückliche Bitte (dieser Schnitt)

## Next step

Zuerst dünn: **eigenes Passwort ändern** (jede:r das eigene; nicht UX/UI). Danach separat UX/UI (App-Layout / CSS-Modernisierung).
