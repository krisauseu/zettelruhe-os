# Prompt — nächster Chat: Kassenbuch aus Barzahlung (eigener Schnitt)

Nach Hybrid-PDF-Schnitt (ADR-0026, kein Bau). Erste Open Decision in `docs/90-status.md`. Gehört zu Zahlung + Kassenbuch, nicht zu MT940, nicht zu ZUGFeRD-Empfang-Parsing, nicht zu Hybrid/PDF/A-3 und nicht zu „Später“.

Zum Starten: den Block **Kickoff** unten als erste Nachricht in den nächsten Chat legen.

---

## Kickoff

Zettelruhe, Repo /Users/kf/zettelruhe. Glossary: CONTEXT.md. Stack: Next.js 16 + PocketBase. HTTPS: Host-Caddy, app.zettelruhe.de (ADR-0023). HEAD origin/main (nach Hybrid-PDF-Schnitt, ADR-0026).

Lies zuerst: docs/90-status.md, CONTEXT.md, docs/feature-roadmap.md, docs/adr/0004-gobd-mindeststandard-ohne-zertifizierung.md, docs/adr/0012-belegdatei-immutable-nach-festschreibung.md, docs/adr/0017-kategorien-stammdaten.md, docs/adr/0024-ist-versteuerung-zahlungsjournal.md, docs/sessions/2026-08-12-bauabschnitt-8-zahlungen.md, docs/sessions/2026-08-12-bauabschnitt-9-kassenbuch.md, docs/sessions/2026-08-17-ist-versteuerung-zahlungsjournal.md, app/src/modules/payments/repository.ts (`createZahlung`, `deleteZahlung`), app/src/modules/payments/journal.ts, app/src/modules/payments/zahlung-form.tsx, app/src/modules/cash (Invarianten, Repository, Journal-Input), app/src/modules/reporting/aggregate.ts (`mapEurKategorieFromQuelle`).

Stand: Meilenstein 2 abgeschlossen. Zahlung erzeugt Zufluss-Journal (`quelle_typ=zahlung`, ADR-0024). Kassenbuch steht: Anlegen = Festschreibung, Saldo ≥ 0, Journal `quelle_typ=kasse`, eine Kasse je Firma, getrennt von Bankkonten. Zahlungsweg `bar` ist nur Markierung; das Formular sagt das explizit. Bank-Match setzt `ueberweisung`. Hybrid-PDF zurückgestellt (ADR-0026). EÜR mappt Zahlung → Umsatzerlöse und Kassen-Einnahme → Bareinnahmen — zwei Quellen gleichzeitig zu zählen verdoppelt die Einnahme.

Reihenfolge in diesem Chat: Kassenbuch aus Barzahlung, eigener Schnitt. Vor dem ersten großen Umbau den Schnitt vorschlagen (was in diesem Chat, was nicht) — inklusive ob der Keil **ohne doppelte Einnahme** ehrlich geht. Nicht bauen, wenn der einzige Weg EÜR/USt/DATEV verdoppelt oder ADR-0024 aufweicht (Zufluss bleibt an der Zahlung). Nicht das manuelle Kassenbuch und nicht die Ist-Versteuerungs-Regeln umbauen, um den Keil zu erzwingen.

Offene Frage für den Schnitt (nicht vorentscheiden):

- **Satellit der Zahlung:** Barzahlung erzeugt einen Kassenbuch-Eintrag (Saldo, Belegnummer, GoBD-Kasse), **ohne** zweites Einnahmen-Journal. Zufluss bleibt `quelle_typ=zahlung`. Dann ehrlich sagen, dass dieser Eintrag anders ist als ein manueller Kassenbuch-Satz (der weiter Journal schreibt).
- **Gleicher Schreibpfad wie manuell:** Eintrag inkl. `quelle_typ=kasse` — nur zulässig, wenn Auswertungen und DATEV die Einnahme **nicht** ein zweites Mal zählen. Journal-CSV darf keinen Schein erzeugen.
- **Ehrlicher Abbruch:** Wenn jeder Weg entweder doppelt zählt oder die Kassen-Invariante (Anlegen = Journal) still bricht, Schnitt dokumentieren (ADR) und **nicht** halb bauen. Lieber der heutige Hinweis im Formular als eine zweite Umsatzerfassung.

Daten / Invarianten: Isolation `session.firmaId`. Nur festgeschriebene Rechnung der aktiven Firma. Zahlungsweg wirklich `bar` — nicht Überweisung, nicht Bank-Match. Teilzahlung: ein Kassen-Satz je Barzahlung, Betrag = Zahlungsbetrag. Löschen der Zahlung bzw. Rechnungs-Storno muss den Kassen-Satz mit stornieren (Gegenbuchung, kein stilles Löschen). Bestehende manuelle Kassenbuch-Originale nicht still ändern. Saldo ≥ 0 bleibt. Kategorie als Text-Schnappschuss (ADR-0017), nicht raten und nicht die Stammliste zwangsweise füllen. Rolle Lesen: sehen ja, Erzeugen nur bei Schreibrecht.

Invarianten: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). Fachbegriffe wie in CONTEXT.md. de-DE im UI.
Commit/Push nur auf ausdrückliche Bitte.

Nicht anfassen (nicht vermischen): Übersicht/Dashboard, Marke/Favicon, Dokumenten-Layout Angebot/Rechnung, Setup-verified, UStVA/ZM-Logik, Ist-Versteuerungs-Regeln (Zufluss-Quelle), M1-15, Multi-User/Einladen/Rollen, eigenes Passwort, E-Rechnungs-Versand/Empfang, Hybrid-PDF, MT940, robustes ZUGFeRD-PDF-Parsing, Multi-Kasse, Kassenabschluss, TSE, Bank-CSV.

---

## Schnitt-Hinweis (für den bauenden Chat, nicht festzementiert)

Sinnvoller Keil, falls der Weg ehrlich ist:

- Hängen an `createZahlung` / `deleteZahlung` (und Rechnungs-Storno), nicht ein zweites Zahlungsmodul.
- Bestehenden Kassen-Schreibpfad wiederverwenden (`festschreibenKassenbuchEintrag` / Storno), nicht kopieren.
- Verknüpfung Zahlung ↔ Kassenbuch-Eintrag explizit und idempotent (ein Satz je Barzahlung).
- UI: Hinweis an der Zahlungskarte anpassen; Kassenbuch-Detail darf die Herkunft zeigen. Kein neues Modul in der Nav.
- Bestehende Barzahlungen: im Schnitt sagen, ob Nachzug (idempotent, wie ADR-0024) oder nur ab jetzt — nicht still die Historie verbiegen.

Wenn doppelte Einnahme ohne neue, begründete Regel nicht vermeidbar ist: Schnitt dokumentieren und nicht halb bauen. Die anderen Open Decisions (MT940, ZUGFeRD-Empfang-Parsing) bleiben eigene Chats.

Kein CSS-Profi-Layout, kein Steuerberater-Portal, kein Umbau der Übersicht.
