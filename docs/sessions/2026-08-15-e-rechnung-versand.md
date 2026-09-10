# Session 2026-08-15 — E-Rechnungs-Versand

## Done

Ausgang aus der festgeschriebenen Rechnung der aktiven Firma. Zwei XML-Profile, Pflichtfeld-Prüfung mit de-DE-Liste, Original unveränderbar neben dem PDF. Empfangspfad unverändert. Kein Hybrid-PDF, kein KoSIT-Claim.

### Schnitt

- Profile: **XRechnung 3.0 UBL** und **ZUGFeRD/Factur-X EN 16931 CII** (XML). Kein PDF/A-3, kein Mustang (ADR-0014/0015).
- Quelle: festgeschriebene Rechnung von `session.firmaId` (Nummer vorhanden). Entwürfe erzeugen nicht.
- Validierung: eigene Pflichtfelder + Steuer-Modus, keine stillen Defaults (`NA` für BT-10). XRechnung extra: Leitweg-ID/Käuferreferenz, E-Mail Firma und Kontakt. CII ohne diese Extra-Pflichten.
- Kleinunternehmerregelung: Kategorie E, 0 %, gesetzlicher Hinweis, keine USt-Zeilen. Regelbesteuerung: S 7/19; 0 % nicht als Reverse Charge geraten.
- Archiv: Collection `e_rechnungen_versand` (ein Datensatz je Rechnung+Profil). `rechnungen.pdf` wird nicht angefasst.
- Stammdaten light: `firmen.email` / `firmen.telefon`; `kontakte.leitweg_id`. IBAN vom gewählten Bankkonto.
- UI: Karte auf der festgeschriebenen Rechnung (Prüfen / Erzeugen / Download). Inbox `/app/e-rechnungen` bleibt Empfang. E-Mail hängt vorhandene XML an.

### Umsetzung

- ADR-0022.
- Migration `1730001500_e_rechnung_versand.js`.
- Modul `einvoice`: Outbound-DTO, Validator, UBL-/CII-Renderer, Send-Repository. Round-Trip durch den bestehenden Parser.

### Tests

362 Unit-Tests (13 Versand + 1 Kontakt-CSV, Empfang unverändert) + `tsc` grün.

### Verifikation (laufende Instanz hinter Caddy, Images neu gebaut)

- Migration: Collection `e_rechnungen_versand`, Felder `firmen.email`/`telefon`, `kontakte.leitweg_id`.
- Unauth `/app/rechnungen/…` und Download → 307 Login.
- Festgeschriebene **R-0004** (Beispiel GmbH, Kleinunternehmerregelung): Karte Prüfen/Erzeugen, Profile sichtbar.
- XRechnung ohne Firma-E-Mail und ohne Leitweg: 303 mit beiden de-DE-Fehlern, nichts geschrieben.
- ZUGFeRD-CII: Prüfung ok → erzeugt `R-0004-zugferd.xml` (Kategorie E, §-19-Hinweis, USt 0). Zweites Erzeugen desselben Profils abgewiesen (Original bleibt).
- Nach Stammdaten (Firma-E-Mail, Leitweg am Kontakt): XRechnung erzeugt `R-0004-xrechnung.xml` (BT-10, Endpoint EM, Hinweis § 19).
- Rechnungs-PDF unverändert (`r_0004_iyo2a2lcxn.pdf`, Download weiter `R-0004.pdf`). Empfangsliste weiter 200, 2 Inbox-Datensätze.
- Multi-Firma: Session Regel UG Test → Rechnung und XML-Download 404.

Kein Browser-Tool in der Bau-Session; der Pfad ist per HTTP wie ein Formular-Klick durchgespielt. **Browser-Nachtest durch kf 2026-08-15: soweit möglich geprüft, keine Fehler.** HTTPS/Caddy-Umbau, Setup-`verified` und Dokumenten-Layout nicht angefasst.

## Nicht angefasst

- Hybrid-ZUGFeRD-PDF/A-3, KoSIT-/Mustang-Validator
- Empfangspfad, robustes ZUGFeRD-PDF-Parsing
- Multi-User, Einladen, Rechte-UI
- UStVA-Nachzug, ZM-Art, ELSTER-Versand
- Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940)
- M1-15 (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf)
- Server-Nachtest der ganzen M2-Keile inkl. BZSt-Klick

## Next step

Funktionstest-Protokoll M2 (analog `docs/funktionstest-m1.md`) und HTTPS auf dem Server — Caddy im Compose belassen (lokal sinnvoll) vs. nativ auf dem Host. Danach Server-Nachtest inkl. BZSt-Klick. Follow-ups ohne diese Prio: Setup-`verified`, Dokumenten-Layout, Logo/Favicon.
