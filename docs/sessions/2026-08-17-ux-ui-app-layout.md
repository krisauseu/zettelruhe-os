# Session 2026-08-17 — UX/UI: App-Layout / CSS-Modernisierung (erster Keil)

## Schnitt

Alltägliche App-Oberfläche, nicht die ganze App umkrempeln.

**In diesem Chat**
- Tokens + gemeinsame Primitives (Card, Table, Button, Input, Select, EmptyState, Toast)
- Shell / Sidebar (Tinte vs. Papier), Nav-Aktivzustand
- PageHeader auf Übersicht und Alltagslisten
- Übersicht als Showcase, Login/Setup-Canvas
- M1-12 (kräftige Primärfarbe) und die Marke (Z) fortsetzen, nicht zurückbauen

**Nicht in diesem Chat**
- Marke/Favicon-Dateien, Dokumenten-Layout Angebot/Rechnung
- Multi-User / Einladen / Rollen, eigenes Passwort (Logik)
- Hybrid-PDF, UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- Mobiles Off-Canvas der Sidebar, CSS-Profi-Layouts der Dokumente

## Done

- Primärfarbe an die Violett-Familie der Z-Marke; Canvas als Papier, Sidebar als Tinte (Hell- und Dunkelmodus).
- `PageHeader`, Card-Variante `muted` für Filter, Tabellen ohne Schrei-Versalien.
- Übersicht: Stammdatenleiste, Schnellstart mit Icons, KPI-Karten.
- Login-Text: „Melde dich bei Zettelruhe an.“ (nicht mehr nur Eigentümer:in).
- Toast unten rechts, überdeckt die Seitenaktionen nicht.

## Verifikation

431 Unit-Tests + `tsc --noEmit` grün. Lokal hinter Caddy (Compose neu gebaut): Login Desktop + 390px, Übersicht hell/dunkel, Rechnungen, Kontakte, Journal, Kontakt-Formular, `/app/passwort` (nur Ansicht), Suche/leerer State, Toast `?saved=1`. Sidebar-Logik unverändert.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout / PDF, Setup-verified
- UStVA/ZM-Logik, Ist-Versteuerung, M1-15
- Einladen/Rollen, Passwort-Actions
- Hybrid-PDF, Open Decisions, mobiles Off-Canvas

## Next step

Rest-UX (Sidebar mobil einklappbar, Detail-/Formularköpfe) eigener Schnitt oder Hybrid-PDF / Open Decisions — nicht vermischen. Commit/Push auf ausdrückliche Bitte. Server-Nachtest durch kf nach Deploy.
