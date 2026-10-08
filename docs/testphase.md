# Testphase-Log

Funde aus dem Alltagstest nach Meilenstein 2: kleine Bugs, Verbesserungen, Änderungen.

- Eine Zeile pro Fund. IDs `TP-001`, `TP-002`, … fortlaufend.
- Art: `Bug` | `Verbesserung` | `Änderung`.
- Datum: `YYYY-MM-DD` (Meldung). In **Notiz** nach Erledigung: Owner-Datei und Testkommando.
- Dieses Log ist die Tracking-Datei der Testphase. `docs/90-status.md` bleibt der Meilenstein-Status; Session-Logs unter `docs/sessions/` nur bei größeren Schnitten.
- Der Skill `/testphase-fix` schreibt hier mit. Ergänzende Dokumentationspflege folgt der [Pflegematrix](README.md#pflege-bei-änderungen).

## Offen

| ID | Datum | Art | Bereich | Kurz |
|----|-------|-----|---------|------|
| TP-009 | 2026-08-26 | Verbesserung | Katalog / Firma | Mengeneinheiten in den Firmeneinstellungen pflegen (analog Kategorien und Katalog): eigene Liste, Abkürzungen, optional Einzahl/Mehrzahl. Roadmap: Cloud-Ausbau seit Betreiberentscheidung vom 2026-09-10; kein Issue für den Open-Source-Release. |
| TP-034 | 2026-10-02 | Bug | Firma / Cloud-Edge | Erfolgreicher Write, danach 401 am Query-Redirect; Core korrekt, Cloud-Edge-Fehler lokal reproduziert. Korrektur außerhalb des Auftrags offen; [Diagnose und Regression](#tp-034-firmenspeichern--unauthorized-nach-erfolgsredirect-2026-10-02). |

## Erledigt

| ID | Datum | Art | Bereich | Kurz | Notiz |
|----|-------|-----|---------|------|-------|
| TP-036 | 2026-10-02 | Bug | Instanzkontext / Server Actions | Kanonischen Tenant-Host beim internen Next-Redirect erhalten | Owner: `app/src/lib/instance-context.ts`, `app/src/proxy.ts`. Kurzlebiger HMAC-Nachweis für den bereits aufgelösten App-Host, ausschließlich in Next-Request-Overrides. 13 neue Guard-/Proxyfälle und echte Firma-/Rechnungs-Actions in lokaler Produktions-Next-Runtime mit erzwungenem IP:Port-Folgehost bestanden; [Verfahren, Sicherheitsgrenzen und Abnahme](#tp-036-kanonischer-host-bei-internen-next-redirects-2026-10-02). |
| TP-035 | 2026-10-02 | Bug | Shell / Navigation | Mailversand nur im Cloud-Modus anzeigen; bestehende Instanz-Eigentümerprüfung beibehalten | Owner: `app/src/components/app-shell.tsx`, Regression: `app/src/components/app-shell.test.ts`. Bestehendes `isCloud()` aus `lib/instance-context.ts` wie auf der unveränderten Mailseite; keine neue Moduserkennung. Lokal macOS, Node 22.22.3, Next 16.3.5: `cd app && ./node_modules/.bin/vitest run src/components/app-shell.test.ts src/components/app-nav-state.test.ts src/components/app-sidebar-state.test.ts src/modules/platform/rechte.test.ts` — 57/57 grün, davon 13 neue Navigationsfälle (Cloud/Self-Hosting, Instanz- und Firmenrollen, ENV-Standard). `npm run typecheck` und gezielter ESLint beider Shell-Dateien mit `--max-warnings=0` grün. Gerendertes Navigations-HTML geprüft; keine Browserabnahme, um für diesen Menüfix keinen App-Start mit möglichem Zahlungsjournal-Nachzug auszulösen. Kein Deployment, Versions-/Tag-Wechsel oder Cloud-Bindungsänderung. |
| TP-001 | 2026-08-20 | Änderung | Kontakte | Kontaktnummer je Kontakt (ein Nummernkreis, Prefix an der Firma; PB-ID bleibt Verknüpfung) | Owner: `contacts/*`, `lib/pb.ts`, `platform/firma-*`, Migration `1730002000_kontaktnummer.js`. Tests: `cd app && npx vitest run src/lib/nummernkreis.test.ts src/modules/contacts src/modules/search src/modules/sales/pdf-render.test.ts src/modules/einvoice/outbound.test.ts`. Browser kf nach Docker-Rebuild: keine Fehler. |
| TP-002 | 2026-08-21 | Verbesserung | Belege | Handyfotos vor dem Speichern auf JPEG ≤2000 px Kante / q=0.82; PDF unverändert | Owner: `expenses/beleg-datei-input.tsx`, `expenses/compress-beleg-image.ts`. Tests: `cd app && npx vitest run src/modules/expenses` (24). Chrome: 4000×3000 JPEG 92 KB → 24 KB, PDF unverändert. Seite `/app/belege/neu` nicht live (kein Compose/Session). |
| TP-003 | 2026-08-21 | Bug | Belege | Hochgeladene Dateien wieder anzeigen/entfernen: je Datei Lupe + X | Owner: `expenses/beleg-datei-input.tsx`, `expenses/beleg-datei-zeilen.ts`, `expenses/beleg-form.tsx`, `app/belege/[id]/page.tsx`. Tests: `cd app && npx vitest run src/modules/expenses` (27). Browser kf: keine Probleme. |
| TP-004 | 2026-08-21 | Verbesserung | Belege | Mehrere Dateien je Beleg (bis 10); neue Fotos hängen an, ersetzen nicht | Owner: Migration `1730002100_belege_datei_mehrfach.js`, `expenses/*`, `app/belege/[id]`, `reporting/repository.ts`. Tests: `cd app && npx vitest run src/modules/expenses` (31). Compose-Rebuild: Next+PB grün, `datei.maxSelect=10` in PB. Browser kf: keine Probleme. |
| TP-005 | 2026-08-23 | Verbesserung | Angebote/Rechnungen | Firmenlogo auf Angebots-/Rechnungs-PDF größer (160×72 pt, objectFit contain) | Owner: `sales/pdf.tsx`, `sales/pdf-layout.ts`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts` (26). Prüf-PDF mit Logo gerendert; bestehende Originale unverändert (ADR-0012). |
| TP-006 | 2026-08-23 | Bug | Angebote/Rechnungen | Firmenlogo auf PDF rechtsbündig: Box folgt dem Seitenverhältnis statt 160 pt Breite | Owner: `sales/pdf.tsx`, `sales/pdf-layout.ts`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts` (29). Prüf-PDFs Toni Titz + Feichtinger.it. |
| TP-007 | 2026-08-23 | Bug | Angebote/Rechnungen | Adressfeld auf Angebots-/Rechnungs-PDF nach DIN 5008 Form B (85×45 mm, 45 mm von oben, 20 mm links); Logo/Firmenblock bleibt oben rechts; Betreff und Text darunter | Owner: `sales/pdf.tsx`, `sales/pdf-layout.ts`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts` (31). Prüf-PDF: Absenderzeile 45,5 mm / 20,2 mm, Titel unter der Fenstertasche; bestehende Originale unverändert (ADR-0012). |
| TP-008 | 2026-08-26 | Änderung | Katalog | Einheit „Stunde“ → Abkürzung „Std.“ (kein Plural auf der Rechnung) | Owner: `catalog/einheiten.ts`, `catalog/csv.ts`, Zeitübernahme `time/invariants.ts`, Migration `1730002200_einheit_std.js` (Katalog, Wiederkehrend, Entwürfe; festgeschriebene Dokumente unverändert). Tests: `cd app && npx vitest run src/modules/catalog src/modules/einvoice/outbound.test.ts src/modules/time/invariants.test.ts` (34). Seite nicht live (kein Compose). |
| TP-010 | 2026-08-26 | Verbesserung | Angebote/Rechnungen | Kund:in in den Listen `/app/angebote` und `/app/rechnungen` | Owner: `app/angebote/page.tsx`, `app/rechnungen/page.tsx`. Namen über `listKontakte` (wie Zeiten/Fahrten/Projekte). Tests: UI, kein Vitest. Compose-Rebuild: TypeScript grün. HTML `/app/rechnungen` und `/app/angebote`: Spalte Kund:in mit Namen, Entwürfe ohne Kund:in als —, Leere Filter ohne Tabelle; `/app/zahlungen` und `/app/projekte` unverändert. |
| TP-011 | 2026-08-26 | Verbesserung | Angebote/Rechnungen | PDF-Fußzeile ohne Trennlinie, kompakter Fußtext, 3-Spalten mit Tel. und E-Mail | Owner: `sales/pdf.tsx`, `sales/pdf-layout.ts`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts` (35). Prüf-PDF: Fußtext Helvetica 9 pt ohne Leerzeilen, Stammdaten dreispaltig (Firma/Tel./E-Mail · Bank · Steuer); bestehende Originale unverändert (ADR-0012). |
| TP-012 | 2026-08-26 | Bug | Angebote/Rechnungen | Senden/Festschreiben: Unique-Konflikt wenn Nummernkreis hinter bereits vergebenen Nummern liegt | Owner: `lib/pb.ts` (`nextFreieNummer`, `allocateNummernkreis`), `sales/repository.ts`. Tests: `cd app && npx vitest run src/lib/nummernkreis.test.ts` (9). Lokal Beispiel GmbH: Zähler nachgezogen (Angebot 5, Rechnung 6, Kasse 2, Kontakt 3). Nicht durch PDF-Fußzeile verursacht. |
| TP-013 | 2026-08-26 | Verbesserung | Angebote/Rechnungen | Konfigurierbarer Fußtext im Inhaltsfluss (16 pt unter letztem Block); Stammdaten-Fußzeile bleibt am Seitenende | Owner: `sales/pdf.tsx`, `sales/pdf-layout.ts`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts`. Prüf-PDF Angebot und Rechnung. |
| TP-014 | 2026-08-27 | Verbesserung | Firma / Angebote/Rechnungen | Webseite an der Firma; PDF-Fußzeile linke Spalte unter E-Mail | Owner: `platform/firma-form.tsx`, `platform/firma-actions.ts`, `lib/pb.ts`, `sales/pdf-layout.ts`, `sales/pdf.tsx`, Migration `1730002300_firmen_webseite.js`. Tests: `cd app && npx vitest run src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts` (37). Prüf-PDF Angebot und Rechnung: `Web` unter `E-Mail`. Compose-Rebuild lokal erfolgreich. Browser kf: keine Fehler. |
| TP-015 | 2026-08-30 | Änderung | Übersicht / EÜR / Auswertungen | Standard-Zeitraum der Kennzahlen: aktuelles Kalenderjahr statt Monat | Owner: `reporting/periods.ts`, `reporting/repository.ts` (`getUebersichtDashboard`), `app/page.tsx`, `app/eur/page.tsx`, `app/auswertungen/page.tsx`. Tests: `cd app && npx vitest run src/modules/reporting/periods.test.ts src/modules/reporting/uebersicht.test.ts src/modules/reporting/aggregate.test.ts` (50). USt/ZM/Export bleiben Monat. Compose-Rebuild: Browser kf ohne Fehler. |
| TP-016 | 2026-08-30 | Verbesserung | Bankkonten / Angebote/Rechnungen | Kontoinhaber am Bankkonto; in der PDF-Fußzeile (Angebot/Rechnung) und als E-Rechnungs-AccountName | Owner: Migration `1730002400_bankkonten_kontoinhaber.js`, `banking/*`, `sales/pdf-layout.ts`, `einvoice/outbound.ts`. Tests: `cd app && npx vitest run src/modules/banking/invariants.test.ts src/modules/sales/pdf-layout.test.ts src/modules/sales/pdf-render.test.ts src/modules/einvoice/outbound.test.ts` (60). Compose-Rebuild: PB-Feld `kontoinhaber` live. Browser kf: keine Fehler. |
| TP-017 | 2026-09-05 | Änderung | Belege | Bezeichnung statt Notiz; Übersicht mit echter Bezeichnung, Nummer darunter, Lieferant:in/Kategorie | Owner: `expenses/beleg-form.tsx`, `expenses/invariants.ts`, `expenses/repository.ts`, `expenses/actions.ts`, `app/belege/page.tsx`, `app/belege/[id]/page.tsx`, `search/search.ts`. PB-Feld `notiz` unverändert (keine Migration). Tests: `cd app && npx vitest run src/modules/expenses src/modules/search/search.test.ts` (38). Compose-Rebuild: Browser kf ohne Fehler. |
| TP-018 | 2026-09-05 | Änderung | Kategorien / Belege | Kategorie-Richtung Einnahme/Ausgabe; Auswahlliste am Beleg (und Kassenbuch) filtert danach | Owner: `categories/*`, `expenses/repository.ts`, `expenses/beleg-form.tsx`, `cash/repository.ts`, `cash/kassenbuch-form.tsx`, `app/kategorien`, `app/belege/neu`, Migration `1730002500_kategorien_richtung.js`. Tests: `cd app && npx vitest run src/modules/categories src/modules/expenses src/modules/cash/invariants.test.ts` (80). Typecheck/Lint (geändert)/Build grün. Compose-Rebuild: PB-Feld `richtung` live. Browser kf: keine Fehler. |
| TP-019 | 2026-09-05 | Änderung | Belege | Geschäftspartner je Richtung: Ausgabe → Lieferant:in, Einnahme → Kund:in; Auswahl wird beim Wechsel zurückgesetzt | Owner: `expenses/beleg-partner-select.tsx`, `expenses/beleg-form.tsx`, `expenses/invariants.ts`, `expenses/repository.ts`, `expenses/actions.ts`, `app/belege/*`, Migration `1730002600_belege_kunde.js`. Tests: `cd app && npx vitest run src/modules/expenses` (57). Typecheck/Lint (geändert)/Build grün. Compose-Rebuild: PB-Feld `kunde` live. Browser kf: keine Fehler. |
| TP-020 | 2026-09-05 | Bug | PocketBase / Dateien | Direkte firmenübergreifende Reads und anonyme Dateizugriffe sperren | Owner: Migration `1730002700_direkte_api_absichern.js`, `app/src/lib/pb.ts`. `./scripts/test-pocketbase-isolation.sh`: 1303 HTTP-Prüfungen; `cd app && npm test`: 591 Tests; Typecheck und Docker-Build bestanden. [Prüfbericht](issues/pocketbase-firmenisolation-2026-09-05.md), Sicherheitsbefund in `docs/entwicklung.md` aktualisiert. |
| TP-021 | 2026-09-05 | Bug | Belege / Migration / Journal | Fehler bestätigt, geprüfter Bestand nicht betroffen, keine Korrekturmigration erforderlich | Abschluss auf Basis der Analyse und Bestätigung des Betreibers. Keine Datenkorrektur; Originalmigration unverändert. Owner: `expenses/migration-kunde.test.ts`, `expenses/festschreibung.test.ts`, `scripts/audit-belege-kunde.py` samt Tests. Verifikation: `cd app && npm test` (617), Expenses/Journal (103), Typecheck, `python3 -B scripts/test-audit-belege-kunde.py` (5) bestanden. Regressionstests und Read-only-Audit bleiben erhalten. [Prüfbericht und Datenbilanz](issues/belege-kunde-migration-2026-09-05.md). |
| TP-022 | 2026-09-05 | Bug | Finanzfestschreibung / Journal / Nummernkreise | Beleg-, Rechnungs- und Kassenabschluss über feste PocketBase-Transaktionsoperationen | Stufen 1 bis 3 sind abgeschlossen. Kassenrecord, Journal, Rückverweis, Zeitpunkt, Nummer und Zähler sowie Kassenstorno und Gegenbuchung committen gemeinsam. Der Saldo wird im serialisierten Transaktionsbestand geprüft; Replay, Source-Races und direkte Superuser-Bypässe sind gesperrt. Beide historischen Kassenfehler sind grün. Keine Migration und kein Unique-Index. Tests: PB 0.39.10 mit echten Hooks 27/27 Kasse und 141/141 gesamte Finanzintegration; betroffene Module 170/170; Gesamtsuite 631 bestanden und 141 ohne sicheren Starter übersprungen; Typecheck, Syntax, Diff-Check und gezieltes ESLint grün. No-Cache-Docker-Smoke mit bytegleichen Hooks, Anlage-/Storno-Replay, Saldo 0,00 und Immutability bestanden. Zahlungen, Bank-Matching und Rechnungsstorno wurden nicht atomarisiert. Betreiberbestätigung vom 2026-09-07: aktueller Commit lokal, auf dem Test-VPS und auf dem Produktions-VPS schrittweise geprüft und produktiv in Betrieb. Die einzelnen VPS-Schritte der letzten Sessions sind nicht vollständig in separaten Berichten dokumentiert. [Belegbericht](issues/tp-022-belegstufe-2026-09-06.md), [Rechnungsbericht](issues/tp-022-rechnungsstufe-2026-09-06.md), [Kassenbericht](issues/tp-022-kassenstufe-2026-09-07.md). |
| TP-023 | 2026-09-07 | Bug | E-Rechnung / Beleg-Entwurf | M1-15: Erfolgreiches Anlegen eines Beleg-Entwurfs nicht mehr als `NEXT_REDIRECT`-Fehler anzeigen | Owner: `einvoice/actions.ts`, Regressionstest `einvoice/actions.test.ts`. Erfolgs-Redirect und Revalidierung liegen nach dem `try/catch`; echte Repository-Fehler bleiben am E-Rechnungs-Empfang. Lokal: gezielt 2/2, Gesamtsuite 633 bestanden und 141 ohne sicheren Starter übersprungen; Typecheck und gezielter ESLint grün. Test-VPS-Nachtest vollständig grün. Produktions-VPS am 2026-09-07: Commit `003c2d8` ausgerollt, Regressionstest 2/2, Typecheck, Produktionsbuild und Healthchecks direkt sowie über HTTPS grün. Gegenüber `cee84a4` kamen nur zwei Session-Dokumente hinzu; PocketBase blieb unverändert. |
| TP-024 | 2026-09-07 | Bug | Reporting / Exporte | Erfolgreich gemeldete Journal- und Belegexporte sind vollständig oder scheitern ohne irreführendes Teilarchiv | Owner: `reporting/repository.ts`; Routenvertrag: `app/export/belegarchiv/route.ts`; Regressionstests: `reporting/repository-export.test.ts` und `app/export/belegarchiv/route.test.ts`. Die festen Grenzen von 10.000 Journalzeilen und 5.000 Belegen entfallen. Alle PocketBase-Seiten werden gelesen; geänderte Pagination, falsche Gesamtzahl und doppelte IDs führen zum Abbruch. Fehlende referenzierte Dateien werden nicht mehr übersprungen. Die In-Memory-ZIP-Erzeugung ist auf 256 MiB summierte Dateinutzlast begrenzt; Streaming bleibt separat. Lokal: gezielt 22/22, Gesamtsuite 645 bestanden und 141 ohne sicheren Starter übersprungen; Typecheck und gezielter ESLint grün. |
| TP-025 | 2026-09-08 | Bug | Belege / Reverse Charge | RC-Entwurf nach Speichern wieder mit dem gespeicherten Formularzustand laden | Owner: `app/belege/[id]/page.tsx`; die Detailseite remountet die Client-Form anhand von Beleg-ID und Persistenzversion. Der gespeicherte RC-Vertrag bleibt die einzige Datenquelle. Regressionen: `expenses/beleg-form-input.test.ts` prüft alle RC-Felder, `lib/rc-transaktion.integration.test.ts` prüft Formular → Speichern → Festschreibung mit 42,00 EUR sowie die bestehenden Sperren für nicht unterstützte Zahlungen. Lokal: gezielt 60/60, isolierte Finanz-/RC-Suite 180/180, Gesamtsuite 729 bestanden und 145 ohne sicheren Starter übersprungen; Typecheck, gezielter ESLint, Hook-Generator und Docker-Produktionsbuild grün. |
| TP-026 | 2026-09-08 | Verbesserung | Belege / Reverse Charge | RC-Erfassung vereinfacht; Zusatzangaben unter „Weitere steuerliche Details“ | Nachgetragen beim Dokumentationsabgleich am 2026-09-10 für Commit `961d06d`. Owner: `expenses/beleg-form-input.ts`, `beleg-form.tsx`, `rc-fields.tsx`, `rc-details.tsx`. Zahlbetrag/Buchungsdatum automatisch aus Rechnungsbetrag/Zahlungsdatum, Bestätigungen und Standard-Nachweis im Formular vorbelegt, eigene Referenz optional, kompakte Steuerübersicht ohne Kennziffern. Tatsächliche Codegrenzen und Unterschiede zum ursprünglichen Plan: [RC-Referenz](reverse-charge-umsetzung.md). Nachtest am 2026-09-10: `cd app && ./node_modules/.bin/vitest run src/modules/expenses/beleg-form-input.test.ts`, 26/26 bestanden. Kein neuer Browserlauf, keine neue Gesamt-/PB- oder VPS-Abnahme; damalige Testausführung nicht aus dem Commit allein abgeleitet. |
| TP-027 | 2026-09-10 | Bug | Lint / Diagramme / RC-Anzeige | Beide Lintfehler, sechs Warnungen und SVG-Hydrierungsfehler behoben; RC-Zahllast mit Decimal | Owner: `einvoice/parse-pdf-xml.ts`, `reporting/uebersicht-{kategorien,verlauf}.tsx`, `expenses/rc-details.tsx`, Jobs, Firma, PDF. Zwei SVG-Renderregressionen zuerst reproduziert, finaler Browser ohne Fehler; `npm test` 739 bestanden, Typecheck und Lint grün. [Abnahme](issues/release-abnahme-2026-09-10.md). |
| TP-028 | 2026-09-10 | Bug | Wiederkehrend / Zahlungen / Bank / Storno | Reproduzierte Parallel-/Replay- und Fehlerzustände gezielt abgesichert; Jobpagination vollständig | Owner: `jobs`, `sales/wiederkehrend-repository.ts`, `payments`, `banking/repository.ts`, `journal`, `lib/finanz-transaktion.ts`, `pocketbase/pb_hooks/finanz.*`, Hook-Generator. Acht neue Fälle gegen `f48be21` rot; 15 Releasefälle jetzt grün, gesamte echte PB-/RC-Suite 195/195 über `scripts/test-festschreibung-isolated.mjs`. Firma 51/Vorlage 201 und überlappende Timer separat getestet. [Abnahme und Grenzen](issues/release-abnahme-2026-09-10.md). |
| TP-029 | 2026-09-10 | Änderung | Releaseunterlagen / Arbeitsmaterialien | Synthetische Importfixture, lokale Installations-/Restoreprüfung, CI, CONTRIBUTING, SECURITY und Release Notes | Owner: `scripts/test-release-smoke-isolated.mjs`, `scripts/seed-release-browser.mjs`, `.github/workflows/ci.yml`, README/CHANGELOG und Projekt-Dokumentation. Frische synthetische Installation und Offline-Upgrade/Restore ab `f48be21` bestanden. Für R-01 wurde `krisauseu/zettelruhe-os` mit bereinigtem Initial-Commit angelegt; der Vorgänger-Repository-Verlauf wird nicht fortgeführt. [Befund](issues/release-materialpruefung-2026-09-10.md), [Prüfungen](issues/release-abnahme-2026-09-10.md). |

## TP-030: generischer Instanzkontext für Cloud-TP-002, 2026-09-10

Gezielter Auftrag für gemeinsame Next-Anwendung und getrennte PocketBase-Instanzen.
PB und Finanzoperationen, Sessionbindung, beide Auth-/Setup-Pfade, Firmenwechsel,
kanonische URLs, SMTP, Zahlungsnachzug-Cache und Scheduler sind angepasst.
Keine Migration, kein Hookumbau und keine Cloud-Pakete im Build.
[Umfang, Laufzeitvertrag und Grenzen](instance-context.md).

Lokale Abnahme mit Node 22 im Docker-Produktionsimage: Cloud-Starter mit zwei
synthetischen PBs und Caddy, anschließend Self-Hosting mit frischer PB bestanden.
Nachweis am 2026-09-10: 748 Unit-Tests bestanden, 161 nur durch sichere Starter
aktivierbare Tests im normalen Lauf übersprungen; Typecheck und warnungsfreies
ESLint bestanden. Der separate synthetische Finanz-/RC-Starter besteht mit
195 Tests. Die Cloud-Abnahme besteht mit 14 Prüfgruppen einschließlich eines
zusätzlichen echten PB-Kontexttests mit 20 verschachtelten Parallelzugriffen.
Next 16.3.0 / Node 22 im Produktionsimage, PB 0.39.10, Caddy 2.10; lokale
Unit-/Type-/Lint-Prüfung unter Node 25.9.0. Kein Deployment.

Geprüftes lokales Next-Image:
`sha256:73ea018489759a317cadbfcc623831d80e221589fbf95da5c4ee91000eff567a`.
PB-Testimage: `sha256:89ea17d1ef47bd9ebb981b60309ae258c287bc7c2ed42618405321de134c2682`.
Keine Änderung an Kernmigrationen oder Hooks. Testressourcen wurden entfernt.
Die fremde lokale `.codex/config.toml` bleibt unverändert und außerhalb des Commits.


## TP-031: optionale Positionsbeschreibung, 2026-09-11

Verbesserung in Angebote/Rechnungen. Owner: `sales/{types,invariants,actions,
repository,pdf}.ts(x)`, beide Positionsformulare und Detailseiten,
`pocketbase/pb_hooks/finanz.js` samt generierten Verkaufsregeln,
Migration `1730003000_positionsbeschreibung.js`.

Unter Bezeichnung steht ein optionales mehrzeiliges Feld Beschreibung, maximal
2000 Zeichen. Artikelkatalog und Stammdaten bleiben unverändert. Katalogauswahl
befüllt keine Details; manuell erfasste Details bleiben erhalten. Die Beschreibung
wird gespeichert, beim Bearbeiten wieder geladen und aus Angeboten in Rechnungen
übernommen. PDFs zeigen sie mit 7 pt unter der 9-pt-Bezeichnung; leer ohne
zusätzliche Zeile. Lange Details können auf die nächste Seite umbrechen.

Lokale Abnahme am 2026-09-11, macOS/Node 25.9.0, Next 16.3.0, PB 0.39.10:

- `cd app && npm test`: 760 bestanden, 163 Integrationstests ohne sicheren Starter
  übersprungen. Neue Tests für beide Validatoren und vier Formularaktionen;
  PDF-Streams mit 9/7 pt, mehrzeiligen, leeren und seitenlangen Details geprüft.
- `node scripts/test-festschreibung-isolated.mjs`: 197/197 bestanden. Neue echte
  PB-Fälle für Anlegen, Ändern, Leeren, Festschreibung, Schutz vor direkter Änderung,
  Angebot senden und Übernahme in Rechnung. Nur synthetische tmpfs-Daten.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`, beide Hook-Generatoren
  mit `--check` und `git diff --check` bestanden.
- Browser über `scripts/test-rc-ui-isolated.mjs`: beide Katalogauswahlen lassen
  Beschreibung leer; Rechnung mit mehrzeiligen Details anlegen, ändern und neu
  laden; Angebot mit gefüllter und leerer Beschreibung in zwei Positionen anlegen
  und bearbeiten. Neue Feld-IDs verwenden `useId`, damit Server- und Browser-HTML
  übereinstimmen. Visuelle PDF-Prüfung kurzer Details sowie beider Seiten bei
  120 Detailzeilen mit Poppler; Folgeseiteneinzug geprüft.

README, Status, Roadmap und Entwicklung sind nachgezogen. App und PocketBase mit
Migration/Hook gemeinsam aktualisieren. Kein Produktionsbuild, VPS-Nachtest oder
Deployment. Der E-Rechnungs-XML-Export und wiederkehrende Vorlagen sind nicht
Teil der Erweiterung. Bestehende Original-PDFs werden nicht neu erzeugt.

## TP-032: UI-Wording-Audit, 2026-09-12

Änderung in Shell, E-Rechnungen, Belegen, Kassenbuch, Rechnungen, Angeboten,
Kontakten, Kontoauszug, Nutzerverwaltung und Exportfehlermeldungen. Die sichtbare
Prozesssprache verwendet nun unter anderem "auslesen" statt "parsen" und
"buchen" für die geprüften endgültigen Buchungsvorgänge. Technische
Status-/Modellbegriffe und die Exportfunktion bleiben erhalten. Owner: die
jeweiligen UI-Dateien, `lib/labels.ts`, `einvoice/{actions,send-invariants,
validate-outbound}.ts`, `reporting/repository.ts`, `travel/actions.ts`.

Lokale Prüfung am 2026-09-12, macOS/Node 25.9.0, Next 16.3.0:

- `cd app && npm run typecheck` bestanden.
- `cd app && npx vitest run src/modules/einvoice src/modules/reporting/repository-export.test.ts src/modules/expenses src/modules/cash src/modules/sales src/modules/travel`: 23 Dateien, 342 Tests bestanden.
- `cd app && npm test`: 760 bestanden, 163 sichere Integrationstests übersprungen.
- `cd app && npm run lint -- --max-warnings=0` und `git diff --check` bestanden.

Kein Browser-, VPS- oder Deploymenttest. Keine Änderung an Geschäftslogik,
Persistenz, Import-/Exportabläufen oder Finanzinvarianten.

## TP-033: Deutscher Absendername beim Cloud-Mailversand, 2026-10-02

Änderung: `app/src/lib/smtp.ts` verwendet beim zentralen Cloud-Fallback
`<Firmenname> über Zettelruhe <versand@zettelruhe.de>` statt „via Zettelruhe“.
Nur die sichtbare Bezeichnung und drei bestehende String-Erwartungen in
`app/src/lib/smtp-cloud.test.ts` sind geändert. Reply-To aus dem tenantgebunden
geladenen Firmenrecord, `firmen.email`, SMTP-Vertrag, Transport und Caching
bleiben unverändert.

Lokale Prüfung am 2026-10-02, macOS, Node 25.9.0/npm 11.12.1, Next 16.3.5:

- In `app/`: `npm test` bestanden (70 Testdateien, 775 Tests; 7 Dateien und
  163 Tests übersprungen, zusätzlich 35 verschachtelte RC-Fälle ohne sicheren
  PB-Starter nicht ausgeführt, entsprechend dem bisherigen Prüfstand).
- `npm run typecheck`, `npm run lint -- --max-warnings=0` und
  `npm run build -- --webpack` bestanden.
- Beide Hook-Generatoren (`scripts/build-rc-hook.mjs` und
  `scripts/build-finanz-domain-hook.mjs`) mit `--check` sowie
  `git diff --check` bestanden.

Patchrelease `v1.0.3` per annotiertem Git-Tag; Paketversionen wie bei `v1.0.2`
unverändert. Kein Browserlauf nötig für die durch bestehende Mailtests geprüfte
Bezeichnung. Kein echter Mailversand, VPS-Zugriff, Deployment oder erneuter
Cloud-E2E-Lauf; kein Zugriff auf andere Repositories, keine Cloud-Bindung geändert.

## TP-034: Firmenspeichern → unauthorized nach Erfolgsredirect, 2026-10-02

**Diagnose abgeschlossen, Produktionsfehler offen außerhalb des Core.**
Untersuchter Core: `38de606` (`v1.0.3`). `FirmaForm` ruft
`platform/firma-actions.ts:updateFirmaAction` auf. Das Firmenupdate wird awaited;
Revalidierung und `redirect("/app/firma?saved=1")` liegen bereits außerhalb des
`try/catch` (Zeilen 183–187). Das M1-15/TP-023-Muster ist hier korrekt umgesetzt.
Echte Schreibfehler führen weiterhin zum Fehlerredirect, Auth-/Rechteprüfungen
laufen vor dem Schreiben. Die Action verändert weder Sessioncookie noch
Tenantbindung. Die Zielseite lädt Session, Mitgliedschaft und Firma erneut;
`saved` verändert die Autorisierung nicht. Im Core gibt es keinen Erzeuger der
rohen Antwort `{"error":"unauthorized"}`.

Nur lesend untersuchter Nachbarcheckout `zettelruhe-cloud`:
`services/control/server.mjs:21–43` erkennt den Edge-Auth-Endpunkt über einen
exakten Vergleich mit `req.url === '/internal/edge/authorize'`. Ein angehängtes
`?saved=1` verfehlt diesen Zweig und landet in der Service-Bearer-Prüfung;
der Browser-Sessioncookie ist dort kein Service-Token. Die Antwort ist exakt
HTTP 401 mit `{"error":"unauthorized"}`. `deploy/runtime/production.py:528`
erzeugt `uri /internal/edge/authorize` ohne explizite Query-Bereinigung.
[Caddys Rewrite-Semantik](https://caddyserver.com/docs/caddyfile/directives/rewrite)
erhält eine nicht überschriebene Query. Der Cloud-Bericht
`docs/tasks/TP-008-production-runtime.md:685–690` dokumentiert bereits einen
entsprechenden Mutationsfehler mit damaliger betrieblicher Korrektur.
Die aktuell produktive Caddy-Konfiguration wurde nicht abgerufen; ihre
Übereinstimmung mit dem lokalen Generator bleibt unbestätigt.

Lokale Reproduktion mit dem **unveränderten** Cloud-Control-Handler,
synthetischem Ready-Tenant und Aufruf seines HTTP-Request-Listeners (ohne
Netzwerklistener, Kundendaten oder Konfigurationsdateien):

| Edge-Auth-Request | Ergebnis |
|---|---|
| `/internal/edge/authorize` | 204 |
| `/internal/edge/authorize?saved=1` | 401, `{"error":"unauthorized"}` |
| `/internal/edge/authorize?error=test` | 401, dieselbe Antwort |

Dies erklärt die bereits gespeicherten Daten: Der POST ist abgeschlossen,
erst der nachfolgende GET mit Query scheitert am vorgeschalteten Edge-Gate.
Ein Core-Workaround durch Entfernen von `saved=1` würde nur den Auslöser
verbergen und ließe weitere Query-Pfade kaputt. Keine Änderung an Core-Laufzeit,
Cloud, Caddy, Sessionarchitektur oder Tenantarchitektur vorgenommen.

Neue Regression: `app/src/modules/platform/firma-actions.test.ts`. Sie führt
die echte Action mit echtem Next-Redirect aus, prüft das Firmenupdate, lässt
den Zielrequest durch den echten Core-Proxy und rendert die echte Firmenseite
mit derselben signierten Cloud-Session. PB-/Control-HTTP und Nexts
Request-/Cache-APIs sind Testdoubles; Session-, Mitgliedschafts- und
Tenantprüfung sind echt. Zusätzlich: PB 401/403/500, fehlender Name,
Lesemitgliedschaft, fehlende Session und Ablehnung der Session für fremden Tenant.
Der Erfolgsfall ist bereits mit unverändertem Core grün: Schutz vor künftiger
Regression, **kein Nachweis einer Behebung des Produktionsfehlers**.

Prüfung am 2026-10-02 unter macOS, Node 25.9.0, npm 11.12.1, Next 16.3.5:
`cd app && npx vitest run src/modules/platform/firma-actions.test.ts
src/modules/einvoice/actions.test.ts src/lib/instance-context.test.ts`:
13/13 bestanden (davon 7 neue Fälle). Gesamtsuite `npm test`: 71 Testdateien
bestanden, 7 übersprungen; Vitest meldet 782 bestandene und 163 übersprungene
Tests (weitere 35 Fälle in nicht aktivierten verschachtelten Integrationssuites;
kein echter PB-Starter). `npm run typecheck` und
`npx eslint src/modules/platform/firma-actions.test.ts` bestanden.
Kein Browser-/HTTP-E2E mit laufender Next-Runtime, keine echte PB-Integration,
kein Produktionsbuild, VPS-Zugriff oder Deployment. Der Core-Test kann den
vorgeschalteten Cloud-Edge nicht abnehmen. Die Fehlerbehebung dort ist durch
die ausdrückliche Auftragsgrenze „keine Änderungen an zettelruhe-cloud“ offen.

## TP-036 Kanonischer Host bei internen Next-Redirects (2026-10-02)

**Ursache:** Next 16.3.5 lädt nach erfolgreichen Server Actions die relative
Redirect-Zielseite intern als RSC über seine Server-Origin (`createRedirectRenderResult`
in `next/dist/server/app-render/action-handler.js`). Wenn dieser Transport den
`Host` durch eine Containeradresse ersetzt, prüft `requireIngress()` bisher
diese Adresse erneut als öffentlichen Host und verwirft sie mit
`INSTANCE_HOST_INVALID`; `proxy.ts` antwortet mit HTTP 503. Der Write und die
Redirects von `updateRechnungAction` und `updateFirmaAction` sind bereits korrekt
außerhalb der Write-Fehlerbehandlung. `?saved=1` ist nur der Erfolgsmarker.

**Korrektur:** Nach geschützter Hostauflösung setzt der bestehende Proxy den
Host aus `context.appUrl` als `x-instance-app-host` mit einem zeitlich begrenzten,
domänengetrennten HMAC-SHA256-Nachweis (`x-instance-app-host-proof`, fünf Minuten).
Signierschlüssel ist das bestehende `INSTANCE_INGRESS_TOKEN`; keine neue ENV,
Tenantregistrierung, Session oder Context-Persistenz. Next-Request-Overrides
reichen diese Angaben an Action/Server Components und interne Folgeaufrufe.
Die Nachweise werden ausschließlich als Requestheader gesetzt, nicht als
Browserantwort. Control löst weiterhin den kanonischen Host auf und validiert
den zurückgegebenen Kontext. Ein öffentlicher Host muss exakt dazu passen;
ein IP-Transporthost darf nur mit gültigem Nachweis durchgereicht werden und
kann selbst keinen Tenant auswählen. Eingangstoken, Hostformat, HMAC, Laufzeit,
Forwarded-Host und anschließend die tenantgebundene Session werden geprüft.
Fremde/mehrdeutige Forwarded-Hosts, unbekannte Hosts, gefälschte oder unvollständige
Nachweise bleiben abgewiesen. Self-Hosting nutzt unverändert ENV und sein Cookie.

**Lokale Abnahme:** macOS, Node 25.9.0, Next 16.3.5, 2026-10-02:

- `cd app && npm test`: 73 Dateien bestanden, 7 übersprungen; 808 Tests bestanden,
  163 übersprungen. 35 weitere verschachtelte RC-Integrationsfälle bleiben ohne
  sicheren PB-Starter nicht ausgeführt. 13 neue Fälle in `instance-redirect.test.ts`
  prüfen externe/interne Requests, Container-IP allein, exakte Hostbindung,
  fremde Forwarded-Hosts, manipulierte/abgelaufene/künftig datierte/unter anderem
  Schlüssel signierte Nachweise, tenantId-Bindung und das echte Self-Hosting-Cookie.
- `cd app && npm run typecheck`, `npm run lint -- --max-warnings=0` und
  `npm run build -- --webpack`: bestanden. Build mit synthetischer Cloud-ENV
  und deaktiviertem Scheduler; keine Datenmigration.
- `node scripts/test-instance-redirect-local.mjs`: vier Prüfgruppen bestanden.
  Gebaute Produktions-Next-Runtime, echte gerenderte Formulare und Server Actions,
  lokale synthetische HTTP-Fixtures für Control/PB, gültige signierte Session.
  Ein testlokaler HTTP-Transport ersetzt bei Nexts echtem internen Redirect
  den Host durch Loopback-IP:Port. Firma und Rechnung werden jeweils einmal
  gespeichert; der interne RSC-Folgeaufruf und die anschließende authentifizierte
  `?saved=1`-Seite enthalten den geänderten Inhalt. Containerhost allein,
  manipulierter Forwarded-Host, unbekannter Host mit Tenantquery und gefälschter
  Kontextheader scheitern. Browserantworten enthalten keine Nachweise,
  Middleware-Requestheader oder Secrets. `JOBS_DISABLED=1`, ausschließlich
  dynamische Loopback-Ports und In-Memory-Testdaten; keine echten PB-Daten.

**Grenzen:** Keine manuelle Browser-, echte PocketBase-, Cloud-Edge-, VPS- oder
Deploymentabnahme. TP-034 prüfte den externen öffentlichen Zielhost; sein
datierter Befund ist kein Nachweis für den hier ergänzten Containerhost-Fall.
Der separate Cloud-Edge-401-Fund bleibt offen. `control()` und dessen
`INSTANCE_UNAVAILABLE`-Fehler bei erfolgloser Control-Antwort bleiben unverändert;
der unbewiesene Verdacht dazu wird hier weder untersucht noch behoben. Billing-
und Rate-Limits bleiben unverändert.

## TP-037 Cloud-Ersteinrichtung nach Login (2026-10-08)

**Umsetzung:** Der generische AGPL-Kern unterstützt einen optionalen instanzlokalen
PB-Singleton `instanz_einrichtung/initialsetup001`. Ein externer Provisioner erstellt
ihn ausschließlich für neue Cloud-Kunden mit der bereits vorhandenen Firma und
Eigentümer-ID. Kein Erkennen eines Platzhalterstrings oder Browserzustands. Ohne
Marker bzw. im alten PB-Schema ohne Collection bleibt der bisherige Ablauf;
Self-Hosting liest diesen Zustand nicht. Die Migration erzeugt nur eine leere
Collection und ändert keine historischen Nutzer.

Login Action und Route führen bei `pending` nach `/app/firma`. Proxy und
serverseitige Sessionguards sperren normale Seiten und fachliche Actions, auch
bei POST auf diese erlaubte Seite; Control/Billing, Tenantbindung und Originprüfungen
bleiben vorgeschaltet. Einrichtung der gebundenen Firma, Logo, eigenes Passwort und
Logout bleiben erreichbar. Die reduzierte Navigation zeigt keinen internen
Benutzernamen, und Layoutnachträge sowie Scheduler bleiben aus.

Das vorhandene Firmenformular erhält den Eigentümernamen als zusätzlichen Abschnitt.
Der atomare PB-Abschluss speichert Firmenangaben, Nummernkreise, optional Logo und
ausschließlich `name` am bestehenden Eigentümeraccount sowie den Abschlussstatus
in einer Transaktion. ID, E-Mail, Eigentümerrollen und Mitgliedschaften bleiben
erhalten. Fehler rollen zurück und erlauben Wiederaufnahme; Antwortverlust und
Parallelaufrufe liefern anschließend ein lesendes Replay. Erfolg führt nach `/app`.
Die vorhandene Nutzerverwaltung erhält eine Namensänderung mit bestehenden
Firmenverwaltungsrechten und Prüfung der Zielmitgliedschaft.

**Lokale Abnahme:** macOS, Node 25.9.0, Next 16.3.5, Vitest 4.1.11,
PocketBase 0.39.10; uncommittierter Arbeitsstand auf Core `454c3ef`:

- `cd app && npm test`: 74 Dateien bestanden, 7 übersprungen; 833 Tests bestanden,
  163 übersprungen. Weitere 35 verschachtelte RC-Integrationsfälle bleiben ohne
  ihren separaten Starter nicht ausgeführt. Keine historische Finanztestmatrix
  zusätzlich gestartet. 21 neue gezielte Fälle in `initial-setup.test.ts` belegen
  Login Action/Route, Guards, Owner-/Firmenmitgliedschaft, atomaren Aufruf,
  Fehler/Resume, fehlende Angaben, Cookie-/Tenant-/Control-Isolation, fehlendes
  altes Schema, fertige Instanzen, reduzierte UI, spätere Namenänderung und
  Self-Hosting. Eine alte Abschlussaction bleibt nach späteren Firmen-/Namenänderungen
  ein lesendes Replay und überschreibt diese nicht. Vier neue Scheduler-Guardfälle
  sind ebenfalls enthalten.
- `npm run typecheck`, `npm run lint -- --max-warnings=0` und
  `npm run build -- --webpack`: bestanden. Finaler Build mit synthetischer Cloud-
  Konfiguration und `JOBS_DISABLED=1`.
- `node scripts/test-instanz-einrichtung-isolated.mjs`: 8/8 echte PB-Prüfgruppen
  mit zwei getrennten tmpfs-PBs und aktuellen Produktionshooks/-migrationen.
  Testlokale Fehlerinjektion nach Firma-, User- und Markerwrite belegt vollständigen
  DB-Rollback. Pflichtfelder, Rechte, fremde IDs, direkte API-Sperre, Retry/Replay,
  zwei parallele Abschlüsse (ein Commit, ein Replay), Tenanttrennung bei gleichen
  IDs, Logo und der unveränderte Nummernkreisendpoint bestanden.
- `node scripts/test-initial-setup-isolated.mjs`: 4/4 Prüfgruppen mit einer
  gebauten gemeinsamen Cloud-Next-Runtime, zwei getrennten tmpfs-PBs, synthetischem
  Control und anschließend separater Self-Hosting-Next-Runtime. Echte Login- und
  Server-Action-POSTs, gerenderte Formulare, serverseitige Gates, echter
  Unique-Firmenname-DBfehler mit Rollback/Relogin/Resume, vollständiger Abschluss,
  unveränderte Identitäten und Mitgliedschaften, Sessiontransfer/fremde Query,
  Controlzugriffssperre, spätere Eigentümernamenänderung und Self-Hosting bestanden.
  Eine erneut gesendete alte Einrichtungsform bleibt auch nach späteren Firmen-
  und Namenänderungen ein lesendes Replay; vollständige Records bleiben gleich.
- `node scripts/test-instance-redirect-local.mjs`: 4 vorhandene Prüfgruppen
  bestanden; die Fixture enthält nun den leeren optionalen Einrichtungszustand.
- Finanz-Hookgenerator, JS-Syntax und `git diff --check`: bestanden. Die lokale
  Codegraph-CLI wurde aktualisiert und für den Änderungsradius verwendet; ihr
  MCP-Server war in dieser Sitzung nicht verfügbar.
- Cloud `npm run check`: 51 Node-Tests und 274 Pythonfälle (273 ausgeführt,
  ein vorhandener Skip) bestanden, einschließlich zehn neuer Seed-/Resume- und
  Bestandsschutztests. Auftrag und vollständige Dateiliste:
  `zettelruhe-cloud/docs/tasks/TP-014-cloud-initial-setup.md`.

Alle temporären Testcontainer und Next-Prozesse wurden entfernt. Dokumentation in
README, Status, Roadmap, Entwicklung und Instanzkontext wurde im selben Auftrag
aktualisiert. Die vorhandenen lokalen Löschungen von `.codex/config.toml` und
`docs/betrieb.md` bleiben erhalten.

**Grenzen:** Keine historische Accountreparatur, kein Commit/Push, Release oder
Deployment. `core.lock.json` bleibt unverändert. Vor späterer Bereitstellung muss
der neue AGPL-Kernstand veröffentlicht und exakt gebunden sein; das PB-Artefakt
für neue Instanzen benötigt Collection und Hooks. Das Quellcodeangebot muss diesen
Stand abdecken. Bestehende Instanzen werden für diesen Ablauf nicht migriert.
Keine manuelle Browser-, Cloud-Edge-/Stripe-, VPS- oder Produktionsabnahme.

**Releaseauftrag vom 2026-10-08:** Die bereits lokal geprüften TP-037/Cloud-TP-014-
Änderungen werden als Core-Release `v1.0.4` auf `main` veröffentlicht. Die
vorhandenen Löschungen von `.codex/config.toml` und `docs/betrieb.md` sind weiterhin
ausdrücklich ausgeschlossen. `git diff --check` bestand erneut; es wurde keine
weitere Testmatrix gestartet. Exakte Core-Bindung, Quellcodeangebot und
Produktionsnachweis werden im Cloud-Auftrag TP-014 aktualisiert.
