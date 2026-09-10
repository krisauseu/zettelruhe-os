# Session 2026-08-17 — Übersicht / Dashboard (erster Keil)

## Schnitt

**In diesem Chat**
- Fälligkeiten rechts (~1/3): überfällig (Tage Verzug) + nächste 14 Tage; Link zur Rechnung; „Zahlung erfassen“ nur bei Schreibrecht (`#zahlung`)
- §-19-Jahresbalken nur unter Kleinunternehmerregelung — Grenzen aus geltendem Recht (Staffel, Test), kein 22.000-€-Default
- Verlauf 6 / Jahr / 12: ein Journal-Lauf (Kalenderjahr ∪ letzte 12 Monate), Aggregation nach Monat, schlichtes SVG, Umschalter im Karten-Header
- Layout Desktop ~65/35 unter den KPI-Karten; unter `md` eine Spalte, Fälligkeiten zuerst
- Tokens und KPI-Karten unangetastet

**Nicht in diesem Chat**
- Ausgaben-Donut, letzte Aktivitäten / Event-Stream
- Neue Chart-Bibliothek, volle EÜR/BWA als Dashboard
- Marke/Favicon, Dokumenten-Layout, UStVA/ZM-Logik, Ist-Versteuerungs-Regeln
- Sidebar-Off-Canvas und Tokens um des Umbauens willen
- Multi-User / Einladen / Rollen, Hybrid-PDF, M1-15

## Done

- `getUebersichtDashboard`: Monatskennzahlen plus Verlauf, §-19-Wächter, Fälligkeiten. Isolation `session.firmaId`. Einnahmen nach Zufluss (ADR-0024). `getDashboardKennzahlen` für `/app/auswertungen` unverändert.
- § 19 Abs. 1 UStG (gesetze-im-internet.de, 2026-08-17): ab 2025 Vorjahr 25.000 €, laufendes Jahr 100.000 €; bis 2024 22.000 / 50.000. Jahresumsatz light, Hinweis kein amtlicher Gesamtumsatz nach Abs. 2. Unter Regelbesteuerung keine Karte.
- Ampel entspannt / Achtung / nahe der Grenze (70 % / 90 % der Vorjahresgrenze).
- Rechnung: Anker `#zahlung` an der Zahlungs-Karte.

## Verifikation

454 Unit-Tests + `tsc --noEmit` grün. Lokal hinter Caddy (Compose Next neu gebaut): authentifizierter GET `/app` für Beispiel GmbH (Kleinunternehmerregelung: Jahresbalken 25.000/100.000, Ampel entspannt, Fälligkeiten mit „Zahlung erfassen“) und Regel UG Test (kein §-19-Widget, keine tote Karte). Anker `#zahlung` auf der Rechnung. 390px ist CSS-Stack (`order` + eine Spalte unter `md`); Verlauf-Umschalter clientseitig nicht geklickt. Server-Nachtest durch kf nach Deploy.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout / PDF, Setup-verified
- UStVA/ZM-Logik, Ist-Versteuerungs-Regeln, M1-15
- Einladen/Rollen, Passwort, Hybrid-PDF, Open Decisions
- Donut, Aktivitäts-Stream, Chart-Bibliothek

## Next step

Übersicht-Follow-up (Donut, letzte Buchungen) — Kickoff: [`2026-08-17-uebersicht-followup-prompt.md`](./2026-08-17-uebersicht-followup-prompt.md). Hybrid-PDF und Open Decisions weiter separat.
