# Session 2026-08-17 — Ist-Versteuerung: Journal-Nachzug für Zahlungen

## Done

Zahlung erzeugt eine festgeschriebene Zufluss-Buchung im Journal (ADR-0024).

- `quelle_typ=zahlung`, Buchungsdatum = Zahlungsdatum; Steuerstaffel anteilig, letzte Zahlung ohne Cent-Drift.
- Manuell und Bank-Match über `createZahlung`. Löschen storniert das Zahlungsjournal. Rechnungs-Storno storniert es mit.
- Rechnungs-Festschreibung bleibt Forderungsbuchung (`quelle_typ=rechnung`).
- EÜR, USt, ZM, BWA, Dashboard und DATEV zählen Zufluss, nicht die Forderungsbuchung. Journal-CSV bleibt vollständig.
- Bestehende Zahlungen: idempotenter Nachzug beim Öffnen der App (`session.firmaId`).
- Migration `1730001800_journal_quelle_zahlung.js`.

Nicht vermischt: Kassenbuch aus Barzahlung, Marke, Dokumenten-Layout, UStVA/ZM-Kennzahlen-Mapping, Setup-verified, M1-15.

## Verifikation

402 Unit-Tests + `tsc --noEmit` grün. Browser-Nachtest durch kf ausstehend (Regelbesteuerung: Rechnung festschreiben, Teilzahlung, EÜR/USt nach Zahlungsdatum; Kleinunternehmerregelung: Zufluss in der EÜR). Bestehende Zahlungen: einmal App öffnen (Nachzug). PB-Migration `1730001800` beim nächsten Stack-Start.

## Nicht angefasst

- Marke/Favicon, Dokumenten-Layout-Vertiefung, Setup-verified, UStVA/ZM-Logik (nur Hinweistexte + Journal-Quelle), M1-15
- Multi-User, Hybrid-PDF, Kassenbuch aus Barzahlung, MT940, ZUGFeRD-PDF-Parsing
- Commit/Push

## Next step

Gleichwertig: UX/UI (App) oder Multi-User / grobe Rechte. Nicht vermischen.
