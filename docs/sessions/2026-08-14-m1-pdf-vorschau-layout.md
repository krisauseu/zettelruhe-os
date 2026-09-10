# Session 2026-08-14 — PDF-Vorschau, Layout, UI-Feinschliff

## Done

### M1-13 + M1-14 (gemeinsamer Schnitt)
- Entwurfs-PDF on-the-fly mit Wasserzeichen „Entwurf“, ohne Nummernkreis, ohne Persistenz, ohne Journal
- Routen: `/app/angebote/[id]/pdf/vorschau`, `/app/rechnungen/[id]/pdf/vorschau`
- Original-PDF unverändert erst bei **Senden** (Angebot) bzw. **Festschreibung** (Rechnung); `/pdf` lehnt Entwürfe ab (409)
- Vorschau nach Senden/Festschreibung abgelehnt — nur noch das Original
- UX: Senden ≠ Mail. Druck/Post über PDF; E-Mail optional und sekundär
- Invarianten + Dateiname/Nummer-Helfer getestet

### M1-10 Dokumenten-Layout light
- PB-Migration `1730001200_dokument_layout.js`: Logo, Akzentfarbe, Kopf-/Fußtext an der Firma
- `/app/firma`: Upload/Entfernen Logo, Farbwähler, Textbausteine
- Gilt für neue Vorschau- und Original-PDFs; bestehende Originale bleiben unverändert (ADR-0012)

### M1-12 UI-Feinschliff light
- Primärfarbe etwas kräftiger; Markenstrich in der Sidebar; mehr Abstand auf Dokumentseiten; Toast mit Erfolgs-Akzent
- Kein CSS-Profi-Layout (Roadmap „Später“)

## Verifikation
- 261 Unit-Tests + `tsc --noEmit` grün
- Compose neu gebaut; Migration `1730001200` an der Firma
- HTTP gegen lokale Instanz: Vorschau = `%PDF` ohne Nummernverbrauch; Original-Route am Entwurf 409; Vorschau nach Senden/Festschreibung 409; neue Vorschau übernimmt Akzentfarbe. Kein Klick-Browser (localhost von außen nicht erreichbar).

## Git
- `main` @ `2ce18d9` — `https://github.com/krisauseu/zettelruhe`

## Explizit nicht
- Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen
- GiroCode
- M1-11 Nachtest Bank/E-Rechnung (folgt als Nächstes, nur testen)
- M2 / Open Decisions

## Next step (verbindlich)

1. **M1-11 nachtesten** (Bank-CSV, E-Rechnung-Empfang) — kein Bau.
2. **M2 starten** mit UStVA/ELSTER-XML light.
3. Open Decisions (Journal aus Zahlung, Kasse aus Barzahlung, MT940, ZUGFeRD-PDF) getrennt halten.
