# Session 2026-08-18 — Hybrid-PDF (Schnitt, kein Bau)

## Schnitt

**In diesem Chat**
- Prüfen, ob ein Hybrid ehrlich geht (PDF/A-3 / Factur-X ohne Mustang und ohne Chromium).
- Ergebnis dokumentieren: ADR-0026. Kein Code, keine neue Collection, kein UI-Keil.

**Nicht in diesem Chat**
- XML-Versand (ADR-0022) und `rechnungen.pdf` (ADR-0012) umbauen
- PDF + Anhang ohne PDF/A-3 als „ZUGFeRD-PDF“ oder unbeschrifteten Kleber
- Empfangspfad / robustes ZUGFeRD-PDF-Parsing (Open Decision)
- KoSIT/Schematron, Mustang, Playwright/Chromium
- Übersicht, Marke, Dokumenten-Layout, UStVA/ZM, Ist-Versteuerung, Multi-User

## Entscheidung

Hybrid **geht in diesem Stack nicht ehrlich**. Factur-X/ZUGFeRD-Hybrid verlangt PDF/A-3 plus `factur-x.xml` (Associated File), Factur-X-XMP und eingebettete Schriften. `@react-pdf/renderer` liefert PDF 1.3 mit Helvetica ohne FontFile — das ist kein PDF/A-3. `pdf-lib` kann das nicht nachträglich halten. Eine dritte Datei „PDF mit CII-Anhang“ ohne Claim wäre der Kleber, den der Kickoff ausdrücklich nicht will; fachlich sind menschliches PDF und CII-XML schon zwei Originale.

Späterer Hybrid nur mit **neuer** PDF/A-3-Pipeline und eigenem ADR — nicht als Aufkleber auf der bestehenden Sales-PDF-Strecke.

## Verifikation

Kein Produktcode geändert. Kein Testlauf nötig.

## Nicht angefasst

- `app/src/modules/einvoice/*` (XML-Strecke)
- `app/src/modules/sales/pdf.tsx` und `rechnungen.pdf`
- Empfang, Übersicht, Open Decisions
- Commit/Push

## Next step

Kassenbuch aus Barzahlung — Kickoff: [`2026-08-18-kassenbuch-barzahlung-prompt.md`](./2026-08-18-kassenbuch-barzahlung-prompt.md). Übrige Open Decisions (MT940, ZUGFeRD-Empfang-Parsing) weiter separat. Hybrid nur, wenn jemand eine begründete PDF/A-3-Pipeline vorschlägt.
