# Session 2026-08-14 — Funktionstest M1 + Nachzug

## Done

### Funktionstest
- Manueller Funktionstest M1 abgeschlossen: **bestanden mit Mängeln**
- Rohbericht: [`docs/issues/ergebnis-funktionstest-m1.md`](../issues/ergebnis-funktionstest-m1.md)
- Checkliste [`docs/funktionstest-m1.md`](../funktionstest-m1.md) mit Ergebnis/Freigabe nachgezogen

### Prio 1 — Rechnen & Datenintegrität
- **Storno in Auswertungen:** Gegenbuchung mindert die Ursprungskategorie (Umsatzerlöse / Betriebsausgaben / Kasse), statt als Gegenrichtung (sonstige Einnahme/Ausgabe) zu laufen. Gilt für EÜR, BWA, Dashboard, USt. Lookup des Originals, auch wenn es außerhalb des Zeitraums liegt.
- **Rechnungsstatus:** Journal-Storno einer Rechnungsbuchung und eigener Storno-Button auf der Rechnung setzen Status auf `storniert`.
- **Firma:** Anschrift/Steuernummer im Setup; `/app/firma` speichert Stammdaten, Nummernkreise (Prefix/Stellen/nächste Nr. nicht rückwärts) und Steuer-Modus-Wechsel mit Bestätigung. SKR bleibt unveränderbar.

### Prio 2–3
- Kontakt-CSV exportiert Ansprechpartner (erster + weitere); Import legt den ersten AP an
- Katalog- und Positions-Einheiten als Auswahlliste (Stück, Stunde, Artikel, Karton, Pauschal)
- Globales Toast (`FlashToast`) für Create/Update/Storno/…
- Bestätigungs-Modal vor Journal-, Kassen- und Rechnungs-Storno
- Zeiterfassung: Minuten im 15-Min-Raster

### Prio 4 light
- Status-Badges: Storniert (danger), Überfällig (warning)
- Dokumenten-Layout/Branding (Logo, Farben, Textbausteine) **nicht** umgesetzt — Follow-up

## Verifikation
- **244** Unit-Tests grün (`npm test` in `app/`)
- `tsc --noEmit` grün
- Browser-Klicks auf der laufenden Instanz in dieser Session nicht erneut durchgespielt

## Explizit nicht / Follow-up
- Dokumenten-Layout-Modul (Logo-Upload, Farbakzente, Kopf-/Fußtext)
- Bank-CSV-Import und E-Rechnung-Empfang im Funktionstest nachholen
- Journal-Nachzug für Zahlungen (Open Decision)
- CSS-Profi-Layouts / Font-Upload (Roadmap „Später“)

## Next step
Reihenfolge im Folgeschat klären. Neu auf der Liste: Angebot-PDF ohne E-Mail (M1-13), Rechnungs-PDF vor Festschreibung (M1-14). Daneben Layout/Branding, UI-Feinschliff, Nachtest Bank/E-Rechnung, dann M2.
