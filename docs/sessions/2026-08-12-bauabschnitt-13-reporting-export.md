# Session 2026-08-12 — Bauabschnitt 13 (Reporting/Export)

## Done

- Modul **reporting** aus Skelett befüllt (read-only + Download-Artefakte):
  - Perioden Europe/Berlin: Monat / Quartal / Jahr / custom (`periods.ts`)
  - Aggregationen pure: EÜR light, USt-Übersicht, BWA light, Dashboard (`aggregate.ts`)
  - Journal = Source of Truth; Storno-Gegenbuchungen als normale Zeilen (Netto-Effekt)
  - Keine Finanz-Write-Collections; keine Journal-Mutationen
- **EÜR light**: Kategorien nach `quelle_typ` + Richtung (Umsatzerlöse, Bareinnahmen, Betriebsausgaben, …); beide Steuer-Modi
- **USt-Übersicht**: nur Regelbesteuerung (`verfuegbar`); unter Kleinunternehmerregelung Hinweis; kein ELSTER
- **Dashboard light**: Einnahmen/Ausgaben/Überschuss Monat, offene Posten (payments), optional USt-Zahllast; Widgets auf `/app` + `/app/auswertungen`
- **Exporte**:
  - DATEV light CSV (`zettelruhe-datev-csv-light-v1`, EXTF-ähnlich, **kein** Zertifizierungs-Claim)
  - Journal-CSV (Semikolon, UTF-8 BOM, Beträge de-DE)
  - Belegarchiv-ZIP (README + Metadaten-CSV + `dateien/`; Store-ZIP ohne Extra-Dep)
- UI: `/app/auswertungen`, `/app/eur`, `/app/ust`, `/app/export` + Download-Routen unter `/app/export/*` (nicht `/api/*`)
- Nav: **Auswertungen**, **EÜR**, **USt-Übersicht**, **Export**
- GoBD: `docs/verfahrensdokumentation.md` Vorlage
- Unit-Tests Perioden/EÜR/USt/Guards/DATEV/CSV/ZIP — **232** gesamt grün
- `docker compose build next` + `up`: Routen 307→Login; Typecheck grün

## Ehrliche Abgrenzung (Ist-Versteuerung)

- **Zahlungen** (manuell / Bank-Match) erzeugen **kein** Journal.
- EÜR, DATEV und USt-Übersicht basieren ausschließlich auf **Journal-Zeilen** (Beleg/Rechnung/Kasse/manuell/Storno).
- Offene Posten auf dem Dashboard kommen aus `payments`/`sales` und sind separat ausgewiesen.
- Folge: „Rechnung festgeschrieben und im Journal, Zahlung erfasst, aber Zahlung nicht als Journal-Ereignis“ — dokumentiert, kein stiller Journal-Nachzug in BA13.

## Explizit nicht / Follow-up

- ELSTER-Versand / UStVA-Abgabe
- E-Rechnungs-Versand
- Journal-Nachzug für Zahlungen (Open Decision)
- Bilanz / GuV / doppelte Buchführung
- DATEV-Services-Push / Zertifizierung
- Globale Volltextsuche (Roadmap — BA14 optional)
- MT940, PSD2, OCR

## Next step

Bauabschnitt 14: Härten (Backup-Doku, Security light, UX-Polish, optional Suche).
