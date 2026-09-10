# Open-Source-Release und Zettelruhe Cloud

Historischer Planungsstand: 2026-09-10, Codebasis `0842832`.
Umsetzungsstand am selben Tag: lokale Releasevorbereitung auf `main` ab `f48be21`.
R-02 bis R-06 sind gezielt korrigiert beziehungsweise geprüft; R-07 bis R-12
sind lokal abgenommen oder als Grenzen dokumentiert. R-01 bleibt wegen der
öffentlichen Git-Historie offen. [Ergebnisse je Kandidat](issues/release-abnahme-2026-09-10.md),
[Release Notes](../CHANGELOG.md), [Materialbefund](issues/release-materialpruefung-2026-09-10.md).
Die folgenden ursprünglichen Prüfzahlen und Kandidaten beschreiben den Stand
vor der Umsetzung; sie werden nicht als aktuelle Fehlerliste weitergeführt.
 Die lokale Umsetzung ist beauftragt; dieser ursprüngliche Plan autorisiert weder Veröffentlichung noch
Projektanlage, Infrastruktur, Stripe-Konfiguration oder Datenänderungen.

## Entscheidung und bestätigter Stand

Betreiberbestätigung vom 2026-09-10: Reverse Charge wurde auf dem Produktions-VPS
getestet und läuft live. Die frühere Freigabesperre bis zu einer amtlichen
ELSTER-Prüfung ist verworfen. Zettelruhe bietet einen XML-Datenexport und betreibt
keine Schnittstelle zum Finanzamt. Es besteht deshalb kein offenes Issue
„RC freigeben“ oder „ELSTER-Schnittstelle abnehmen“. Der genaue ausgerollte Commit
und einzelne Testschritte wurden in dieser Bestätigung nicht genannt; daraus
werden keine zusätzlichen Testnachweise für TP-024 oder andere Fälle abgeleitet.

GitHub wurde am 2026-09-10 lesend geprüft: `krisauseu/zettelruhe` ist bereits
öffentlich, die Liste offener Issues ist leer und es gibt keinen GitHub-Release.
Lokal existiert der Tag `meilenstein-2`. Der nächste Schritt ist ein benannter
Release mit nachvollziehbarem Stand und Veröffentlichungshinweisen.

Das Open-Source-Angebot erhält den heutigen Funktionsumfang. Korrekturen,
Sicherheitsupdates und die Pflege vorhandener Steuer-/Exportfunktionen bleiben
Aufgabe des Kerns. Neue Komfort- und Abofunktionen werden in `zettelruhe-cloud`
geplant. Vorhandene Funktionen werden nicht aus der Open-Source-Version entfernt.

## Ursprünglicher Prüfstand und Aussagekraft

| Prüfung am 2026-09-10 | Ergebnis |
|---|---|
| `cd app && npm test` | 731 Tests bestanden; 145 Tests übersprungen, fünf Integrationsdateien übersprungen. Kein neuer PB-Abnahmenachweis. |
| `cd app && ./node_modules/.bin/tsc --noEmit --incremental false` | Bestanden. |
| `cd app && npm run lint` | Zwei Fehler, sechs Warnungen. Früher waren drei Fehler dokumentiert. |
| Codegraph und gezielte Quellprüfung | Jobs/Lock, Firmen- und Vorlagenpagination, wiederkehrende Erzeugung sowie dokumentierte RC-/Exportgrenzen abgeglichen. |
| GitHub | Öffentlich, null offene Issues, kein Release. Nur lesende Abfragen. |
| Build, echte PB-Integration, Browser, Restore, Security-Audit | In dieser Planungsrunde nicht neu ausgeführt. Frühere Nachweise und Betreiberbestätigung bleiben gültig für ihren jeweiligen Umfang. |

Der Alltag ist laut Betreiber stabil. Die folgenden Kandidaten sind keine
Behauptung, dass alle Fehler im laufenden Betrieb aufgetreten sind. Eine leere
GitHub-Issueliste ist kein Beweis für Fehlerfreiheit. Die Liste bündelt die
bekannten Unterlagen und gezielte Quellprüfung, keinen vollständigen Codeaudit.

## Mögliche Issues vor und nach dem Release

Die Kennungen R-01 usw. gelten nur für diesen Plan, nicht als bereits angelegte
GitHub-Issues. „Vor Release“ ist eine Empfehlung für den nächsten stabilen Release.

| Kandidat | Beleg und Einordnung | Empfohlenes Vorgehen |
|---|---|---|
| R-01 Öffentliche Arbeitsmaterialien prüfen | Getrackte Kontoauszugsdatei unter `docs/issues/`, Screenshots, Logos und Muster-PDF sind vorhanden. Inhalte/Freigaben wurden hier nicht auf personenbezogene oder vertrauliche Daten geprüft. | Vor weiterer Bewerbung des bereits öffentlichen Repos prüfen. Gegebenenfalls bereinigte synthetische Fixtures einsetzen. Bei bestätigtem sensiblen Inhalt auch Git-Historie/öffentliche Kopien berücksichtigen; keine eigenmächtige Historienumschreibung. |
| R-02 Zwei Lintfehler | `einvoice/parse-pdf-xml.ts:185`, `prefer-const`; `reporting/uebersicht-kategorien.tsx:190`, Mutation von `offset` im Renderpfad. Aktuell reproduziert. | Vor Release gezielt korrigieren; Donutdarstellung prüfen. Lintfehler ist nicht automatisch ein nachgewiesener Laufzeitfehler. |
| R-03 Wiederkehrende Rechnungen bei Parallelität/Fehlern | `jobs/lock.ts` übernimmt Locks über Lesen/PATCH und erlaubt denselben Holder; `scheduler.ts` verhindert überlappende Ticks nicht. `sales/wiederkehrend-repository.ts` erzeugt den Entwurf vor separatem Datumsfortschritt. | Vor Release einen gezielten Fehler-/Paralleltest durchführen: zwei Ticks oder Abbruch nach Entwurfsanlage dürfen nicht unbemerkt doppelte Entwürfe erzeugen. Risiko aus dem Code, hier nicht reproduziert. Je nach Ergebnis eng korrigieren oder transparent begrenzen. |
| R-04 Pagination wiederkehrender Jobs | `jobs/runner.ts` liest nur die ersten 50 Firmen. `listFaelligeWiederkehrende` liest höchstens 200 fällige Vorlagen pro Firma und Tick. | Bekannte Codegrenzen. Firmen jenseits der ersten Seite können übergangen werden; weitere Vorlagen können erst spätere Ticks erreichen, sofern frühere weitergeschaltet werden. Nachstellen/komplett paginieren; kein beobachteter Ausfall der heutigen Solo-Instanz. |
| R-05 Verbleibende Finanz-Atomarität | Zahlungen, Bankmatching und gewöhnlicher Rechnungsstorno sind laut TP-022-Abnahmen nicht atomarisiert. | Gezielte Risikoanalyse und Fehler-/Replayfälle. Kein pauschaler Neubau als Releasevoraussetzung; bei reproduzierbarem Verlust/Doppelbuchung vor stabilem Release korrigieren. |
| R-06 RC-Oberfläche gegenüber Fachvertrag | `rc-fields.tsx` setzt Bestätigungen automatisch, voller Abzug unter Regelbesteuerung ist vorausgewählt; umfangreicher Erklärungshinweis nur bei Teil-/Mehrfachzahlung. `rc-details.tsx` rechnet die angezeigte Differenz mit `Number`, der gespeicherte Rechenkern mit Decimal. | Bewusste UX-Prüfung und kleine Rechenvereinheitlichung erwägen. Kein nachgewiesener falscher gespeicherter Steuerbetrag, RC-Produktivfreigabe bleibt bestehen. |
| R-07 Exportgrenzen | DATEV light lehnt RC-Zeiträume ab; ZIP höchstens 256 MiB Dateinutzlast im Speicher. TP-024 behebt bereits unvollständige Pagination/fehlende Dateien. | Als bekannte Grenzen in Release Notes nennen. Streaming und DATEV-RC sind Erweiterungen, keine offenen TP-024-Fehler. |
| R-08 Steuer-/E-Rechnungsumfang | UStVA-XML nur 2026 Monat/Quartal; kein nachgewiesener amtlicher XML-Import. ZM nur Kandidaten, EÜR light, kein zertifizierter E-Rechnungsversand und kein Hybrid-PDF/A-3. | Grenzen klar benennen. Unterstützung künftiger Steuerjahre rechtzeitig im Kern pflegen. Keine neue ELSTER-Sperre und kein Zertifizierungsprojekt für diesen Release. |
| R-09 Frische Installation und Upgrade | Frühere Abnahmen vorhanden; kein neuer Releasekandidat auf leerem Bestand und mit isoliertem Restore geprüft. PB-Binary ist laut Dockerfile auf linux_amd64 festgelegt. | Den vereinbarten Releasecommit einmal frisch starten, bestehendes Backup isoliert wiederherstellen und migrieren. Unterstützte Architektur nennen; ARM-Erweiterung ist optional. |
| R-10 Health und Betriebsgrenzen | `/health` liefert auch bei `ok:false` HTTP 200; Compose prüft nur Status. Session hat feste TTL; Leseaufrufe können Zahlungsjournal nachziehen; Compose-Volume ist fest benannt. | Im Self-hosting dokumentiert, kein neuer Funktionsfehler. Für Cloud echte Bereitschaftsprüfung, Jobkontrolle und voneinander getrennte Volumes zwingend einplanen. |
| R-11 Wartung und reproduzierbare Prüfung | Sechs Lintwarnungen in Jobs, `platform/firma-write.ts`, `sales/pdf.tsx`; Vite-Konfigurationswarnung. Historische Next-Middleware-Warnung und Google-Fonts-Buildabhängigkeit. Keine CI, SECURITY.md, CONTRIBUTING.md oder CHANGELOG gefunden. | Warnungen einordnen; kurze Release-/Beitrags-/Sicherheitsinformationen und minimale CI empfehlen. Kein Frameworkwechsel nur für den Release. Build aus sauberem Checkout belegen. |
| R-12 Release-Nachvollziehbarkeit | Dokumentation noch uncommittiert, vorhandene fremde Löschung des VPS-Berichts. Exakter Produktionscommit nicht durch die aktuelle Bestätigung festgelegt. | Dateien gezielt auswählen, Änderungen abschließen, Releasecommit und Tag festhalten. Keine vollständige VPS-Testmatrix aus einer allgemeinen Betreiberbestätigung erfinden. |

Bereits erledigt bleiben M1-Mängel, M2-01 sowie TP-020–025. TP-026 dokumentiert
den vorhandenen UI-Nachzug; ein zusätzlicher Browsernachweis wäre Teil eines
Release-Smokes, kein wiedereröffneter RC-Blocker. TP-009 ist ein Komfortwunsch.
Historische Hinweise „TP-022 offen“, „Kassenstufe fehlt“ oder „Zahlung ohne Journal“
sind durch spätere Abnahmen/ADRs abgelöst.

## Vollständige Sammlung der noch nicht gebauten Produktwünsche

Diese Punkte sind keine Fehler des freizugebenden Umfangs. Die bisherige
„Später im Kern“-Liste wird als Cloud-Ausbau weitergeführt. Die Reihenfolge ist
noch keine Zusage, alles im ersten Abo umzusetzen.

| Bereich | Noch offene Wünsche | Ziel |
|---|---|---|
| Belege | KI-Belegerkennung/OCR, Prüfoberfläche vor Übernahme, optional später Bankmatching gegen Ausgabenbelege | Cloud |
| Dokumentenlayout | Briefpapier als PNG/PDF, erste/Folgeseiten, Schrift-Upload/Hausschrift, Inhaber:in, Kunden-Nr., Ansprechpartner „z. Hd.“, AGB-Anhang, Vorschau/Studio, mehrere Vorlagen, CSS-Profi-Layouts | Cloud; vorhandenes Logo/Farbe/Layout bleibt im Kern |
| Stammdaten | Eigene Mengeneinheiten, Abkürzungen, Einzahl/Mehrzahl, TP-009 | Cloud |
| Verkauf | Eigene Rabattfelder, separates Gutschrift-/Stornorechnungsdokument, Abschlags-/Schlussrechnungskette, Lieferscheine | Cloud-Ausbau; notwendige Korrekturen am vorhandenen Rechnungsstorno bleiben Kernpflege |
| Forderungen und Zahlwege | Automatischer Mahnlauf mit Stufen/Gebühren/Zinsen, SEPA-Mandate, Kundenportal/Pay-Links, PayPal-/Stripe-Zahllinks für Rechnungen | Cloud, später; getrennt vom Stripe-Abo für Zettelruhe selbst |
| Reisekosten und Anlagen | Verpflegungspauschalen/erweiterte Reisekosten, Anlagenverzeichnis, GWG, AfA | Cloud, später |
| Projekte und Mobil | Budgets/Stundendeckel, PWA/vertiefte mobile Erfassung | Cloud; bestehende mobile Sidebar bleibt Kern |
| Export und Kanzlei | Dokumentlisten-CSV/allgemeiner Tabellenexport, vollständiger amtlicher EÜR-Kategorienplan, spezialisierter Steuerberaterzugang, DATEV-Services-Push | Cloud-Ausbau; vorhandene Rolle Lesen und vorhandene Exporte bleiben Kern |
| Integration | Live-Bank/PSD2, öffentliche Fach-REST-API/Shop-Anbindung | Cloud, später |
| E-Rechnung | Hybrid-PDF/A-3 erst mit geeigneter Pipeline, sofern weiter gewünscht | Separater Cloud-Entscheid; vorhandener XML-Versand bleibt Kern |
| Hosting | Provisioning, eigene PB-Instanz und Volume je Kunde, Subdomains/TLS, Backups/Restore, Updates, Monitoring, Support, Aboverwaltung | Cloud-Grundlage |
| Technische Schnittstelle | Stateless PB-URL-Adapter, in ADR-0030 entschieden, nicht gebaut | Nur bei tatsächlichem Bedarf des gewählten Cloud-App-Modells |

Bewusst weiterhin kein Auftrag: Bilanzvollbuchhaltung, Soll-Versteuerung,
Lohn/HR, Kanzlei-Mandantenverwaltung, DACH-Steuerprofile und allgemeine
Feature-Parität. Eine gemeinsame Finanzdatenbank für alle Cloud-Kunden bleibt
außerhalb des Zielbilds.

## Vorgehen in fünf Schritten

### 1. Open-Source-Release abschließen

Den heutigen Umfang festlegen und R-01/R-02 bearbeiten; R-03/R-05 gezielt prüfen,
R-04 begrenzen oder beheben. Danach Unit-Tests, Typecheck, Lint und die echte
Finanz-/RC-Integration über `node scripts/test-festschreibung-isolated.mjs`
auf dem finalen Stand ausführen. Der Starter öffnet heute keine Produktionssperre;
RC ist aktiv, `--rc-kern` ist nur ein kompatibel akzeptiertes historisches Argument.

Einen frischen Dockerstart und einen isolierten Upgrade-/Restore-Smoke prüfen.
Bekannte Grenzen dokumentieren. README, kurze Beitrags-/Sicherheitsinformationen,
Release Notes und minimale CI fertigstellen. Ziel: nachvollziehbarer stabiler
Release, nicht Umsetzung der gesamten Wunschliste. Vorschlag für den Tag:
`v1.0.0`, sofern diese Abnahme den stabilen Anspruch bestätigt; bei verbleibenden
wesentlichen Funktionsrisiken ausdrücklich einen Vorab-Release wählen.

Abschlusskriterium: eindeutiger Commit, reproduzierbare Installation, keine
ungeklärten Befunde mit möglichem Datenverlust/Doppelbuchung, verständliche Grenzen.
Dann gezielt committen/pushen und GitHub-Release auf ausdrücklichen Releaseauftrag
veröffentlichen. Die schon öffentliche Repository-Sichtbarkeit braucht keinen
weiteren Umschaltvorgang.

### 2. Cloud-Projekt und Produkt-/Lizenzgrenze festlegen

Danach ein separates Projekt/Repository `zettelruhe-cloud` anlegen. Zunächst
Produktbeschreibung, Architekturentscheidung, Entwicklungs-/Betriebsplan und
Backlog. Kernversion über einen festen Release/Images referenzieren; keine
unkontrollierte zweite Kopie der Buchhaltungslogik pflegen.

Bezahltes Hosting ist mit AGPL vereinbar. Ein privates Repository allein macht
Änderungen am AGPL-Kern aber nicht proprietär: § 13 verlangt bei entsprechenden
modifizierten Netzwerkversionen ein Quellcodeangebot an deren Nutzer. Vor dem
Einbau nur kommerziell angebotener UI-/PDF-Funktionen Rechteinhaberschaft,
Drittbeiträge und Lizenzmodell prüfen. Entweder eigenständige Dienste sauber
abgrenzen oder bei ausreichenden Rechten ein kommerzielles Lizenzmodell festlegen.
Der bereits veröffentlichte AGPL-Stand bleibt verfügbar. Quelle:
[AGPL-3.0, insbesondere §§ 5 und 13](https://spdx.org/licenses/AGPL-3.0-only.html).

Das ist eine Planungsfrage vor Cloud-Implementierung, kein Grund, den heutigen
Kernrelease um Cloud-Funktionen zu erweitern.

### 3. Zwei isolierte Kundeninstanzen betreiben

Ziel: Kunde A und Kunde B haben jeweils eine eigene PocketBase-Instanz samt
SQLite-Datenbank, Dateien/Volume, Zugangsdaten und eigenem Backup. Mehrere Firmen
innerhalb eines Kunden bleiben vom bestehenden Multi-Firma-Modell abgedeckt.
Eine separate zentrale Verwaltungsdatenbank darf Abo-/Provisioningstatus halten;
Buchhaltungsdaten gehören in die jeweilige Kundeninstanz.

Für den Pilot empfehle ich einen vollständigen Next+PB-Stack je Kunde mit
festem `PB_URL`, eindeutigem Volume und Subdomain. Das nutzt den heutigen Kern.
ADR-0030 sieht als mögliches Ziel ein gemeinsames Next mit PB-Adapter vor;
der Pilotvorschlag ist noch keine beschlossene Änderung dieser Architektur.
Ein gemeinsames Next erst nach belegter Notwendigkeit und Prüfung insbesondere
des pro Prozess gecachten PB-Superuser-Tokens, der Sessions, Jobs und Caches.

Provisioning als wiederholbaren Ablauf bauen: anlegen → starten → prüfen →
freigeben, mit Fehlerzuständen und Wiederaufnahme. Kundenauflösung nie aus
beliebigen PB-URLs des Browsers übernehmen. Ressourcenlimits und getrennte
Backup-/Restorepfade vorsehen. Der Webprozess erhält keinen uneingeschränkten
Docker-Socket. Migrationen schrittweise auf Pilotinstanzen testen.

Abschlusskriterium: beide Instanzen funktionieren; Kunde A erreicht keine Daten,
Dateien oder Session von B; Restore/Update/Ausfall von A lässt B unverändert.

### 4. Stripe und Kundenlebenszyklus

Zunächst ein überschaubares Abo mit Stripe Checkout, Billing und Kundenportal.
Abopreise, enthaltene Ressourcen und Supportumfang separat festlegen.
Cloud-Kunde, Stripe-Kunde, Abo und Instanz eindeutig verknüpfen. Zahlungs- und
Abostatus sind getrennt vom technischen Instanzstatus.

Webhooks signaturprüfen, Ereignisse dauerhaft protokollieren und wiederholbar
verarbeiten. Doppelte, verspätete oder anders geordnete Events dürfen weder
zweite Instanzen noch falsche Freigaben erzeugen. Freischaltung beruht auf
verifiziertem Zahlungs-/Abostatus, nicht auf der Checkout-Erfolgsseite.
Zahlungsfehler, notwendige Kundenaktion, Tarifwechsel und Kündigung berücksichtigen.
Quellen: [Stripe-Abowebhooks](https://docs.stripe.com/billing/subscriptions/webhooks),
[Webhook-Verarbeitung](https://docs.stripe.com/webhooks).

Karenz, Lese-/Exportzugang nach Kündigung, Aufbewahrung und spätere Löschung
bewusst festlegen. Ein Zahlungsausfall darf keine unmittelbare Datenlöschung
lösen. AV-Vertrag, Datenschutz, Supportzugriff und Erreichbarkeit für den
Managed-Betrieb konkret vorbereiten.

Abschlusskriterium: synthetischer Ablauf von Aboabschluss bis Kündigung samt
Zahlungsfehler, Event-Wiederholung, Wiederaufnahme und sicherem Datenexport besteht.

### 5. Bezahlte Zusatzfunktionen und Pilot

Zuerst Briefpapier/erweiterte Layouts und Belegerkennung, anschließend weitere
Wünsche nach Nachfrage. OCR liefert prüfbare Vorschläge; keine ungeprüfte
Festschreibung. Originaldateien erhalten, Nutzungslimits und Kosten erfassen.
Beleginhalte nur nach festgelegter Verarbeitungspolitik an externe Anbieter senden.
Layoutänderungen ändern keine bereits festgeschriebenen Originale.

Mit wenigen echten Pilotkunden starten. Provisioningdauer, Restore-Erfolg,
Abozustände, Speicher-/OCR-Kosten und Supportfälle beobachten. PSD2, Mahnläufe,
Anlagen/AfA und die übrige Liste sind spätere Ausbaustufen.

Abschlusskriterium: tragfähiger Betrieb mit erprobtem Restore, korrekter Abrechnung
und klarer Leistungsgrenze. Erst dann das Angebot breiter vermarkten.

## Nächster konkreter Schritt nach lokaler Umsetzung

Über den dokumentierten R-01-Befund und eine Bereinigung der öffentlichen Historie
entscheiden. Anschließend den gezielt ausgewählten Releasecommit samt erhaltenen
Audit-Dokumenten festlegen; die fremde Löschung des VPS-Berichts nicht automatisch
übernehmen. Erst nach dieser Abnahme Tag und Veröffentlichung separat beauftragen.
Cloud-Gründung bleibt ein eigener Auftrag. Keine GitHub-Issues wurden angelegt.
