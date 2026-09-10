# Session 2026-08-15 — Multi-Firma dünn

## Done

Zweite Firma anlegen und in der Session wechseln, eine Eigentümer:in. Ziel: Kleinunternehmerregelung und Regelbesteuerung in einer Instanz, ohne zweiten Compose-Stack.

### Schnitt (gegen ADR-0002)

- Schema war schon firma-gebunden; Writes/Listen liefen über `session.firmaId`.
- `users.firma` bleibt 1:1 — Bedeutung jetzt: zuletzt aktive Firma (Login-Landung).
- Rolle weiter nur `eigentuemer`. Unique Index `firmen.name` bleibt.
- Kein Einladen, keine zweite Login-Rolle, keine Rechte-UI, keine Mitgliedschaftstabelle.
- Setup-Wizard unverändert (Erst-Firma + Erst-User).
- Steuer-Modus bleibt Einstellung pro Firma.

### Umsetzung

- ADR-0018; ADR-0002 um den UX-Nachzug ergänzt.
- `/app/firma/neu` legt an und wechselt sofort (POST `/app/firma/neu/submit`, wie Setup/Login hinter Caddy).
- Wechsler in der Shell (POST `/app/firma/wechseln`); Isolation: fremde Belege/Rechnungen/Journal → 404.
- `getFirstFirma()` von Seiten und Katalog-Actions entfernt (Steuer-Modus der aktiven Firma).
- Jobs liefen schon über alle Firmen.

### Tests

277 Unit-Tests + `tsc` grün. Kategorien lagen im Working Tree und wurden mit diesem Keil mitgenommen.

### Verifikation (laufende Instanz hinter Caddy)

- POST `/app/firma/neu/submit` → Firma **Regel UG Test** (Regelbesteuerung), Session und `users.firma` auf die neue Firma.
- Listen Belege/Rechnungen/Journal/Kontakte/Kassenbuch leer; Beleg/Rechnung der Beispiel GmbH → 404.
- Beleg/Rechnung-Formulare mit USt; USt-Übersicht zeigt Zahllast (nicht den Kleinunternehmer-Hinweis).
- Doppelter Name → Fehler „bereits“.
- Wechsel zurück zur Beispiel GmbH: Belege wieder sichtbar, USt-Übersicht „nicht relevant“, `users.firma` wieder Erst-Firma.

Testfirma **Regel UG Test** bleibt in der Instanz (zum Weiterarbeiten mit beiden Steuer-Modi).

**Browser-Nachtest (kf, 2026-08-15):** Anlegen, Wechseln und Isolation im Browser bestätigt. Kategorien + Multi-Firma dünn zusammen auf `main`.

## Nicht angefasst

- UStVA/ELSTER-XML, ZM, USt-IdNr., E-Rechnungs-Versand, Multi-User
- Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940, robustes ZUGFeRD-PDF)
- M1-15 (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf)

## Next step

UStVA-Zahlen / ELSTER-XML light (Self-File, kein Versand).
