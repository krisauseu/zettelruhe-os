# Prompt — nächster Chat: Übersicht Follow-up (kein Muss)

Rest der kf-Vorschläge nach dem ersten Keil (Fälligkeiten, §-19-Wächter, Verlauf). Gehört zur UI der Übersicht (`/app`), nicht zu Hybrid-PDF und nicht zu „Später / PWA“.

Zum Starten: den Block **Kickoff** unten als erste Nachricht in den nächsten Chat legen.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach Übersicht erster Keil).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md, docs/sessions/2026-08-17-uebersicht-dashboard.md, docs/adr/0017-kategorien-stammdaten.md, app/src/app/app/page.tsx, app/src/modules/reporting/repository.ts (`getUebersichtDashboard`), app/src/modules/reporting/uebersicht.ts, app/src/modules/expenses/types.ts, app/src/modules/cash/types.ts.

Stand: Meilenstein 2 abgeschlossen. UX/UI erster Keil und Rest stehen. Übersicht-Keil 1 steht: KPI-Karten unverändert, darunter §-19-Jahresbalken (nur Kleinunternehmerregelung), Verlauf 6/Jahr/12 (links) und Fälligkeiten (rechts, mobil zuerst). Fläche und Datenlage für die zwei restlichen Vorschläge prüfen — kein Muss, kein zweites Dashboard.

Reihenfolge in diesem Chat: Übersicht-Follow-up, eigener Schnitt. Vor dem ersten großen Umbau den Schnitt vorschlagen (was in diesem Chat, was nicht), dann bauen. Den ersten Keil nicht umkrempeln. Nicht beide Ideen erzwingen, wenn eine schlank reicht oder die Datenlage dünn ist.

Vorschläge (Priorität durch den Schnitt):

1. **Ausgaben nach Kategorien** — kompaktes Donut der Top 5 im Monat oder Quartal; Summe beim Fokus/Hover; Rest als „Weitere“. Kategorie ist der Stammdaten-Schnappschuss am **Beleg** und am **Kassenbuch** (ADR-0017), nicht ein Feld im Buchungsjournal. Journal-Zeilen `quelle_typ=beleg`/`kasse` über `quelle_id` zum Schnappschuss auflösen — oder festgeschriebene Belege/Kassenbuch-Einträge der aktiven Firma im Zeitraum lesen. Nur Ausgaben. Ohne Kategorie: ehrlich „ohne Kategorie“, nicht raten. Storno mindert die Ursprungskategorie (gleiche Regel wie EÜR). Zeitraum an den Verlauf koppeln oder eigener schmaler Umschalter Monat/Quartal — im Schnitt festlegen.

2. **Letzte Buchungen** — die letzten wenigen Zeilen aus vorhandenem Bestand (Journal, Rechnung, Beleg, Zahlung). Kein neues Event-Log, keine Marketing-Sprache („Aktivitäten“, „Feed“). Fachbegriffe wie CONTEXT.md. Link zum bestehenden Datensatz. Kompakt, unter dem 65/35-Raster oder in die rechte Spalte unter die Fälligkeiten, wenn das nicht drängt.

Layout: Tokens, KPI-Karten, §-19-Balken, Verlauf und Fälligkeiten fortsetzen, nicht zurückbauen. Desktop bleibt ~65/35; unter `md` eine Spalte (390px, Off-Canvas der Sidebar steht). Charts: vorhandene Primitives + schlichtes SVG/CSS wie der Verlauf; neue Bibliothek nur mit klarem Grund (dann ADR). de-DE.

Daten: Isolation `session.firmaId`. Einnahmen/Ausgaben nach Zufluss (ADR-0024) wo Journal die Quelle ist. Rolle Lesen: sehen ja, keine Schreib-Actions.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen (nicht vermischen): Marke/Favicon, Dokumenten-Layout Angebot/Rechnung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerungs-Regeln, M1-15, Multi-User/Einladen/Rollen, eigenes Passwort, Hybrid-PDF, Sidebar-Off-Canvas und Tokens/Primitives um des Umbauens willen, volle EÜR/BWA als Dashboard-Ersatz, den ersten Übersicht-Keil (Fälligkeiten, § 19, Verlauf) umbauen.

---

## Schnitt-Hinweis (für den bauenden Chat, nicht festzementiert)

Sinnvoller Keil, falls nicht alles auf einmal:

- Donut zuerst, wenn Top-5 aus Beleg- und Kassenbuch-Schnappschüssen ohne Extra-Collection und ohne N+1-Orgie geht (bestehende Listen, Solo-Volumen).
- Letzte Buchungen nur, wenn ein kurzer Journal-Tail (plus Links) reicht — kein paralleles „Was war los“-Modell.
- Wenn die rechte Spalte schon voll ist (Fälligkeiten), Donut unter den Verlauf oder als schmale dritte Zeile, nicht die Fälligkeiten kürzen.

Kein CSS-Profi-Layout, kein Steuerberater-Portal, kein neues Buchungsjournal, kein Event-Store.
