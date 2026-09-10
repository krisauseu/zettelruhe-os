# Prompt — nächster Chat: Robustes ZUGFeRD-Empfang-Parsing (eigener Schnitt)

Nach MT940 (ADR-0028) inkl. bunq-Nachzug (`:25:` ohne Währung, `:86:` REMI/NAME). **Letzte Open Decision** in `docs/90-status.md` nach Meilenstein 2. Gehört zum E-Rechnungs-**Empfang** (BA12, ADR-0003, ADR-0015), nicht zum Versand (ADR-0022), nicht zu Hybrid-PDF/A-3 (ADR-0026) und nicht zu Roadmap „Später“.

Zum Starten: den Block **Kickoff** unten als erste Nachricht in den nächsten Chat legen.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach MT940 bunq-Nachzug, ADR-0028, `c769bcd`).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md, docs/adr/0003-e-rechnung-empfang-vor-versand.md, docs/adr/0012-belegdatei-immutable-nach-festschreibung.md, docs/adr/0015-einvoice-anti-corruption-layer.md, docs/adr/0022-e-rechnung-versand-profile.md, docs/adr/0026-hybrid-pdf-erst-mit-pdfa3-pipeline.md, docs/sessions/2026-08-12-bauabschnitt-12-e-rechnung-empfang.md, docs/sessions/2026-08-15-e-rechnung-versand.md, app/src/modules/einvoice/parse.ts, app/src/modules/einvoice/parse-utils.ts (`extractXmlFromPdf`), app/src/modules/einvoice/parse-cii.ts, app/src/modules/einvoice/parse.test.ts, app/src/modules/einvoice/repository.ts, app/src/modules/einvoice/actions.ts, app/src/app/app/e-rechnungen/neu/page.tsx.

Stand: Meilenstein 2 abgeschlossen. Empfang archiviert das Original unverändert und parst XRechnung-UBL sowie ZUGFeRD/CII als **standalone XML**. ZUGFeRD-PDF: nur light Byte-Scan (`extractXmlFromPdf` sucht unkomprimiertes XML im Bytestrom). Typische Factur-X-Attachments liegen Flate-komprimiert in `/EmbeddedFiles` — der light Scan findet sie nicht. Versand bleibt XML-Original (ADR-0022). Hybrid-PDF: kein Bau (ADR-0026). MT940: eigener Parser, klassisches SWIFT/STA inkl. bunq-`:25:`/`:86:` (ADR-0028).

Reihenfolge in diesem Chat: ZUGFeRD-Empfang-Parsing, eigener Schnitt. Vor dem ersten großen Umbau den Schnitt vorschlagen (was in diesem Chat, was nicht) — inklusive welches PDF-Niveau **ehrlich** gehalten wird. Nicht bauen, wenn der einzige Weg ein unehrlicher „ZUGFeRD-PDF“-Claim wäre (XML geraten, Flate ignoriert, beliebiges PDF als E-Rechnung). Nicht den Versand und nicht das Alltags-PDF umbauen, um Empfang zu erzwingen. Mustang bleibt ausgeschlossen (ADR-0015).

Offene Frage für den Schnitt (nicht vorentscheiden):

- **Parser-Keil:** PDF-Attachment ehrlich lesen (`/EmbeddedFiles` + Flate), erstes `factur-x.xml` / `zugferd-invoice.xml` / CII-XML an den bestehenden CII-Parser. DTO `ParsedEInvoice` und Beleg-Entwurf unverändert. Original bleibt archiviert (auch bei Parse-Fehler).
- **Neue Bibliothek** nur mit klarem Grund (dann ADR). `pdf-lib` zum **Lesen** von Embedded Files kann ehrlich sein — nicht zum Schreiben eines Hybrids (ADR-0026). Kitchen-Sink-Validierung (KoSIT/Schematron) nicht ziehen.
- **Ehrlicher Abbruch:** Wenn nur unkomprimiertes XML haltbar bleibt, das so sagen — im UI und in der Doku. Lieber „XML hochladen oder Beleg manuell“ als ein Parser, der Beträge aus dem PDF-Text rät.

Daten / Invarianten: Isolation `session.firmaId`. Original unverändert (ADR-0012). Domain hängt am DTO, nicht an der PDF-Lib (ADR-0015). Festschreibung nur über Beleg, Empfang allein schreibt kein Journal. Rolle Lesen: sehen ja, Upload nur bei Schreibrecht. Bereits archivierte Empfänge nicht still umschreiben.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen (nicht vermischen): Übersicht/Dashboard, Marke/Favicon, Dokumenten-Layout Angebot/Rechnung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerung, Multi-User/Einladen/Rollen, eigenes Passwort, E-Rechnungs-**Versand**, Hybrid-PDF/A-3, MT940/CAMT, Kassenbuch, Bank-Import, KoSIT/Schematron/Zertifizierungs-Claim, Mustang-Sidecar, Roadmap „Später“ (OCR, PSD2, Mahnlauf, Briefpapier, …).

---

## Schnitt-Hinweis (für den bauenden Chat, nicht festzementiert)

Sinnvoller Keil, falls der Weg ehrlich ist:

- `extractXmlFromPdf` so weit, dass ein komprimiertes Factur-X-Attachment gefunden wird — oder klar dokumentieren, warum nicht.
- Bestehenden CII-Adapter wiederverwenden; kein zweiter Empfangspfad.
- Fixtures klein und synthetisch (kein Kunden-PDF). Tests: unkomprimiert bleibt, Flate-Attachment, PDF ohne XML bleibt Fehler.
- UI: bestehende Empfangs-Seite (`/app/e-rechnungen`); Fehlertext ehrlich (kein „ZUGFeRD erkannt“ ohne XML).

Wenn das Attachment ohne Raten oder ohne verbotene Lib nicht haltbar ist: Schnitt dokumentieren (ADR) und **nicht** halb bauen. Hybrid-Versand bleibt ADR-0026.

Kein CSS-Profi-Layout, kein Steuerberater-Portal, kein Umbau der Übersicht.
