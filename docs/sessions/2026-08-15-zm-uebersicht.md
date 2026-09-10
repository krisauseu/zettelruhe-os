# Session 2026-08-15 — Zusammenfassende Meldung (ZM) Übersicht

## Done

Unter Regelbesteuerung eine ZM-Übersicht zum Selbst-Eintragen in Mein Elster. Kein Versand, keine Zertifikate, keine Abgabe aus der App.

### Schnitt

- Nur Steuer-Modus Regelbesteuerung. Kleinunternehmerregelung: „nicht relevant“, nichts erfunden.
- Zahlen aus dem Buchungsjournal der aktiven Firma (`session.firmaId`) plus aktuellem Land am Kontakt. Zahlung erzeugt weiter kein Journal.
- Zeitraum analog USt-Übersicht (Monat/Quartal/Jahr/custom). Monat = typischer Meldezeitraum, Quartal möglich, Jahr/custom nur Übersicht.
- Ehrliche Kandidaten: wirtschaftliche Einnahmen mit USt 0,00 € (nicht Satz 7/19) an Kontakte im übrigen EU-Gebiet. Rechnungsbuchungen speichern oft keinen Steuersatz — maßgeblich ist die USt.
- Art (Lieferung / sonstige Leistung / Dreieck), Unterscheidung ig. Lieferung vs. Ausfuhr, USt-IdNr. als Stammdatum: „nicht geführt“.
- USt-Id nur aus explizit beschrifteter Kontakt-Notiz, ungeprüft.
- Andere 0-USt-Einnahmen (DE, Drittland, ohne/unbekanntes Land) sichtbar, nicht still weggelassen.
- CSV light (`zettelruhe-zm-uebersicht-v1`), kein ELSTER-XML.
- Multi-Firma: nur aktive Firma.

### Umsetzung

- ADR-0020.
- Pure Logik `reporting/zm.ts`; Seite `/app/zm`; Download `/app/zm/csv` (nicht `/api/*`).
- Nav, Export, USt-Übersicht, Auswertungen und Dashboard verweisen auf die ZM-Übersicht.

### Tests

327 Unit-Tests + `tsc` + `next build` grün.

### Verifikation (laufende Instanz hinter Caddy, Image neu gebaut)

- Unauth `/app/zm` und `/app/zm/csv` → 307 Login.
- **Beispiel GmbH** (Kleinunternehmerregelung): ZM-Übersicht „nicht relevant“, kein CSV; CSV 400 mit Hinweis § 19.
- **Regel UG Test** (Regelbesteuerung): Kandidaten-Tabelle, „nicht geführt“, CSV-Button; im August keine Journal-Zeilen → leerer Kandidaten-Hinweis. CSV `ZM_Zettelruhe_2026_08.csv` (nur Kopf).
- Quartal: 01.07.–30.09.2026, Label quartalsweise möglich.
- Jahr: Kennzahlen/CSV ja, Label kein typischer Meldezeitraum.
- Export- und USt-Seite verweisen auf die ZM-Übersicht. EÜR/Auswertungen 200 (Regression).
- Isolation: Session `firmaId` — Klein-CSV nicht, Regel-CSV nur „Regel UG Test“.
- Nav: ZM-Übersicht unter Auswertungen.

**Browser-Nachtest (kf, 2026-08-15):** manuell im Browser geprüft, keine Fehler.

## Nicht angefasst

- USt-IdNr.-Prüfung (BZSt), E-Rechnungs-Versand, Multi-User
- Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940, robustes ZUGFeRD-PDF)
- M1-15 (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf)
- UStVA-Nachzug, USt-Id-Feld am Kontakt

## Next step

USt-IdNr.-Validierung (BZSt).
