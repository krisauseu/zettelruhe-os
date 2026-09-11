# Status — Zettelruhe

2026-09-11: Optionale Positionsbeschreibungen für Angebote und Rechnungen
sind implementiert und lokal geprüft (TP-031). Formulare, Persistenz,
Angebotsübernahme und PDF sind ergänzt. Migration und Hooks müssen zusammen
mit der App ausgerollt werden. Kein Deployment; [Abnahme](testphase.md#tp-031-optionale-positionsbeschreibung-2026-09-11).

Stand nach v1.0.0: Der generische [serverseitige Instanzkontext](instance-context.md)
für Cloud-TP-002 ist implementiert und lokal mit einer gemeinsamen Next-Anwendung
und getrennten PocketBase-Instanzen geprüft. Self-Hosting bleibt verfügbar.
Dies ist ein Entwicklungsstand, kein neuer veröffentlichter Release oder Deployment.


Stand: 2026-09-10, Release `v1.0.0` im bereinigten Repository
`krisauseu/zettelruhe-os`.

Die technischen Releasekorrekturen und lokalen Prüfungen sind abgeschlossen.
Der Release entsteht im neuen Repository mit bereinigtem Initial-Commit; die
frühere öffentliche Historie mit falsch hochgeladenen Dateien wird nicht
fortgeführt. [Abnahme](issues/release-abnahme-2026-09-10.md),
[Materialbefund](issues/release-materialpruefung-2026-09-10.md) und
[Release Notes](../CHANGELOG.md) halten Entscheidung und Prüfgrenzen fest.

## Aktueller Stand

M1 und M2 sind abgeschlossen. Der Git-Tag `meilenstein-2` beschreibt einen
früheren Stand des Vorgänger-Repositorys. Der stabile Open-Source-Stand ist
`v1.0.0` im neuen Repository. PR #1 aus dem Vorgänger-Repository wurde nicht
übernommen. Der nächste Schritt nach dem Release bleibt das separate
[Cloud-Projekt](release-und-cloud-plan.md).

Betreiberbestätigung vom 2026-09-10: Reverse Charge ist auf dem Produktions-VPS
getestet und live. Die frühere ELSTER-Prüfsperre ist aufgehoben und nicht mehr
Teil der offenen Aufgaben. Zettelruhe bietet lediglich einen XML-Datenexport.

| Änderung | Implementierung und Nachweis | Noch offen |
|---|---|---|
| Belegerfassung und Stammdaten, TP-001–019 | Mehrfachdateien, Fotoverkleinerung, Kontaktnummer, PDF-Verbesserungen, Webseite/Kontoinhaber, Jahresansicht, Kategorie-Richtung und Geschäftspartner je Belegrichtung. Einzelheiten im [Testphase-Log](testphase.md). | TP-009, eigene Mengeneinheiten, bleibt zurückgestellt. |
| Isolation, Migration und atomare Abschlüsse, TP-020–022 | Direkte PocketBase-Zugriffe abgesichert; TP-021 ohne nötige Datenkorrektur abgeschlossen. Beleg-, Rechnungs- und Kassenabschluss atomar. Betreiberbestätigung für TP-022 auf drei Umgebungen vom 2026-09-07. | Die lokale Releasekorrektur TP-028 ergänzt Zahlung, Bankmatching und Rechnungsstorno; kein neuer VPS-Nachweis. |
| E-Rechnungs-Redirect, TP-023 | Lokal und beide VPS geprüft. Letzter dokumentierter Produktionscommit `003c2d8`, 2026-09-07. | Kein neuer Betriebsnachweis im heutigen Audit. |
| Vollständige Exporte, TP-024 | Lokal abgenommen; vollständige Pagination, Abbruch bei fehlender Datei, ZIP-Dateinutzlast höchstens 256 MiB. | VPS-Abnahme nicht dokumentiert; Streaming später. |
| Reverse Charge, Abschnitte 1–3 | EU-/Drittlandsdienstleistungen in EUR, Erfassung, atomare Schnappschüsse/Korrektur, UStVA und Exporte. Freigabe in Next und PB seit `6d4de5b` geöffnet, lokale Abnahme dokumentiert. | Produktivtest und Livebetrieb vom Betreiber am 2026-09-10 bestätigt. Exakter Produktionscommit nicht genannt. Keine offene ELSTER-Freigabe; kein ELSTER-Versand. |
| RC-Formular, TP-025 und TP-026 | Gespeicherten Entwurf wieder laden; anschließend Erfassung vereinfacht, automatische Angaben und eingeklappte Details. Code bis `961d06d`. | TP-026 im isolierten Releasebrowser nachgeprüft; bewusst einfache RC-Bedienung erhalten. |

Die RC-Fachgrenzen und Bedienung stehen in der
[RC-Umsetzung](reverse-charge-umsetzung.md), technische Einstiege und bekannte
Befunde in [Entwicklung](entwicklung.md). Die vorhandenen Audit-Dokumentationsänderungen
sind erhalten und einbezogen. Die schon vorher vorhandene Löschung des VPS-Berichts
ist keine Releaseänderung dieses Auftrags. Ein Dokumentationsdatum ist keine
Deploymentbestätigung. Der Release ersetzt keine offene VPS- oder Produktionsabnahme.

## Historie bis Meilenstein 2 und technische Nachzüge

Die folgenden Einträge halten damalige Ergebnisse fest. Testzahlen, Betriebsstände
und frühe Einschränkungen gelten für den jeweils beschriebenen Schritt.
Aktuelle Änderungen und Abnahmegrenzen stehen oben.

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0030
- **Bauabschnitt 1–14** erledigt (Fundament → Härten)
- **Funktionstest M1** manuell durchgeführt: **bestanden mit Mängeln** — Rohbericht [`issues/ergebnis-funktionstest-m1.md`](./issues/ergebnis-funktionstest-m1.md)
- **M1-Nachzug** aus dem Test:
  - Storno mindert in EÜR/BWA/USt die Ursprungskategorie (nicht Gegenrichtung)
  - Rechnungsstatus wird beim Storno zuverlässig **storniert**; Storno-UI + Bestätigungs-Modal
  - Firma: Anschrift im Setup; `/app/firma` editierbar inkl. Nummernkreise und Steuer-Modus-Wechsel
  - Kontakt-CSV inkl. Ansprechpartner; Katalog-Einheiten als Auswahlliste; Zeiten 15-Min-Raster
  - Globale Toasts für schreibende Aktionen
- **M1-13 + M1-14:** Entwurfs-PDF on-the-fly (Wasserzeichen „Entwurf“, kein Nummernkreis, kein Journal); Original erst bei Senden / Festschreibung; E-Mail optional
- **M1-10:** Dokumenten-Layout light (Logo, Akzentfarbe, Kopf-/Fußtext) an der Firma
- **M1-12:** UI-Akzente light (kein CSS-Profi-Layout)
- 389 Unit-Tests grün (nach Dokumenten-Layout)
- **M1-11 nachgetestet** (2026-08-15): Bank-CSV de-DE inkl. Idempotenz und Match gegen offene Rechnung; E-Rechnung-Empfang mit beiden Fixtures. Der damalige Mangel M1-15 (`NEXT_REDIRECT` nach Import / Beleg-Entwurf) ist mit TP-023 vollständig behoben.
- **Kategorien** (ADR-0017): gemeinsame Auswahlliste für Belege und Kassenbuch, CRUD unter `/app/kategorien`
- **Multi-Firma dünn** (ADR-0018): zweite Firma anlegen + in der Shell wechseln; `users.firma` bleibt 1:1 (zuletzt aktiv); Isolation über `session.firmaId`. Kein Einladen, keine zweite Rolle, Setup unverändert. 277 Unit-Tests grün. Browser-Nachtest durch kf 2026-08-15.
- **Sidebar:** Gruppen kollabierbar (Default offen), Zustand + Favoriten in localStorage, Auto-Open der aktiven Route, „Alle öffnen/schließen“, „Nur Favoriten“. 291 Unit-Tests.
- **UStVA / ELSTER-XML light** (ADR-0019): Kennzahlen 81/86/66/83 und RC 46/47, 84/85 und 67. RC folgt dem gespeicherten Steuerdatum; normale Umsätze dem Buchungsdatum. Unter § 19 öffnet sich nur ein begrenzter RC-Arbeitsfall. XML bleibt 2026, Monat/Quartal und ein lokaler Self-File-Export ohne Versand.
- **Reverse Charge, Abschnitte 1–3:** EU-/Drittlandsdienstleistungen in EUR, unveränderbare Schnappschüsse, atomare Festschreibung, Storno/Korrektur, Reporting, UStVA und vollständige Journal-/Archivexporte. DATEV light lehnt RC-Zeiträume vollständig ab. Die öffentliche Freigabe in Next und PocketBase ist nach vollständiger lokaler Regression geöffnet. Zettelruhe hat keine ELSTER-Schnittstelle und erzeugt nur XML; eine amtliche ELSTER-Entwicklerfreigabe gehört nicht zu diesem Schritt. Nachtrag 2026-09-10: Betreiber bestätigt Produktions-VPS-Test und Livebetrieb.
- **ZM-Übersicht** (ADR-0020): unter Regelbesteuerung Kandidaten aus 0-USt-Einnahmen plus Land am Kontakt (`/app/zm`); Art nicht geführt; CSV light, kein Versand. Kleinunternehmerregelung „nicht relevant“. Browser-Nachtest durch kf 2026-08-15: keine Fehler.
- **USt-IdNr.-Validierung (BZSt)** (ADR-0021): `ust_id` am Kontakt; eigene Nummer an der Firma als Anfragende; eVatR-REST einfach/qualifiziert als Schnappschuss, kein Dauer-Stempel. Kleinunternehmerregelung: Nummer erlaubt, USt/ZM unverändert nicht relevant. Browser (kf, 2026-08-15, lokal HTTP): Eingabe und Speichern der USt-IdNr. ohne Fehler. Klick-Prüfung beim BZSt lokal nicht prüfbar (kein HTTPS / ausgehender eVatR-Zugang).
- **E-Rechnungs-Versand** (ADR-0022): aus festgeschriebener Rechnung der aktiven Firma XML-Original (Profil XRechnung 3.0 UBL oder ZUGFeRD/Factur-X EN 16931 CII). Pflichtfeld- und Steuer-Modus-Prüfung mit de-DE-Fehlerliste; Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis. Archiv in `e_rechnungen_versand`, Rechnungs-PDF unangetastet. Kein Hybrid-PDF/A-3, kein KoSIT-Claim, Empfangspfad unverändert. 362 Unit-Tests. Lokal hinter Caddy (2026-08-15): Prüfung, Erzeugung beider Profile auf R-0004, PDF unverändert, Isolation über `session.firmaId`. **Browser-Nachtest durch kf 2026-08-15: keine Fehler.**
- **Funktionstest-Protokoll M2:** [`funktionstest-m2.md`](./funktionstest-m2.md) (Vorlage M1; nur M2-Keile plus gezielte Regression und Server-Nachtest). M1-Checkliste nicht umgebaut.
- **HTTPS / Caddy (ADR-0023):** Caddy nativ auf dem Server (`app.zettelruhe.de`, Let’s Encrypt). Compose-Caddy nur lokal (HTTP:80). Overlay `docker-compose.server.yml`, Site-Block `deploy/Caddyfile.host`. `/_/` über denselben Host (explizit). Next↔PocketBase intern. Server-Nachtest durch kf (2026-08-15/16) über `https://app.zettelruhe.de`.
- **Funktionstest M2** (kf, lokal + Server HTTPS): **bestanden**. Rohbericht [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md). **M2-01** (Steuersatz festgeschriebener Rechnungen ins Journal / in die USt-Auswertung) deployed und nachgetestet (`13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine. Arbeitsfirma auf `app.zettelruhe.de`: Kleinunternehmerregelung.
- **Setup-verified:** Beim Anlegen der Eigentümer:in `users.verified = true`. `users.authRule` leer — Login hängt nicht an `verified` und nicht an SMTP. Bestehende unverifizierte User einmalig nachziehen; bereits verifizierte bleiben verifiziert. Multi-Firma (ADR-0018) und Setup-Wizard unverändert.
- **Dokumenten-Layout (über M1-10 hinaus):** Angebot und Rechnung teilen ein DIN-ähnliches Gerüst (Fenstertasche, Akzent-Tabelle, Summen). Unter Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis. Bankzeile aus dem ersten aktiven Bankkonto mit IBAN; GiroCode (EPC) nur auf der Rechnung. Schalter Header/Fuß/Zahlblock an der Firma. Entwurf weiter ohne Nummernkreis, mit Wasserzeichen. Bestehende Originale unverändert (ADR-0012). E-Rechnungs-XML unangetastet.
- **Marke (Logo/Favicon):** App-Marke aus `docs/logo-512x512-transparent.png` (Z ohne Schriftzug). Shell oben links, Login und Setup; Favicon + 32×32 + Apple-Touch + PWA-Icons 192/512. Unabhängig von `firmen.logo` auf Angebot/Rechnung.
- **Ist-Versteuerung / Journal-Nachzug Zahlungen (ADR-0024):** Zahlung (manuell oder Bank-Match) erzeugt festgeschriebene Journal-Zeilen (`quelle_typ=zahlung`, Buchungsdatum = Zahlungsdatum), anteilig nach Steuerstaffel. EÜR, USt, ZM, BWA, Dashboard und DATEV zählen den Zufluss, nicht die Forderungsbuchung der Rechnungs-Festschreibung. Löschen storniert das Zahlungsjournal; Rechnungs-Storno storniert es mit. Bestehende Zahlungen werden idempotent nachgezogen.
- **Multi-User / grobe Rechte (ADR-0025):** Mitgliedschaft User↔Firma; Rollen Eigentümer:in / Bearbeiten / Lesen. Einladen unter `/app/nutzer` (Startpasswort, kein SMTP-Pflicht; Hinweis-Mail ohne Passwort wenn SMTP steht). `users.firma` bleibt zuletzt aktiv. Instanz-Eigentümer:in legt weitere Firmen an. Isolation: Session nur mit Mitgliedschaft. Backfill: bestehende Instanz-Eigentümer:innen werden Eigentümer:in aller vorhandenen Firmen. Schreib-Actions serverseitig geprüft. Commit `1ae4965`. **Server-Nachtest kf inkl. SMTP: keine Fehler.**
- **Eigenes Passwort ändern** (Nachzug ADR-0025): `/app/passwort` — jede angemeldete Nutzer:in (Instanz-Eigentümer:in und Eingeladene, alle drei Rollen inkl. Lesen) ändert nur das eigene Passwort (alt + neu + Bestätigung, mindestens 8 Zeichen). Fremdes Passwort unter `/app/nutzer` unverändert. Kein SMTP, kein Reset-per-Mail. Next-Session bleibt gültig (ADR-0009).
- **UX/UI erster Keil (App-Layout / CSS):** Tokens (Papier-Canvas, Tinte-Sidebar, Primärfarbe an der Z-Marke), gemeinsame Primitives, PageHeader auf Alltagslisten, Übersicht und Login/Setup. M1-12 und Marke nicht zurückgebaut. Toast unten rechts. Lokal hinter Caddy nachgetestet.
- **UX/UI Rest:** Sidebar mobil Off-Canvas (unter `md`; Desktop fest). Esc, Overlay, Nav-Link schließt, Fokus. PageHeader auf Firma, Nutzer:innen, Passwort (nur Optik) und Dokument-Details (Angebot, Rechnung, Beleg). Nav-Logik und erster Keil unangetastet. 437 Unit-Tests. Lokal hinter Caddy nachgetestet.
- **Übersicht / Dashboard (erster Keil):** Fläche unter den KPI-Karten. Fälligkeiten (überfällig + 14 Tage, Link zur Rechnung, „Zahlung erfassen“ nur bei Schreibrecht). §-19-Jahresbalken nur unter Kleinunternehmerregelung — Grenzen aus § 19 Abs. 1 UStG (Staffel ab 2025: 25.000 / 100.000, kein 22.000-Default), Umsatz light nach Zufluss, unter Regelbesteuerung keine Karte. Verlauf 6 / Jahr / 12 Monate (SVG, kein Chart-Paket).
- **Übersicht Follow-up:** Ausgaben nach Kategorien (Donut Top 5 + „Weitere“, Monat/Quartal; Schnappschuss am Beleg/Kassenbuch, Storno mindert die Ursprungskategorie) und letzte Buchungen (Journal-Tail, Link zum Datensatz). Zweite 65/35-Zeile, erster Keil unverändert. 462 Unit-Tests. Donut-Farben: je Kategorie ein Token (nicht Violett-in-Violett).
- **Hybrid-PDF (ADR-0026):** Schnitt, kein Bau. Factur-X/ZUGFeRD-Hybrid verlangt PDF/A-3; `@react-pdf/renderer` liefert das nicht, `pdf-lib` macht es nicht ehrlich, Mustang/Chromium bleiben ausgeschlossen. Versand bleibt XML-Original (ADR-0022) neben dem Festschreibungs-PDF. Kein Kleber ohne Claim.
- **Kassenbuch aus Barzahlung (ADR-0027):** Schnitt, kein Bau. Zahlung mit Zahlungsweg `bar` erzeugt keinen Kassenbuch-Eintrag. Zufluss bleibt allein `quelle_typ=zahlung` (ADR-0024). Manuelles Kassenbuch unverändert (`quelle_typ=kasse`). Formular-Hinweis warnt vor doppelter Bareinnahme. Kein Hook, kein Nachzug, keine EÜR-Entkopplung.
- **MT940-Parser (ADR-0028):** klassisches SWIFT-MT940 / STA (`:20:` / `:25:` / `:61:` / `:86:` / `:62F:`). Eigener Parser nach `ParsedBankZeile`; Persistenz und Idempotenz wie CSV; Lauf `format=mt940`. Valuta und C/D/RC/RD nur aus `:61:`. `:25:`-IBAN nach Ländercode (DE = 22), angehängtes `EUR` gehört nicht zur Konto-ID. bunq-`:86:` `/IBAN/` `/NAME/` `/REMI/`: Liste zeigt REMI oder NAME, gespeichert bleibt der volle Text. Encoding UTF-8 oder Windows-1252. Kein CAMT.053, kein MT942, keine Lib. Matching unverändert (Bestätigung, `createZahlung`). Import-Erfolg-`redirect` liegt außerhalb von `try` (dieser Pfad, M1-15). 489 Unit-Tests. Commits `2341199`, `c769bcd`.
- **ZUGFeRD-Empfang-Parsing (ADR-0029):** PDF-Anhang `/Type /EmbeddedFile`, Filter keiner oder Flate (`zlib`). Bekannte Dateinamen wählen, sonst erstes CII-/UBL-XML. Unkomprimierter Fallback bleibt. Verschlüsselte PDFs und Scan-PDF ohne Anhang scheitern ehrlich. DTO und Beleg-Entwurf unverändert; Original archiviert; kein Inbox-Nachparse. Kein `pdf-lib`, kein Mustang, kein Hybrid-Schreiben (ADR-0026). 494 Unit-Tests.
- **Release-Tag Meilenstein 2:** annotated Tag `meilenstein-2` auf `d469f02` (ADR-0029, Alltag trägt).
- **OS-Kern vs. Cloud-Control-Plane (ADR-0030):** Dieses Repo bleibt der self-hosted Open-Source-Kern (`docker compose up`, eine PocketBase-Instanz). SaaS (Stripe, Provisioner, Caddy-API, Cloud-OCR/PSD2, Kundenportal) liegt in einem geplanten separaten Control-Plane-Projekt. Einzige Kern-Schnittstelle: stateless PocketBase-URL-Adapter (Default `PB_URL`; optional Header/Subdomain), **entschieden, nicht gebaut**. Keine Shared-Database-Multi-Tenancy für Finanzen. ADR-0011 (flaches Kern-Monorepo) unangetastet.
- **TP-022 Finanzfestschreibung:** Belege, Rechnungen und Kassenbuch verwenden feste PocketBase-Transaktionsoperationen. Lokal, Test-VPS und Produktions-VPS sind laut Betreiberbestätigung vom 2026-09-07 schrittweise geprüft. Dieser damalige Stand lief laut Bestätigung vom 2026-09-07 produktiv. Zahlungen, Bank-Matching und Rechnungsstorno bleiben außerhalb dieser Atomaritätsgarantie.
- **TP-023 / M1-15:** Der Erfolgs-Redirect nach dem Beleg-Entwurf aus einer E-Rechnung liegt außerhalb des `try/catch`. Der Bankimport war bereits korrigiert. Lokal, Test-VPS und Produktions-VPS grün. Auf dem Produktions-VPS bestanden Regressionstest, Typecheck, Produktionsbuild und Healthchecks; produktiv läuft Commit `003c2d8`.

## Nächste Schritte

**Ausblick (nicht durch den aktuellen Server-Stand verengen):**
Zettelruhe soll ein Tool für jedermann werden — verschiedene Steuer-Modi, verschiedene Firmagrößen, mehrere Nutzer:innen. Die Arbeitsfirma auf `app.zettelruhe.de` (Kleinunternehmerregelung, eine Eigentümer:in) ist der heutige Betrieb, nicht das Produkt. Priorisierung und nächste Schnitte daran nicht festmachen.

**Offene Abnahmen und mögliche Folgearbeit:**

- Open-Source-Kern ab `v1.0.0` pflegen; technische Grenzen und Prüfstand stehen im [Releaseplan](release-und-cloud-plan.md).
- RC ist produktiv bestätigt. `v1.0.0` ist der Release-Stand; keine neue ELSTER-Freigabe verlangen.
- TP-009 und neue Komfortfunktionen sind dem späteren Cloud-Angebot zugeordnet. Kernpflege und bekannte technische Befunde bleiben in `entwicklung.md`.
- **Zwei-Instanzen-Testbetrieb**: Voraussetzung vor einem späteren Adapter-/Control-Plane-Auftrag; keine Bestätigung eines abgeschlossenen Tests im Repository.
- Nach dem Kernrelease folgt das separate Cloud-Projekt. Neue Komfortfunktionen aus der Roadmap gehören ins Aboangebot; die genaue Reihenfolge und Umsetzung erhalten eigene Aufträge.

Erledigt und hier nicht wieder aufmachen: Marke, Dokumenten-Layout (über light hinaus), UStVA/ZM light, E-Rechnung (XML-Versand), Hybrid-Schnitt (kein Bau, ADR-0026), Kassenbuch aus Barzahlung (kein Bau, ADR-0027), MT940 (ADR-0028), ZUGFeRD-Empfang-Parsing (ADR-0029), Core-vs-Cloud-Schnitt (kein Bau, ADR-0030), Multi-Firma dünn, Ist-Versteuerung (Journal-Nachzug Zahlungen), Multi-User / grobe Rechte, eigenes Passwort, UX/UI erster Keil (Tokens/Shell/Listen), UX/UI Rest (Sidebar mobil, Detailköpfe), Übersicht erster Keil (Fälligkeiten, §-19-Wächter, Verlauf), Übersicht Follow-up (Donut Kategorien, letzte Buchungen).

Invarianten unverändert: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). de-DE im UI.

## Historische Folgeentscheidungen nach M2

- ZUGFeRD-Empfang-Parsing — erledigt (ADR-0029, PDF-Attachment Flate)
- Hybrid-PDF — erledigt als Schnitt (kein Bau); später nur mit eigener PDF/A-3-Pipeline (ADR-0026)
- Kassenbuch aus Barzahlung — erledigt als Schnitt (kein Bau, ADR-0027)
- MT940 — erledigt (ADR-0028, klassisches SWIFT/STA)
- OS-Kern vs. Cloud — erledigt als Schnitt (kein Bau, ADR-0030); Adapter und Control Plane nicht in diesem Repo bauen
- Release-Tag `meilenstein-2` — auf `d469f02`; mit diesem Stand nach origin

## Offene Produktentscheidungen

Die damalige M2-Entscheidungsliste ist abgearbeitet. Offene ursprüngliche v1-Ziele
und spätere Wünsche stehen in der Roadmap; ihre Priorisierung ist noch kein Auftrag.

## Blocker

Keine offenen Releaseblocker. Die bekannten Produkt- und Betriebsgrenzen bleiben
im [Releaseplan](release-und-cloud-plan.md) dokumentiert.

## Bauabschnitte v1 (verbindlich)

1. Fundament ← **erledigt**
2. Kontakte + Katalog ← **erledigt**
3. Journal-Kern ← **erledigt**
4. Belege manuell + Dateien ← **erledigt**
5. Sales light (Rechnung Festschreiben/PDF/Journal) ← **erledigt**
6. Angebote ← **erledigt**
7. Zeit & Fahrten ← **erledigt**
8. Zahlungen manuell ← **erledigt**
9. Kassenbuch ← **erledigt**
10. Wiederkehrend + SMTP + Jobs ← **erledigt**
11. Bank-Import + Matching ← **erledigt**
12. E-Rechnung Empfang ← **erledigt**
13. Reporting/Export ← **erledigt**
14. Härten ← **erledigt** (M1 hartbar abgeschlossen)

## Lesereihenfolge

1. `CONTEXT.md`
2. `docs/feature-roadmap.md`
3. `docs/betrieb.md` (Betrieb/Backup)
4. `docs/adr/*.md`
5. `docs/entwicklung.md`, `docs/testphase.md` und bei RC-Arbeit `docs/reverse-charge-umsetzung.md`
6. [Entwicklung](entwicklung.md) für weitere Dokumentenverweise
