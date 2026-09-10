# Session 2026-08-17 — UX/UI Rest: Sidebar mobil + Detailköpfe

## Schnitt

**In diesem Chat**
- Sidebar mobil Off-Canvas (unter `md`); Desktop-Tinte fest
- Fokus, Esc, Overlay, Nav-Link schließt; de-DE
- PageHeader auf Firma, Nutzer:innen, Passwort (nur Optik), Dokument-Details (Angebot, Rechnung, Beleg)
- Nav-Logik, Tokens und erster Keil unangetastet

**Nicht in diesem Chat**
- Marke/Favicon, Dokumenten-Layout Angebot/Rechnung
- Multi-User / Einladen / Rollen, Passwort-Actions
- Hybrid-PDF, UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- Alle Formulare Feld für Feld; übrige `[id]`/`neu`-Köpfe

## Done

- Client-Rahmen `AppSidebar` um die bestehende Shell. Mobil: Leiste „Menü öffnen/schließen“ + Marke, Overlay, `inert` auf Inhalt. Desktop: feste Sidebar wie im ersten Keil.
- Gruppen, Favoriten, `zettelruhe-nav` unverändert (`AppNav` + `app-nav-state`).
- Schließen: Esc, Overlay, jeder Link in der Sidebar (auch die aktuelle Seite). Gruppe/Favorit/Theme bleiben Buttons.
- PageHeader auf den genannten Köpfen; Zurück-Link und Status-Badge bleiben. Formulare und Actions unangetastet.
- PageHeader-Aktionen (`shrink-0` / `flex-1 basis-0`) sitzen auch auf schmalen Formularseiten rechts neben der Überschrift.

## Verifikation

437 Unit-Tests + `tsc --noEmit` grün. Lokal hinter Caddy (Compose neu gebaut): Desktop-Sidebar unverändert; 390px Inhalt volle Breite, Menü auf/zu, Esc, Link schließt, Fokus auf dem Schließen-Knopf. Firma / Nutzer:innen / Passwort / Dokument-Details angesehen. Listen-PageHeader (Kontakte, Rechnungen) unverändert in einer Reihe. Commit/Push auf ausdrückliche Bitte. Server-Nachtest durch kf nach Deploy.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout / PDF, Setup-verified
- UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- Einladen/Rollen, Passwort-Actions
- Hybrid-PDF, Open Decisions

## Next step

Übersicht / Dashboard unter den KPI-Karten — eigener Chat, Kickoff: [`2026-08-17-uebersicht-dashboard-prompt.md`](./2026-08-17-uebersicht-dashboard-prompt.md) (kf-Vorschläge, kein Muss). Hybrid-PDF und übrige Open Decisions weiter separat.
