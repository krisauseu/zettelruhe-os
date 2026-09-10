# Session 2026-08-18 — Kassenbuch aus Barzahlung (Schnitt, kein Bau)

## Schnitt

**In diesem Chat**
- Prüfen, ob ein automatischer Kassenbuch-Eintrag aus Rechnungs-Barzahlung ohne doppelte Einnahme ehrlich geht.
- Ergebnis dokumentieren: ADR-0027 (enger Titel). Formular-Hinweis präzisieren. Open Decision in Status/Roadmap schließen.

**Nicht in diesem Chat**
- Hook an `createZahlung` / `deleteZahlung` / Rechnungs-Storno
- Satellit ohne Journal oder Sonderfall in EÜR/USt/DATEV
- Manuelles Kassenbuch von der EÜR entkoppeln oder Ist-Versteuerung (ADR-0024) aufweichen
- Nachzug bestehender Barzahlungen, Multi-Kasse, Kassenabschluss, TSE
- Übersicht, Marke, Dokumenten-Layout, UStVA/ZM, Hybrid-PDF, MT940, ZUGFeRD-Empfang-Parsing

## Entscheidung

Der Keil **geht nicht ehrlich**. Satellit bricht Anlegen = Journal. Gleicher Schreibpfad verdoppelt EÜR/USt/DATEV oder erzeugt im Journal-CSV einen Schein. Eine Zahlung mit Zahlungsweg `bar` erzeugt keinen Kassenbuch-Eintrag. Der steuerliche Zufluss bleibt allein die Zahlungsbuchung (`quelle_typ=zahlung`, ADR-0024). Das Kassenbuch bleibt das manuelle Buch für Bargeld ohne diese Zahlung; Anlegen schreibt weiter `quelle_typ=kasse`.

## Verifikation

Kein Produktumbau (`createZahlung`, Kassen-Repository, Aggregate unangetastet). Einziger UI-Text: Hinweis im Zahlungsformular. Kein Testlauf nötig.

## Nicht angefasst

- `app/src/modules/payments/repository.ts`, `journal.ts`
- `app/src/modules/cash/*` (außer unberührt)
- `app/src/modules/reporting/aggregate.ts`
- Commit/Push

## Next step

Übrige Open Decisions (MT940, robustes ZUGFeRD-Empfang-Parsing) weiter separat.
