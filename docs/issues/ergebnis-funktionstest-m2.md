# Ergebnis Funktionstest M2

_Durchführung: kf, lokal und Server (HTTPS `app.zettelruhe.de`, ADR-0023). Auswertung 2026-08-16. Nachtest M2-01 2026-08-16._

**Gesamt: bestanden.** Freigabe **M2 Alltag trägt**. Blocker keine.

Protokoll: [`funktionstest-m2.md`](../funktionstest-m2.md). Screenshot (vor dem Fix): [Historischer Beleg aus Datenschutzgründen aus dem Releasebestand entfernt; siehe Materialprüfung](release-materialpruefung-2026-09-10.md).

Nicht Gegenstand (Protokoll Abschnitt 9): Setup-`verified` (eigener Schnitt nach Freigabe), Dokumenten-Layout, Logo/Favicon, Multi-User, Open Decisions, Hybrid-PDF, ELSTER-Versand.

## Priorität

| Prio | ID | Modul | Schwere | Status |
|------|----|-------|---------|--------|
| 1 | **M2-01** | USt-Übersicht / UStVA / ELSTER-XML (`/app/ust`) | Blocker (behoben) | nachgetestet auf der Instanz (`13da9e7`, 2026-08-16) |
| — | — | übrige M2-Keile (Kategorien, Multi-Firma, ZM, BZSt, E-Rechnungs-Versand, HTTPS) | — | vom Tester als tragend beschrieben; kein zweiter Mangel gemeldet |

## M2-01 — Steuersatz der Rechnung fehlt im Journal

**Symptom (Regelbesteuerung, Ist-Versteuerung):** Rechnung mit ausgewähltem Satz 19 % (Beispiel: 95,00 € netto, 18,05 € USt). Karten oben stimmen (Umsatzsteuer 18,05 €, Vorsteuer 7,98 €, Zahllast light 10,07 €). Tabelle **Nach Steuersatz**: 19 % Nettoeinnahmen 0,00 €; die 95,00 € stehen unter **ohne Satz**. UStVA **Kz 81** 0 €, **Kz 83** nur Vorsteuer (−7,98 €). ELSTER-XML ohne den Umsatz. Hinweis „Kz 0 / ohne“ listet Netto 95,00 € / USt 18,05 €.

**Ursache:** Bei der Festschreibung schreibt `buildJournalInputFromRechnung` den Steuersatz nicht ins Buchungsjournal (immer leer). Belege/Kasse schreiben den Satz — deshalb Vorsteuer und Kz 66 korrekt. Die USt-Übersicht und UStVA (ADR-0019) gruppieren nur nach Journal-`steuersatz`; leeres Feld → „ohne Satz“, keine Kz 81/86.

**Nicht:** Journal-Nachzug für Zahlungen (Open Decision). Die Rechnung war festgeschrieben; Zahlung ändert die Zahlen nicht.

**Fix (nur dieser Blocker):**

1. **Schreiben:** einheitlicher Satz 0/7/19 aus den Rechnungspositionen ins Journal. Gemischt oder Kleinunternehmerregelung: leer bleiben (kein Raten aus dem Kopf).
2. **Lesen:** USt-Übersicht/UStVA ordnen 19/7 zu, wenn das Journal-Feld leer ist, die Beträge aber exakt `percentOf`/Rundung der Rechnung treffen. Bestehende festgeschriebene Zeilen werden nicht geändert (ADR-0004). 0 % wird nicht geraten.

Nachtest (kf, 2026-08-16, `app.zettelruhe.de`, HEAD `13da9e7`): Fix deployed; M2-01 geschlossen. Arbeitsfirma der Instanz steht im Steuer-Modus Kleinunternehmerregelung. Zahlung erzeugt in v1 kein Journal.

## Hinweise

- Server-Nachtest inkl. HTTPS hat stattgefunden (`app.zettelruhe.de` im Screenshot).
- Checklisten-Kästchen im Protokoll nicht einzeln transkribiert — ein gemeldeter Fehler (M2-01), restliche Keile ohne weiteren Mangel; Nachtest M2-01 bestanden.
