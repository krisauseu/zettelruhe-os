# Prompt — nächster Chat: Übersicht / Dashboard (kein Muss)

Vorschläge von kf (2026-08-17), kein Pflichtprogramm. Gehört zur UI der Übersicht (`/app`), nicht zu Hybrid-PDF und nicht zu „Später / PWA“.

Zum Starten: den Block **Kickoff** unten als erste Nachricht in den nächsten Chat legen.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach UX/UI Rest).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md, docs/sessions/2026-08-17-ux-ui-app-layout.md, docs/sessions/2026-08-17-ux-ui-rest-sidebar-mobil.md, app/src/app/app/page.tsx, app/src/modules/reporting/repository.ts (`getDashboardKennzahlen`).

Stand: Meilenstein 2 abgeschlossen. UX/UI erster Keil und Rest stehen (Tokens, Tinte-Sidebar, PageHeader, Sidebar mobil Off-Canvas). Die Übersicht hat Stammdatenleiste, Schnellstart und vier KPI-Karten für den laufenden Monat — darunter bleibt Fläche. kf-Vorschläge (kein Muss): die Fläche so füllen, dass zwei Fragen sofort beantwortet sind: „Muss ich heute handeln?“ und „Wie steht es um mein Jahr?“

Reihenfolge in diesem Chat: Übersicht vertiefen, eigener Schnitt. Vor dem ersten großen Umbau den Schnitt vorschlagen (was in diesem Chat, was nicht), dann bauen. Nicht die ganze Übersicht umkrempeln und nicht alle fünf Ideen auf einmal, wenn ein klarer erster Keil reicht.

Vorschläge (Priorität durch den Schnitt, nicht alles Pflicht):

1. **Einnahmen- vs. Ausgaben-Verlauf** (ca. 2/3 links) — letzte 6 / aktuelles Jahr / letzte 12 Monate. Zwei Balken je Monat plus dezente Linie für den monatlichen Überschuss. Umschalter im Karten-Header. Saisonalität und Ausreißer sollen sichtbar werden.
2. **Kleinunternehmer-Wächter** — nur im Steuer-Modus Kleinunternehmerregelung. Jahresumsatz gegen die geltende §-19-Grenze (aktuelles UStG prüfen, nicht raten; Grenze nicht fest verdrahten, wenn sie sich ändert). Schlichter Fortschrittsbalken oder Gauge; Füllung und eine ruhige Ampel (z. B. entspannt / Achtung / nahe der Grenze). Unter Regelbesteuerung entfällt das Widget (nicht „nicht relevant“ als tote Karte).
3. **Fälligkeiten & Liquidität** (ca. 1/3 rechts) — nicht nur die KPI-Zahl. Kompakte Liste: überfällige Rechnungen (Tage Verzug, Link zur Rechnung; Schreiben: Zahlung erfassen). Plus was in den nächsten 14 Tagen fällig wird.
4. **Ausgaben nach Kategorien** — kompaktes Donut der Top 5 im Monat oder Quartal; Summe beim Fokus/Hover. Kategorie ist der Stammdaten-Schnappschuss am Beleg/Kassenbuch.
5. **Letzte Aktivitäten** — die letzten wenigen Buchungen/Dokumente aus vorhandenem Bestand (Journal, Rechnung, Beleg, Zahlung), kein neues Event-Log, keine Marketing-Sprache. Fachbegriffe wie CONTEXT.md.

Vorschlag Layout Desktop ~65/35 unter den KPI-Karten; unter `md` eine Spalte (390px, Off-Canvas der Sidebar steht). Tokens und KPI-Karten des ersten Keils fortsetzen, nicht zurückbauen. Charts: erst vorhandene Primitives + schlichtes SVG/CSS; neue Bibliothek nur mit klarem Grund (dann ADR). de-DE.

Daten: Isolation `session.firmaId`. Einnahmen nach Zufluss (ADR-0024, Quelle Zahlung), nicht nach der Forderungsbuchung der Festschreibung. Ausgaben aus dem Journal der aktiven Firma. Offene Posten bleiben liquiditätsrelevant (bereits nicht zeitraumgebunden). Rolle Lesen: sehen ja, keine Schreib-Actions.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen (nicht vermischen): Marke/Favicon, Dokumenten-Layout Angebot/Rechnung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerungs-Regeln, M1-15, Multi-User/Einladen/Rollen, eigenes Passwort, Hybrid-PDF, Sidebar-Off-Canvas und Tokens/Primitives um des Umbauens willen, volle EÜR/BWA als Dashboard-Ersatz.

---

## Schnitt-Hinweis (für den bauenden Chat, nicht festzementiert)

Sinnvoller erster Keil, falls nicht alles auf einmal:

- Rechts: Fälligkeiten (heute handeln) aus den schon geladenen offenen Posten.
- Links oder schmal oben: §-19-Jahresbalken nur unter Kleinunternehmerregelung (Jahr verstehen) — Grenze aus geltendem Recht + Test, kein geratener 22.000-€-Default.
- Verlauf 6/12 Monate danach, wenn die Aggregation schlank bleibt (`getDashboardKennzahlen` ist heute ein Monat).
- Donut und Aktivitäts-Stream nur, wenn Fläche und Datenlage das hergeben; sonst Follow-up.

Kein CSS-Profi-Layout, kein Steuerberater-Portal, kein neues Buchungsjournal.
