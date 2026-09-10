# Session 2026-08-17 — Übersicht Follow-up (Kategorien + letzte Buchungen)

## Schnitt

**In diesem Chat**
- Ausgaben nach Kategorien: Donut Top 5 + „Weitere“, Umschalter Monat/Quartal (Default Monat, nicht an Verlauf 6/Jahr/12 gekoppelt)
- Kategorie nur aus Schnappschuss am Beleg und am Kassenbuch (ADR-0017); Journal liefert Betrag und Storno
- Ohne Schnappschuss: „ohne Kategorie“; Storno mindert die Ursprungskategorie
- Letzte Buchungen: 6 Zeilen Journal-Tail, Link zum bestehenden Datensatz (Beleg / Kassenbuch / Rechnung / sonst Journal)
- Zweite 65/35-Zeile unter Verlauf|Fälligkeiten; Fälligkeiten nicht gekürzt

**Nicht in diesem Chat**
- Ersten Keil umbauen (KPI, § 19, Verlauf, Fälligkeiten)
- Event-Log, Marketing-Sprache, neues Buchungsjournal
- Chart-Bibliothek, volle EÜR/BWA als Dashboard
- Marke/Favicon, Dokumenten-Layout, UStVA/ZM, Ist-Versteuerungs-Regeln
- Sidebar-Off-Canvas und Tokens um des Umbauens willen

## Done

- `getUebersichtDashboard` lädt Monat und Quartal aus dem bestehenden Journal-Lauf; Schnappschüsse gebündelt (`listBelegeByIds` / `listKassenbuchByIds`). Isolation `session.firmaId`.
- Letzte Buchungen: eine Journal-Seite (`-buchungsdatum,-laufende_nr`), keine Extra-Collection.
- Rolle Lesen: beide Karten sichtbar, keine Schreib-Actions.

## Verifikation

462 Unit-Tests + `tsc --noEmit` grün. Lokal hinter Caddy (Compose Next neu gebaut), authentifizierter GET `/app`:

- **Beispiel GmbH** (Kleinunternehmerregelung, Eigentümer:in): erster Keil steht (§ 19, Verlauf, Fälligkeiten mit „Zahlung erfassen“). Neue Zeile: Donut + letzte Buchungen. Donut ehrlich leer — die zwei Belege im August sind Entwürfe, Kasse ist Bareinnahme. Journal-Tail mit Zahlung/Rechnung, Links auf Rechnung bzw. Journal.
- **Regel UG Test**: kein §-19-Widget, USt-Zahllast light, Donut und letzte Buchungen leer (kein Journal).
- **Rolle Lesen** (Beispiel GmbH): beide neuen Karten sichtbar, keine „Zahlung erfassen“, keine Anlegen-Links.
- Raster: zwei gleiche `md` 65/35-Zeilen. 390px bleibt CSS-Stack (erste Zeile Fälligkeiten zuerst). Umschalter Monat/Quartal im HTML. `/app/auswertungen` 200.

Client-Hover am Donut und Viewport 390px nicht geklickt. Server-Nachtest durch kf nach Deploy. Commit `3d460d5`.

Nachzug: Donut-Farben — Segmente nutzen je ein Token (primary / success / warning / destructive / muted / sidebar-primary). Vorher lagen die ersten Slices in derselben Violett-Mischung (`docs/issues/dashboard-issue.png`).

## Nicht angefasst

- Erster Übersicht-Keil, Marke/Favicon, Dokumenten-Layout / PDF
- UStVA/ZM-Logik, Ist-Versteuerungs-Regeln, M1-15
- Einladen/Rollen, Passwort, Hybrid-PDF, Open Decisions

## Next step

Hybrid-PDF — Kickoff: [`2026-08-17-hybrid-pdf-prompt.md`](./2026-08-17-hybrid-pdf-prompt.md). Übrige Open Decisions (MT940, ZUGFeRD-Empfang-Parsing, Kassenbuch aus Barzahlung) weiter separat.
