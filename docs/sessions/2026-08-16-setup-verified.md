# Session 2026-08-16 — M2 schließen + Setup-verified

## Done

### M2 schließen (nur Dokumentation)

Meilenstein 2 **abgeschlossen**. Funktionstest M2 lokal und auf dem Server (HTTPS) inkl. Nachtest M2-01 bestanden. Freigabe **M2 Alltag trägt**. Blocker keine.

Aktualisiert: `docs/90-status.md`, `docs/feature-roadmap.md`, `CONTEXT.md`, `docs/funktionstest-m2.md`, `docs/issues/ergebnis-funktionstest-m2.md`, Session-Log M2-01. ADR-0009 um den Auth-Satz ergänzt (Login hängt nicht an `users.verified`).

Kein Meilenstein-3-Gerüst. Invariante unverändert: Zahlung erzeugt in v1 kein Journal.

### Setup-verified

Nach initialem Registrieren / Firma-Anlegen hängt der Login der Eigentümer:in nicht an `users.verified`.

- Beim Anlegen (`createEigentuemer` / Setup-Wizard): `verified: true`.
- PocketBase: `users.authRule` leer (Leerstring, nicht null). Kein SMTP-Pflichtpfad, keine E-Mail-Bestätigung.
- Bestehende Instanz: unverifizierte User einmalig auf `verified = true`; bereits verifizierte bleiben verifiziert.
- Multi-Firma (ADR-0018) und Setup-Wizard unverändert: Setup nicht erneut, keine zweite Login-Rolle.

373 Unit-Tests + `tsc` grün.

## Nicht angefasst

- Dokumenten-Layout, Logo/Favicon
- Multi-User, Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940, ZUGFeRD-PDF-Parsing)
- Hybrid-PDF, M1-15, UStVA/ZM-Logik, Ist-Versteuerung
- Commit/Push

## Next step

Dokumenten-Layout (Angebot/Rechnung), danach Logo/Favicon.
