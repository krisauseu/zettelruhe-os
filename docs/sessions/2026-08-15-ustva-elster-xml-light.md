# Session 2026-08-15 — UStVA-Zahlen / ELSTER-XML light

## Done

USt-Übersicht unter Regelbesteuerung um UStVA-Kennzahlen und optionalen XML-Download erweitert. Self-File: Werte in Mein Elster selbst eintragen oder XML lokal speichern. Kein Versand, keine Zertifikate, keine Abgabe aus der App.

### Schnitt

- Nur Steuer-Modus Regelbesteuerung (Ist-Versteuerung). Kleinunternehmerregelung: USt-Übersicht bleibt „nicht relevant“, kein XML.
- Zahlen ausschließlich aus dem Buchungsjournal der aktiven Firma (`session.firmaId`). Zahlung erzeugt weiter kein Journal.
- Zeitraum wie die bestehende USt-Übersicht (Monat/Quartal/Jahr/custom).
- Ehrliche Felder: Kz 81 (19 %), Kz 86 (7 %), Kz 66 (Vorsteuer aller Ausgaben), Kz 83 (19 % × 81 + 7 % × 86 − 66). Bemessungsgrundlagen volle Euro; Journal-Cent daneben.
- 0 % / ohne Satz sowie ig. Lieferung, § 13b, EUSt, Erwerb, Sondervorauszahlung: „nicht geführt“, nichts erfunden.
- XML: `Anmeldungssteuern` (Mein-Elster-Nutzdaten, Format-ID `zettelruhe-ustva-elster-xml-light-v1`), nur bei Kalendermonat oder -quartal. Jahr/custom: Kennzahlen ja, Download nein.
- Multi-Firma: nur aktive Firma.

### Umsetzung

- ADR-0019.
- Pure Logik `reporting/ustva.ts`; Seite `/app/ust`; Download `/app/ust/elster-xml` (nicht `/api/*`).
- Link auf der Export-Seite zur USt-Übersicht.

### Tests

308 Unit-Tests + `tsc` grün.

### Verifikation (laufende Instanz hinter Caddy)

- Unauth `/app/ust` und `/app/ust/elster-xml` → 307 Login.
- **Beispiel GmbH** (Kleinunternehmerregelung): USt-Übersicht „nicht relevant“, kein Download; XML 400 mit Hinweis § 19.
- **Regel UG Test** (Regelbesteuerung): Kennzahlen 81/86/66/83, „nicht geführt“, Download-Button Monat; XML `Anmeldungssteuern` v2026, Zeitraum 08, Firma-Name, ISO-8859-15 (ü), kein Kz09. Im August keine Journal-Zeilen → Nullmeldung nur Kz 83 = 0.00. Keine Steuernummer an der Firma → Hinweis + XML ohne `Steuernummer`.
- Quartal: Code 43, Dateiname `UStVA_Zettelruhe_2026_Q3.xml`.
- Jahr: Kennzahlen ja, kein Download-Button, XML 400 (kein Voranmeldungszeitraum).
- Export-Seite verweist auf die USt-Übersicht. EÜR/Auswertungen 200 (Regression).
- Isolation: Session `firmaId` — Klein-XML nicht, Regel-XML nur „Regel UG Test“.

**Browser-Nachtest (kf, 2026-08-15):** manuell im Browser geprüft, keine Probleme.

## Nicht angefasst

- ZM, USt-IdNr.-Prüfung, E-Rechnungs-Versand, Multi-User
- Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940, robustes ZUGFeRD-PDF)
- M1-15 (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf)

## Next step

Zusammenfassende Meldung (ZM) Übersicht.
