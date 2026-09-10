# Prompt — nächster Chat: Hybrid-PDF (ZUGFeRD, eigener Schnitt)

Nach Übersicht erster Keil + Follow-up. Gehört zum E-Rechnungs-Versand (ADR-0022), nicht zur Übersicht, nicht zu Open Decisions (MT940, ZUGFeRD-Empfang-Parsing, Kassenbuch aus Barzahlung) und nicht zu „Später“ (Briefpapier, Font-Upload).

Zum Starten: den Block **Kickoff** unten als erste Nachricht in den nächsten Chat legen.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach Übersicht Follow-up).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md, docs/adr/0012-belegdatei-immutable-nach-festschreibung.md, docs/adr/0014-pdf-react-pdf-renderer.md, docs/adr/0015-einvoice-anti-corruption-layer.md, docs/adr/0022-e-rechnung-versand-profile.md, docs/sessions/2026-08-15-e-rechnung-versand.md, docs/sessions/2026-08-16-dokumenten-layout.md, app/src/modules/einvoice/outbound.ts, app/src/modules/einvoice/render-cii.ts, app/src/modules/einvoice/send-repository.ts, app/src/modules/einvoice/e-rechnung-versand-card.tsx, app/src/modules/sales (PDF-Erzeugung der festgeschriebenen Rechnung).

Stand: Meilenstein 2 abgeschlossen. E-Rechnungs-Versand steht: aus festgeschriebener Rechnung XML-Original (XRechnung 3.0 UBL oder ZUGFeRD/Factur-X EN 16931 CII), Archiv `e_rechnungen_versand`, Rechnungs-PDF unangetastet. Kein Hybrid-PDF/A-3, kein KoSIT-/Mustang-Claim (ADR-0022). `@react-pdf/renderer` liefert kein PDF/A-3 (ADR-0014); Mustang-Sidecar bleibt ausgeschlossen (ADR-0015). Übersicht erster Keil und Follow-up stehen.

Reihenfolge in diesem Chat: Hybrid-PDF, eigener Schnitt. Vor dem ersten großen Umbau den Schnitt vorschlagen (was in diesem Chat, was nicht) — inklusive ob Hybrid **ehrlich** geht. Nicht bauen, wenn der einzige Weg ein unehrlicher PDF/A-3- oder Factur-X-Claim wäre. Nicht die bestehende XML-Strecke und nicht `rechnungen.pdf` umbauen, um Hybrid zu erzwingen.

Offene Frage für den Schnitt (nicht vorentscheiden):

- **Separates Hybrid-Original** neben XML und menschlichem PDF — CII in ein PDF einbetten, eigener Download, `rechnungen.pdf` bleibt das Festschreibungs-PDF (ADR-0012).
- **Nur wenn PDF/A-3 bzw. Factur-X-Niveau gehalten werden kann**, ohne Mustang und ohne Chromium. Neue Bibliothek nur mit klarem Grund (dann ADR). pdf-lib o. Ä. nur, wenn der Keil schmal bleibt und kein Zertifizierungs-Schein entsteht.
- **Ehrlicher Abbruch oder Minimal-Keil:** PDF + Anhang ohne PDF/A-3-Claim — dann im UI und in der Verfahrensdoku klar sagen, was es **nicht** ist (kein Factur-X-Konformitätslevel, kein KoSIT). Lieber nicht liefern als „ZUGFeRD-PDF“ auf ein normales PDF kleben.

Daten / Invarianten: Isolation `session.firmaId`. Nur festgeschriebene Rechnung der aktiven Firma. Bestehende Originale (Rechnungs-PDF, vorhandene XML-Versanddateien) nicht still ändern. XML-Profile und Pflichtfeldprüfung (de-DE) wiederverwenden, nicht duplizieren. Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis; 0 % nicht als Reverse Charge raten. Rolle Lesen: sehen/download ja, Erzeugen nur bei Schreibrecht.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen (nicht vermischen): Übersicht/Dashboard, Marke/Favicon, Dokumenten-Layout Angebot/Rechnung (Gerüst, Briefpapier, Fonts), Setup-verified, UStVA/ZM-Logik, Ist-Versteuerungs-Regeln, M1-15, Multi-User/Einladen/Rollen, eigenes Passwort, Empfangspfad und robustes ZUGFeRD-PDF-Parsing (Open Decision), MT940, Kassenbuch aus Barzahlung, KoSIT/Schematron/Zertifizierungs-Claim, Mustang-Sidecar, Playwright/Chromium-PDF.

---

## Schnitt-Hinweis (für den bauenden Chat, nicht festzementiert)

Sinnvoller Keil, falls Hybrid überhaupt in diesem Chat landet:

- Erst Pipeline-Beweis: vorhandenes CII (ADR-0022) in **eine neue Datei** einbetten; Round-Trip durch den bestehenden light-Parser (embedded XML).
- Download und Archiv analog `e_rechnungen_versand` oder klar benannte Erweiterung — nicht `rechnungen.pdf` überschreiben.
- UI: schmal an der bestehenden E-Rechnung-Karte, kein zweites Versand-Modul.
- Kein Factur-X-Level (BASIC/EN 16931/EXTENDED) behaupten, das wir nicht prüfen.

Wenn PDF/A-3 ohne neue, begründete Pipeline nicht geht: Schnitt dokumentieren (ADR-Ergänzung oder neuer ADR) und **nicht** halb bauen. Open Decisions bleiben eigene Chats.

Kein CSS-Profi-Layout, kein Steuerberater-Portal, kein Umbau der Übersicht.
