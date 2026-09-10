# Prompt — nächster Chat: kein offener Keil nach M2

Nach ZUGFeRD-Empfang-Parsing (ADR-0029). **Open Decisions in `docs/90-status.md` sind leer.** Roadmap „Später“ (OCR, PSD2, Mahnlauf, Briefpapier, …) nicht von selbst aufmachen.

Zum Starten: den Block **Kickoff** unten nur dann als erste Nachricht legen, wenn kf einen konkreten nächsten Schnitt nennt. Sonst `/status` und warten.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach ZUGFeRD-Empfang ADR-0029).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md.

Stand: Meilenstein 2 abgeschlossen. Letzte Open Decision (ZUGFeRD-PDF-Attachment, ADR-0029) erledigt. Empfang liest `/EmbeddedFiles` inkl. Flate. Versand bleibt XML (ADR-0022). Hybrid-PDF: kein Bau (ADR-0026). MT940: ADR-0028.

**Kein selbstgewählter Umbau.** Nächster Schnitt nur der, den kf in dieser Nachricht benennt. Nicht in Roadmap „Später“ springen (OCR, PSD2, Mahnlauf, Briefpapier, Font-Upload, REST-API, Kundenportal, …).

Wenn kf nichts benennt: Status kurz, keine Code-Änderung.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen, solange nicht ausdrücklich dieser Schnitt: Übersicht/Dashboard, Marke/Favicon, Dokumenten-Layout Angebot/Rechnung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerung, Multi-User/Einladen/Rollen, eigenes Passwort, E-Rechnungs-Versand, Empfang/ADR-0029, Hybrid-PDF/A-3, MT940/CAMT, Kassenbuch, Bank-Import, KoSIT/Schematron, Mustang, Roadmap „Später“.
