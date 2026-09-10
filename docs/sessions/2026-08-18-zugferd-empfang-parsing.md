# Session 2026-08-18 — ZUGFeRD-Empfang-Parsing (PDF-Attachment)

## Schnitt

**In diesem Chat**
- `extractXmlFromPdf`: `/Type /EmbeddedFile` inkl. Flate (`zlib`), verschachteltes `/Params`, umbrochenes `/Type`.
- Erstes CII-/UBL-XML an den bestehenden Parser. Bekannte Dateinamen als Auswahl, nicht als Validator.
- Unkomprimiertes XML im Bytestrom bleibt Fallback.
- UI `/app/e-rechnungen`: ehrlich (Scan-PDF ohne Anhang ist keine E-Rechnung).
- ADR-0029. Fixtures synthetisch (kein Corpus-/Kunden-PDF).
- DTO, Beleg-Entwurf, Archiv, Isolation `session.firmaId` unverändert. Kein Inbox-Nachparse.

**Nicht in diesem Chat**
- Versand (ADR-0022), Hybrid-PDF/A-3 (ADR-0026), Alltags-PDF, `pdf-lib`, Mustang, KoSIT
- Übersicht, Marke, Dokumenten-Layout, UStVA/ZM, Ist-Versteuerung, Multi-User, Passwort, MT940, Kassenbuch

## Entscheidung

Der Keil **geht ehrlich**. Gehalten: Anhang lesen (keine oder Flate-Kompression). Nicht gehalten: PDF/A-3, Factur-X-Level, XMP, Verschlüsselung, Beträge aus PDF-Text.

## Done

- `parse-pdf-xml.ts`; Fassade und Fehlertexte in `parse.ts`.
- Upload- und Listen-Hinweis; Parse-Fehler nennt XML oder Beleg manuell.
- Tests: unkomprimiert bleibt, Flate-`factur-x.xml`, intarsys-ähnliches Dict, Namenspräferenz, PDF ohne XML, Flate-Content ohne `/EmbeddedFile`, `/Encrypt`.

## Verifikation

494 Unit-Tests + `tsc --noEmit` grün. Browser-Klick auf Upload nicht in dieser Session (kein lokales Browser-Tool); Empfangspfad unverändert außer Parser und Hinweistexte.

## Nicht angefasst

- `render-cii.ts` / `render-ubl.ts` / Versand-UI
- `rechnungen.pdf`, Hybrid, Inbox-Records

## Next step

Open Decisions nach M2 sind leer. Orientierung: [`2026-08-18-nach-m2-kein-offener-keil-prompt.md`](./2026-08-18-nach-m2-kein-offener-keil-prompt.md). Nicht von selbst in OCR, PSD2, Mahnlauf oder Briefpapier.
