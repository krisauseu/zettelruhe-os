# Session 2026-08-17 — Marke: Logo und Favicon

## Done

App-Marke Zettelruhe (nicht `firmen.logo` auf Angebot/Rechnung).

- Quelle: `docs/logo-512x512-transparent.png` (Z ohne Schriftzug). Kein selbst gezeichnetes Logo.
- Shell oben links: Marke + Wort „Zettelruhe“ statt reinem Text.
- Login und Setup: dieselbe Marke über der Karte; transparentes PNG, taugt für Hell- und Dunkelmodus (`zettelruhe-theme`).
- Favicon (`favicon.ico` 16/32/48), `icon.png` 32×32, Apple-Touch 180×180 (opaker weißer Grund, iOS), PWA-light `manifest.ts` plus 192/512.

## Verifikation

- 392 Unit-Tests + `tsc --noEmit`.
- Browser lokal: Login hell/dunkel (Desktop + 390px), Shell hell/dunkel, `/app/firma` (Firmen-Logo-Feld unverändert). `/setup` leitet bei bestehender Instanz nach `/login` um — dieselbe `BrandMark`-Komponente wie Login.
- Head: Favicon ico + 32×32 PNG + Apple-Touch 180 + `manifest.webmanifest`.
- Nachtest durch kf inkl. lokalem Docker-Stack: in Ordnung. Commit/Push auf Bitte.

## Nicht angefasst

- Dokumenten-Layout / PDF / GiroCode, `firmen.logo`
- Multi-User, Open Decisions, Hybrid-PDF, M1-15, UStVA/ZM-Logik, Ist-Versteuerung, Setup-verified
- Briefpapier/Font-Upload

## Next step

Separat: Ist-Versteuerung, Multi-User, Hybrid-PDF oder Open Decisions — nicht vermischen.
