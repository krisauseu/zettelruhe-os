# Entwicklung und Bestandsaufnahme

Stand: 2026-09-10, Release `v1.0.0` im bereinigten Repository
`krisauseu/zettelruhe-os`. Die lokale Releasevorbereitung ab `f48be21` bleibt
unten als datierter Prüfnachweis erhalten.
Diese beim Codex-Onboarding angelegte Übersicht bleibt der gemeinsame technische
Einstieg für Menschen, Codex und grok-build. Historische Prüfergebnisse stehen
unten mit ihrem damaligen Datum; sie belegen keinen heutigen VPS-Stand.

TP-022 und TP-023 sind laut Betreiberbestätigung vom 2026-09-07 lokal und auf
beiden VPS abgeschlossen, zuletzt mit `003c2d8`. Danach wurden TP-024,
Reverse Charge, TP-025 und die Formularvereinfachung `961d06d` umgesetzt.
Reverse Charge ist laut Betreiberbestätigung vom 2026-09-10 auf dem
Produktions-VPS getestet und live. Die frühere ELSTER-Freigabesperre ist verworfen;
Zettelruhe erzeugt nur einen XML-Export. Der genaue Produktionscommit und einzelne
TP-024-/UI-Nachtests wurden dabei nicht benannt. Der aktuelle Gesamtstand
steht in [90-status.md](90-status.md), die Pflegezuständigkeit in der
[Dokumentenübersicht](README.md#pflege-bei-änderungen).

## Entwicklung nach v1.0.0: Cloud-TP-002

Kontext-/Sessionadapter, Node-Proxy, interne HTTP-Auflösung, explizite Jobs,
tenantgerechte URLs und SMTP sind im [Laufzeitdokument](instance-context.md)
beschrieben. Es gibt keine Kernmigration oder Hookänderung in diesem Auftrag.
Die vollständige Zwei-PB-Abnahme liegt im separaten Cloud-Repository unter
`docs/tasks/TP-002.md`, der Starter unter `scripts/test-tp002-isolated.mjs`.
Die Kernreferenz dort kennzeichnet diesen Stand ausdrücklich als Entwicklung.

## Quellen und Arbeitsregeln

| Quelle | Wann lesen und wie einordnen |
|---|---|
| [CONTEXT.md](../CONTEXT.md) | Fachsprache, Steuer-Modi, Produktgrenzen vor fachlichen Änderungen. |
| [Feature-Roadmap](feature-roadmap.md) | Scope und zurückgestellte Funktionen. Vorhandener Umfang, offene ursprüngliche v1-Ziele und spätere Funktionen sind getrennt. |
| [Reverse-Charge-Umsetzung](reverse-charge-umsetzung.md) | Bei Arbeit an EU-/Drittlandsdienstleistungen: aktueller Fachumfang, Bedienung, drei abgeschlossene Implementierungsabschnitte und datierte lokale Abnahmen. Frühe Abschnittsübergaben sind historisch. |
| [ADRs 0001–0030](adr/) | Entscheidungen vor Änderungen am jeweiligen Bereich. Spätere ADRs ergänzen frühere, insbesondere 0024 zu Zahlungen und 0025 zu Mitgliedschaften. |
| [Testphase-Log](testphase.md) | Aktuelle kleine Änderungen und offene Funde. TP-009 ist zurückgestellt; TP-022 und TP-023 sind auf allen drei Zielumgebungen abgeschlossen. |
| [Meilensteinstatus](90-status.md) | M1/M2 und größere Schnitte. Aktueller Stand und offene Abnahmen zuerst, historische Zwischenstände darunter. |
| [Betrieb](betrieb.md), [Verfahrensdokumentation](verfahrensdokumentation.md) | Start, Backup, Restore, Exporte und dokumentierte Betriebsgrenzen. |
| [Funktionstest M1](funktionstest-m1.md), [M2](funktionstest-m2.md), [Rohberichte](issues/) | Historische Testprotokolle. Vor Wiederverwendung die Abweichungen unten beachten. |
| [Sessions](sessions/) | Begründungen und damalige Verifikation. `*-prompt.md` beschreibt historische Aufträge, keine auszuführende Warteschlange. |
| [PROJEKT-AKTIVITAETEN.md](../PROJEKT-AKTIVITAETEN.md) | Lokale Aufwandsschätzung vom 15.08.2026, ausdrücklich kein Statusersatz. |
| [Ursprünglicher Entwurf](../Umsetzungsentwurf%20Papierkram.de%20v1.md) | Verweist bereits auf Glossar und Roadmap als Nachfolger. |

Vorhandene Skills bleiben an ihren bisherigen Orten:

- [.grok/skills/testphase-fix/SKILL.md](../.grok/skills/testphase-fix/SKILL.md)
  enthält das Verfahren für kleine Bugs und Änderungen, eine Modul-Routen-Tabelle,
  Invarianten und die Regeln für TP-Einträge. Kein Commit ohne Auftrag.
  Der Ordner war bei der Bestandsaufnahme unversioniert. Er ist lokal nutzbar,
  aber durch einen frischen Git-Checkout allein nicht verfügbar.
- [.agents/skills/grill-me/SKILL.md](../.agents/skills/grill-me/SKILL.md)
  verweist auf `/grilling`;
  [grill-with-docs](../.agents/skills/grill-with-docs/SKILL.md) zusätzlich auf
  `/domain-modeling`.
- [implement](../.agents/skills/implement/SKILL.md) verlangt bei expliziter
  Verwendung TDD an vereinbarten Grenzen, Typechecks, Tests, `/code-review`
  und einen Commit. Diesen Ablauf nicht allein wegen eines normalen
  Arbeitsauftrags automatisch aktivieren. Die Commit-Anweisung unterscheidet
  sich vom Testphase-Verfahren; der konkrete Nutzerauftrag gibt den Umfang vor.
- [handoff](../.agents/skills/handoff/SKILL.md) schreibt Übergaben ins temporäre
  Verzeichnis des Betriebssystems, mit Verweisen statt Dokumentkopien.
- Die vier `.agents`-Skills sind laut Frontmatter und `agents/openai.yaml`
  für explizite Aufrufe vorgesehen. `/grilling`, `/domain-modeling`, `/tdd`
  und `/code-review` sind nicht im Repository gebündelt. Ihre Verfügbarkeit
  hängt von der Agent-Umgebung ab. [skills-lock.json](../skills-lock.json)
  hält Herkunft und Hashes der vier Einstiegsskills fest.

[app/AGENTS.md](../app/AGENTS.md) enthält den von Next verwalteten Regelblock.
Vor Next-Codeänderungen die passenden Anleitungen unter
`app/node_modules/next/dist/docs/` lesen. [app/CLAUDE.md](../app/CLAUDE.md)
verweist darauf. Beide Dateien bleiben erhalten. Der lokale Codex-Codegraph
ist über `.codex/config.toml` angebunden;
Einrichtung und Aktualisierung stehen in [codegraph.md](codegraph.md).
`.github/workflows/ci.yml` prüft unter Node 22 Unit-Tests, Typecheck, warnungsfreies
ESLint und beide Hook-Generatoren. Echte PB-Integration und Browserabnahme laufen
separat. Eine automatische Dokumentationsprüfung ist nicht eingerichtet.

## Architektur und Einstiegspunkte

Zettelruhe ist self-hosted Buchhaltung und Abrechnung für Solo-Selbstständige
in Deutschland. Eine Instanz kann mehrere Firmen und Nutzer:innen mit
Mitgliedschaften führen. Fachlogik und Oberfläche laufen zusammen in Next;
PocketBase stellt Auth, SQLite, Collections und Dateien bereit.

Der geprüfte Paketstand in [app/package.json](../app/package.json) verwendet
Next.js 16.3.0, React 19.2.8, TypeScript mit `strict`, Tailwind CSS 4,
`decimal.js`, `jose`, `@react-pdf/renderer`, `qrcode` und Nodemailer.
Vitest 4.1.10 und ESLint 9 prüfen den Code. Das
[Lockfile](../app/package-lock.json) bindet die aufgelösten Paketversionen.
Kein ORM, PocketBase-Client-SDK oder separates Domain-Backend ist eingebunden.

```text
Browser → Caddy → Next: Seiten, Form-POSTs, Server Actions, Downloads
                   ↓
             Fachmodule → lib/pb.ts → PocketBase → SQLite + Dateien

Browser → Caddy /api/* und /_/* → PocketBase direkt
Next instrumentation → In-Process-Scheduler → wiederkehrende Entwürfe
Next → optional SMTP; BZSt-Abfrage nur auf ausdrückliche Nutzeraktion
```

- [app/src/app/](../app/src/app/) enthält den App Router. `/` entscheidet
  zwischen Setup, Login und App. Login und Setup verwenden Form-POSTs auf
  `/login/submit` und `/setup/submit`; daneben bestehen Auth-Server-Actions.
- [app/src/app/app/](../app/src/app/app/) entspricht `/app/...`.
  Das geschützte Layout lädt Session, Mitgliedschaft und Firmenwechsler.
  Seiten sind überwiegend Server Components, interaktive Formulare und
  Navigation verwenden Client Components. Dynamische Parameter werden asynchron gelesen.
- [app/src/modules/](../app/src/modules/) enthält Fachtypen, Invarianten,
  Repositories, Actions, Formulare und benachbarte Tests. Nicht jedes Modul
  hat jede dieser Dateien. `index.ts` bündelt Exporte; direkte Modulimporte
  kommen ebenfalls vor.
- [app/src/lib/pb.ts](../app/src/lib/pb.ts) bündelt `fetch`, generisches
  Superuser-CRUD, Multipart-Dateien und Firmendaten. Der
  Superuser-Token gehört zum serverseitigen Instanzkontext. Self-Hosting liest
  `PB_URL`; der generische Cloud-Adapter ist nach v1.0.0 implementiert.
  Siehe [Instanzkontext](instance-context.md).
- [app/src/lib/finanz-transaktion.ts](../app/src/lib/finanz-transaktion.ts)
  ruft die festen internen PocketBase-Operationen für Belege, Rechnungen,
  Kassenbuch und RC-Korrekturen auf.
  Bei unbekanntem Commit-Ausgang wird höchstens einmal mit derselben Quelle,
  derselben erwarteten Projektion und, bei Rechnungen, denselben PDF-Bytes
  wiederholt.
- [components/app-shell.tsx](../app/src/components/app-shell.tsx), Sidebar,
  Navigation und `components/ui/` bilden die gemeinsame Oberfläche.
  [globals.css](../app/src/app/globals.css) hält die Design-Tokens.
  Theme, Navigationsgruppen und Favoriten nutzen localStorage.
  Die App-Marke unter `public/brand/` ist unabhängig vom Firmenlogo auf PDFs.

Eine eigene öffentliche Fach-REST-API gibt es nicht. Caddy reserviert `/api/*`
für PocketBase. App-Downloads liegen unter `/app/...`, beispielsweise
`/app/export/journal-csv`, `/app/ust/elster-xml`, `/app/zm/csv` und die
PDF-/Datei-Routen an Dokumenten. Neue App-Endpunkte müssen diese Proxy-Grenze beachten.

## Fachmodule und Datenmodell

Das Schema liegt in den 34 JavaScript-Migrationen unter
[pocketbase/pb_migrations/](../pocketbase/pb_migrations/), zuletzt
`1730003000_positionsbeschreibung.js`. Die Finanzoperation und Record-Guards
liegen unter [pocketbase/pb_hooks/](../pocketbase/pb_hooks/).
Die folgenden Collections und Beziehungen ergänzen die Routenkarte im
vorhandenen Testphase-Skill:

| Bereich und Modul | Collections und Kopplung |
|---|---|
| Organisation, `platform` | `users`, `firmen`, `mitgliedschaften`. Mitgliedschaft verbindet Nutzer:in und Firma mit `eigentuemer`, `bearbeiten` oder `lesen`. `users.role` ist die Instanzrolle, `users.firma` die zuletzt aktive Firma. |
| Stammdaten, `contacts`, `catalog`, `categories` | `kontakte`, separate `ansprechpartner`, `katalog_positionen`, `kategorien`. Kontakte können Kund:in und Lieferant:in sein; Kategorien tragen seit TP-018 eine Richtung. |
| Arbeit, `projects`, `time`, `travel` | `projekte`, `zeiteintraege`, `fahrten`. Kund:in erforderlich, Projekt bei Zeiten/Fahrten optional. Übernahme erzeugt einen Rechnungsentwurf und verknüpft die abgerechneten Einträge. |
| Verkauf, `sales` | `angebote`/`angebotspositionen`, `rechnungen`/`rechnungspositionen`, `wiederkehrende_rechnungen`/`wiederkehrende_rechnungspositionen`. Dokumente halten Beträge und Steuer-Modus; Positionen sind separate Records. |
| Buchungen, `journal` | `buchungsjournal` mit laufender Nummer pro Firma, Richtung, Beträgen, `quelle_typ`, `quelle_id`, Kontakt und `storno_von`. Quell-ID ist Text; Storno ist eine Relation zum Original. |
| Nachweise, `expenses` | `belege` mit Dateiliste, Kategorie als Text, optionalem Lieferanten oder Kunden und Journal-Verweis. UI „Bezeichnung“ bleibt technisch `notiz`. |
| Zufluss, `payments` | `zahlungen` an Rechnungen; erzeugt Zahlungsjournal und leitet offenen Betrag und Rechnungsstatus ab. |
| Bargeld, `cash` | `kassenbuch_eintraege` mit Journal-Verweis und Stornorelation. Eine Kasse je Firma, Saldo aus chronologischen Einträgen; kein automatischer Eintrag aus Barzahlung einer Rechnung. |
| Bank, `banking` | `bankkonten`, `bank_import_laeufe`, `bank_bewegungen`. CSV/MT940 teilen Persistenz und SHA-256-Idempotenz. Bestätigter Eingangsmatch erzeugt eine Zahlung an eine Rechnung. |
| E-Rechnung, `einvoice` | `e_rechnungen_empfang` hält Original, Parse-DTO und optionalen Beleg-Verweis. `e_rechnungen_versand` hält XML je Rechnung und Profil, durch Unique-Index abgesichert. |
| Bestätigungen, `ustid` | `ust_id_pruefungen` speichert BZSt-Anfrage und Antwort als Schnappschuss; kein dauerhaftes Gültigkeitsflag am Kontakt. |
| Hintergrundarbeit, `jobs` | `job_locks` ist global, `job_runs` hat einen optionalen Firmenbezug. Scheduler erzeugt Entwürfe über `sales`; Mail verwendet bestehende Dokumentdateien. |
| Auswertungen, `reporting` | Keine eigenen Finanz-Collections. EÜR/BWA/USt/ZM/Übersicht und Exporte lesen Journal plus Stammdaten und Quellen für die Zuordnung. |
| Suche, `search` | Filtert Kontakte, Rechnungen, Belege und Angebote über deren Repositories; kein Suchindex. |
| `documents` | Nur ein verbliebenes Skelett. PDF und Dateiablage sind bereits in `sales`, `expenses`, `einvoice` und `lib/pb.ts` umgesetzt. |

Fachdaten tragen `firma`; Listen filtern mit `session.firmaId`, Detailzugriffe
prüfen die Firmen-ID nach dem Laden. Da Next mit Superuser-Rechten zugreift,
ersetzt eine PB-Relation diese fachliche Prüfung nicht. Geld, Mengen und Kilometer
liegen überwiegend als Dezimaltext vor, Zeitdauern als Minuten. Nummernkreise
liegen als JSON an der Firma. Unique-Indizes sichern unter anderem Nummern je
Firma, Bankimport-Hashes und Mitgliedschaften ab.

## Empfindliche Abläufe und Konventionen

Auth beginnt mit PocketBase-Passwortlogin. Next stellt anschließend einen
eigenen HS256-JWT im httpOnly-Cookie `zettelruhe_session` aus, Laufzeit 14 Tage,
`SameSite=Lax`, `Secure` bei HTTPS-`APP_URL`.
[proxy.ts](../app/src/proxy.ts) prüft den Eingang und den Token vor `/app`;
[lib/session.ts](../app/src/lib/session.ts) löst die aktuelle Mitgliedschaft auf.
Schreib-, Verwaltungs- und Instanzeigentümer-Gates sind getrennt. Passwortwechsel
verwendet nur die eigene Session und lässt bestehende Next-Sessions gültig.

Formulare schicken `FormData`. Actions parsen und prüfen Session/Rechte,
Repositories übernehmen I/O und fachliche Guards, `invariants.ts` enthält
vorwiegend reine Validierung. Es gibt kein Zod oder React Hook Form.
Erfolgs-Redirects liegen normalerweise nach `try/catch`; `redirect()` wirft
intern und darf nicht als gewöhnlicher Fehler verschluckt werden.
`revalidatePath` und Query-Parameter wie `created`, `saved`, `error` steuern
Navigation und den gemeinsamen Flash-Toast. Positionsfelder werden über
indexgleiche `FormData.getAll()`-Listen übertragen.

Fachtexte folgen dem Glossar und `lib/labels.ts`. Geldrechnen erfolgt über
[lib/money.ts](../app/src/lib/money.ts) mit Decimal und kaufmännischer Rundung.
Anzeige ist de-DE, fachliche Datumsgrenzen verwenden `Europe/Berlin`, Zeitpunkte
UTC/ISO. PocketBase-Felder `created`/`updated` nicht als überall vorhanden
annehmen; bestehende Migrationen legen sie nur teilweise an.

Angebote erhalten beim fachlichen Senden Nummer und PDF, ohne Journal.
SMTP-Versand ist eine eigene Aktion. Angenommene Angebote werden zu
Rechnungsentwürfen. Anlage, vollständiger Positionsersatz und Löschen eines
Rechnungsentwurfs laufen seit TP-022 gemeinsam in PocketBase. Die
Rechnungsfestschreibung bindet Kopf, vollständige Positionen und PDF-relevante
Stammdaten an eine erwartete Projektion und erzeugt in einer Transaktion Nummer,
PDF, Forderungsjournal, Rückverweis, Zeitpunkt, Status `offen` und den
Zählerfortschritt. Vorschau-PDFs sind flüchtig und verbrauchen keine Nummer. Das
gespeicherte Original wird danach weiter ausgeliefert. Replay verändert weder
Original noch einen späteren zulässigen Endstatus.

Zahlungen erzeugen zusätzlich Journalzeilen `quelle_typ=zahlung`, anteilig je
Steuerstaffel. Auswertungen zählen diese Zuflüsse und schließen die
Forderungsbuchung aus. Storno mindert die ursprüngliche Kategorie, auch bei
einem Original außerhalb des Auswertungszeitraums. Journal-CSV enthält beide
Quellen vollständig. Deshalb Änderungen an `sales`, `payments`, `journal`
und `reporting` zusammen betrachten, insbesondere dynamische gegenseitige Importe.
Seit der Releasekorrektur vom 2026-09-10 verbinden feste PB-Operationen
Zahlungsanlage, alle Steuerstaffel-Journale und Status in einer Transaktion.
Löschen verbindet Gegenbuchungen, Freigabe einer Bankbewegung, Löschen und Status.
Bankmatching bindet Zahlung und Bewegungszuordnung; Rechnungsstorno bindet
Forderungs-/Zahlungsgegenbuchungen und Status. Die Firmen-Schreibsperre wird vor
der Zustandsprüfung erworben. CRUD-Bypässe für diese Finanzzustände sind gesperrt.
Ein separates Gutschrift-/Stornorechnungsdokument wird weiterhin nicht erzeugt.

Eine serverseitig erzeugte Vorgangs-ID bleibt beim erneuten Absenden desselben
Zahlungsformulars erhalten. Verlorene Antworten werden mit derselben ID
wiederholt; gelöschte Zahlungen bleiben über ihr Journal gegen erneute Anlage
geschützt. Ein neu geöffnetes Formular ist ein neuer Vorgang. Eine Bankbewegung
wird weiterhin nur einer Rechnung zugeordnet; Teilzuordnung verteilt keinen
Rest automatisch. Alte Teiljournale mit abweichender Bruttosumme werden mit
`INCONSISTENT_STATE` abgewiesen, nicht automatisch repariert.

`pocketbase/pb_hooks/finanz.js` verwendet generierte Kopien der bestehenden
TypeScript-Geld-, Journal-, Zahlungs-, Verkaufs- und Wiederkehrregeln unter
`pb_hooks/domain/`. Nach Regeländerungen `node scripts/build-finanz-domain-hook.mjs`
ausführen und die Ausgabe mit aufnehmen; `--check` vergleicht ohne Schreiben.
Der RC-Generator `scripts/build-rc-hook.mjs` bleibt zusätzlich erforderlich.

Der Scheduler verhindert überlappende Ticks je Prozess. Jeder Tick hat eine
eigene Holder-ID; Lockübernahme und bedingte Freigabe sind atomare PB-Operationen.
Die Lease läuft nach fünf Minuten ab, ohne Heartbeat. Lang laufende Ticks können
prozessübergreifend überlappen; Vorlage und Fälligkeitsdatum werden deshalb vor
Entwurfsanlage im selben Commit geprüft und fortgeschrieben. Firmen (Seiten à 50)
und fällige Vorlagen (à 200) werden vollständig gelesen. Pro Vorlage bleiben
höchstens zwölf Nachholperioden je Aufruf; weitere folgen im nächsten Tick.
Vorlagenbearbeitung während der Erzeugung ist kein abgenommener Snapshot-Vertrag.
[Fehlernachweise und Grenzen](issues/release-abnahme-2026-09-10.md).

Belege sind bis zur Festschreibung editierbar. Die Belegstufe von TP-022 vergibt
Belegnummer und Journalnummer, legt das Journal an und schließt den Beleg in einer
PocketBase-Datenbanktransaktion ab. Entwurfsänderungen, Löschen und Dateiänderungen
verwenden dieselbe Persistenzgrenze. Danach sperren Record-Hooks Dateien,
Metadaten und Journalquelle auch gegen veraltete Superuser-CRUD-Requests.
Dateien liegen in PocketBase. Bis zu zehn PDF-/Bilddateien sind erlaubt,
jeweils maximal 15 MiB; der Server-Action-Request ist insgesamt auf 16 MB begrenzt.
Der Browser versucht Fotos auf JPEG mit maximal 2000 Pixel Kantenlänge und
Qualität 0,82 zu verkleinern. Bei Fehlern oder größerem Ergebnis bleibt das
Original; PDFs bleiben unverändert. Das ist keine OCR.

E-Rechnungsempfang parst UBL/CII oder XML-Anhänge aus PDF, einschließlich Flate,
hinter `ParsedEInvoice`. Auch bei Parse-Fehler wird ein zulässiges Original
archiviert. Ein Scan-PDF liefert keine automatisch erkannten Beträge.
Belegvorausfüllung nutzt `expenses`; Empfang allein schreibt kein Journal.
Versand erzeugt separat archivierte UBL-/CII-XML-Dateien aus Rechnung und
aktuellen Firmen-/Kontakt-/Bankstammdaten. Eigene Pflichtfeldprüfung und
Parser-Roundtrip ersetzen keinen externen Konformitätstest. Grenzen stehen in
ADRs 0015, 0022, 0026 und 0029.

## Reverse Charge: technische Ergänzungen seit 2026-09-08

- `expenses/reverse-charge.ts` hält `RcInput`, `RcSnapshot`, Berechnung und
  `RC_PUBLIC_ENABLED=true`. `scripts/build-rc-hook.mjs` erzeugt daraus den
  PB-Kern. `node scripts/build-rc-hook.mjs --check` prüft Generat, Decimal und Lizenz.
- Migration `1730002800_reverse_charge.js` ergänzt RC-Daten an Belegen und Journal;
  `1730002900_kontakt_ausgabensteuerstandard.js` den Vorschlag am Kontakt.
  Altbelege werden nicht aus 0 % oder Auslandsland nachklassifiziert.
- `expenses/beleg-form-input.ts`, `rc-fields.tsx` und `rc-details.tsx` bilden
  Erfassung und Vorschau. Seit `961d06d` werden Zahlbetrag, Buchungsdatum und
  mehrere Vertragsangaben automatisch übernommen; die genaue Bedienung und
  Abweichungen vom ursprünglichen Plan stehen in der RC-Referenz.
  `rc-details.tsx` bildet die reine Anzeige der Zahllast-Differenz derzeit mit
  `Number` und `toFixed`; der gespeicherte RC-Rechenkern verwendet Decimal.
  Diese Abweichung von der allgemeinen Geldrechenregel wurde hier nicht geändert.
- `reporting/repository.ts:listUstJournalInZeitraum` vereinigt Buchungs- und
  RC-Steuerperioden nach Journal-ID. UStVA verwendet gespeicherte Schnappschüsse;
  Geldberichte bleiben am Buchungsdatum. DATEV light lehnt RC-Zeiträume ab.
- `src/lib/rc-transaktion.integration.test.ts` ergänzt die Finanzintegration.
  Der isolierte Starter prüft echte PB-Hooks mit aktivem RC-Kern. `--rc-kern`
  wird heute nur noch als historisches Argument akzeptiert und entfernt. Frühere Läufe mit geschlossener Sperre sind historische Ergebnisse.
  `scripts/test-rc-ui-isolated.mjs` stellt einen temporären UI-Testbestand bereit.

Die öffentliche Freigabe `6d4de5b`, TP-025 `db07838` und Formularvereinfachung
`961d06d` bauen auf den drei RC-Abschnitten auf. Testzahlen und Browsernachweise
stehen in [RC-Umsetzung](reverse-charge-umsetzung.md) und [Testphase](testphase.md).

## Sicher prüfen, entwickeln und betreiben

Die npm-Kommandos laufen in `app/`, nicht im Repository-Root:

```bash
cd app
npm test
./node_modules/.bin/vitest run src/modules/expenses
npm run typecheck
npm run lint -- --max-warnings=0
npm run build
```

`npm run test:watch` ist interaktiv. Für Änderungen betroffene Tests auswählen;
vor Abschluss fachlicher Änderungen die gesamte Suite gemäß Arbeitsauftrag
prüfen. Tests liegen unter `src/**/*.test.ts` und laufen in der Node-Umgebung.
Die bestehenden Repository-Tests prüfen überwiegend reine Helfer und Guards,
keine echte PB-Persistenz. TP-022 ergänzt historische Charakterisierung in
`src/lib/festschreibung.integration.test.ts` sowie die grünen Abnahmen in
`src/lib/beleg-transaktion.integration.test.ts`,
`src/lib/rechnung-transaktion.integration.test.ts` und
`src/lib/kasse-transaktion.integration.test.ts`. `node
scripts/test-festschreibung-isolated.mjs` vom Projekt-Root startet dafür eine
eigene PB 0.39.10 mit leerem tmpfs, echten Produktionshooks und ausschließlich
testlokalen Fehlerinjektionshooks. Ohne den Starter überspringt `npm test` diese
Integrationstests. [Abnahmebericht Belegstufe](issues/tp-022-belegstufe-2026-09-06.md),
[Abnahmebericht Rechnungsstufe](issues/tp-022-rechnungsstufe-2026-09-06.md),
[Abnahmebericht Kassenstufe](issues/tp-022-kassenstufe-2026-09-07.md).
Der separate lokale HTTP-Regressionstest
`./scripts/test-pocketbase-isolation.sh` prüft seit TP-020 PocketBase und
Next gegen die zwei Testfirmen, einschließlich temporärer Schreibzugriffe.
Voraussetzungen und Backup stehen im [Prüfbericht](issues/pocketbase-firmenisolation-2026-09-05.md).
`src/lib/release-risiken.integration.test.ts` ergänzt echte Fehler-, Replay- und
Parallelitätsfälle für wiederkehrende Rechnungen, Zahlung, Bank und Storno.
Der Starter führt sie zusammen mit den bestehenden Finanz-/RC-Tests aus.
Automatisierte Browser-End-to-End-Tests sind nicht in der CI enthalten.

Für eine vollständig isolierte Installations-/Restoreprüfung vom Root:

```sh
docker build -t zettelruhe-release-pb:20260910 pocketbase
docker build -t zettelruhe-release-next:20260910 app
node scripts/test-release-smoke-isolated.mjs
```

Der Smoke erzeugt eigene zufällig benannte Netzwerke/Volumes und Zugangsdaten,
verwendet Loopbackports 43127/43128 und dynamische PB-Ports. Er liest keine `.env`
und keine vorhandenen Backups. Der Upgradebestand wird mit den Hooks/Migrationen
aus `f48be21` synthetisch erstellt, offline archiviert und separat wiederhergestellt.
Daten und Dateihash müssen gleich bleiben. `--keep` hält eigene Ressourcen bis zu
60 Minuten für Browserprüfungen; SIGTERM räumt sie auf.
`node scripts/seed-release-browser.mjs <Pfad-zum-session.json>` ergänzt ausschließlich
diesen temporären Bestand. Für den Finanzstarter lässt sich das Image ebenfalls
mit `TP022_PB_IMAGE=zettelruhe-release-pb:20260910` wählen; ohne diese Variable
verwendet er historisch `zettelruhe-pocketbase:latest`. Das Manifest enthält kurzlebige Zugangsdaten (Modus
0600); nicht veröffentlichen. Andere Image-Namen über `RELEASE_PB_IMAGE` und
`RELEASE_NEXT_IMAGE` setzen. Kein Nachweis für echte Altbestände, ARM-Nativbetrieb,
Caddy/TLS oder einen Produktionsrollout.

Bei vorhandenem `node_modules` ist keine Installation für die Prüfungen nötig.
Bei einem neuen Checkout bindet `npm ci` das vorhandene Lockfile ein, wie im
Dockerfile. Die Erstinstallation ist ein eigener Umgebungsschritt. Entwicklung
startet mit `npm run dev`; `npm run start` führt `next start` aus.

Vor Start oder Browserprüfung den Datenbestand festlegen:

- `instrumentation.ts` startet den Scheduler auch im Entwicklungsserver.
  Erster Tick nach 30 Sekunden, danach standardmäßig alle 15 Minuten.
  `JOBS_DISABLED=true` verhindert den Schedulerstart.
- Das geschützte App-Layout ruft unabhängig davon
  `nachziehenZahlungsjournaleEinmal` auf. Auch ein GET mit Lesemitgliedschaft
  kann fehlende Zahlungsjournale schreiben. Die Rechnungsdetailseite kann den
  Zahlungsstatus beim Lesen aktualisieren. `JOBS_DISABLED` verhindert diese
  Pfade nicht. Für solche Tests einen getrennten Testbestand verwenden.
- Compose-Start führt Migrationen aus; der PB-Entrypoint versucht außerdem
  `superuser upsert`. Migrationen können vorhandene Daten verändern.
- `zettelruhe_pb_data` ist im Compose fest benannt. Ein anderer Compose-Projektname
  allein isoliert das Datenvolume nicht. Bei einem Zwei-Instanzen-Test auch
  Volume, Ports, URLs und Secrets getrennt festlegen.

Konfigurationsquellen sind [.env.example](../.env.example),
[next.config.ts](../app/next.config.ts) und [Betrieb](betrieb.md).
Compose liest Root-`.env`; lokale Next-Entwicklung nutzt beispielsweise
`app/.env.local`. `PB_URL`, `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD` und
`SESSION_SECRET` gehören auf den Server. `APP_URL` steuert Links und Cookie
und wird für Server-Action-Origins bereits beim Build benötigt.
Optional sind `SMTP_HOST/PORT/USER/PASSWORD/FROM`, `EVATR_URL`,
`JOB_TICK_INTERVAL_MS`, `JOBS_DISABLED` und lokal `CADDY_HTTP_PORT`.
Geheimniswerte gehören weder in Dokumentation noch Testlogs.

[app/Dockerfile](../app/Dockerfile) baut mit Node 22 auf Alpine und startet den
Standalone-Output als unprivilegierter Nutzer über `node server.js`.
[pocketbase/Dockerfile](../pocketbase/Dockerfile) lädt Version 0.39.10,
fest für `linux_amd64`. Lokal nutzt Compose Caddy 2.10 auf HTTP; Next-Port 3000
ist zusätzlich veröffentlicht. Der Server-Overlay bindet Next/PB an Loopback,
während Host-Caddy TLS terminiert. Details und Startbefehle bleiben in
`docs/betrieb.md`; hier wird kein zweiter Deployment-Ablauf gepflegt.

Schemaänderungen bekommen eine neue Migration mit der nächsten Nummer im
vorhandenen Schema. Bereits angewendete Migrationen nicht für einen neuen
Effekt umschreiben. Vor Ausführung Backup und Zielbestand prüfen. Down-Funktionen
sind teilweise destruktiv, teilweise absichtlich leer; ein Downgrade ersetzt
keinen Restore. Die 30 vorhandenen Migrationen wurden beim Onboarding nicht ausgeführt.

## Befunde aus der Bestandsaufnahme

Die Tabelle trennt behobene Befunde und offene Grenzen. Lokale Fehlernachweise
belegen keine Betroffenheit produktiver Daten.

| Priorität | Befund und Beleg | Konsequenz für Folgearbeit |
|---|---|---|
| Hoch, lokal behoben (TP-020) | PB 0.39.10 erlaubte gewöhnlichen Nutzern direkten firmenübergreifenden Lesezugriff auf 27 Fachcollections; alle sieben Dateifelder waren auch anonym abrufbar. Direkte Writes waren bereits gesperrt. | Neue Migration `1730002700_direkte_api_absichern.js` sperrt direkte Fachzugriffe und schützt Dateien. Next holt Dateitokens serverseitig. 1303 HTTP-Prüfungen einschließlich erlaubter Next-Abläufe bestanden. [Befund und Reproduktion](issues/pocketbase-firmenisolation-2026-09-05.md). Entfernte Instanzen nicht geprüft oder aktualisiert. |
| Hoch, abgeschlossen (TP-021) | Fehler bestätigt, geprüfter Bestand nicht betroffen, keine Korrekturmigration erforderlich. `1730002600_belege_kunde.js` kann Kontakte festgeschriebener Einnahmen ändern und beim Leeren vom Journal abweichen. | Zwei lokale Offline-Backups geprüft: je vier Ausgaben, keine Einnahmen, keine Beleg-/Journalabweichung. Abschluss auf Basis der Analyse und Bestätigung des Betreibers für seine relevante Produktivinstallation. Keine Datenkorrektur; Originalmigration unverändert. Regressionstests und Read-only-Audit bleiben erhalten. [Befund, Datenbilanz und Prüfgrenzen](issues/belege-kunde-migration-2026-09-05.md). |
| Hoch, abgeschlossen (TP-022, Beleg) | Die historische Charakterisierung reproduziert Teilzustände, Replay- und Nebenläufigkeitsfehler der früheren getrennten Requests. | Belegnummer, ursprüngliches Journal und Belegabschluss committen nun gemeinsam in PB 0.39.10. Replay, Fehlergrenzen, konkurrierende Abschlüsse, Entwurfswrites, Nummernkreiswriter, Firmenisolation und Dateischutz sind mit 29 echten Hook-Tests abgenommen. Der aktuelle Stand läuft bestätigt lokal, auf dem Test-VPS und auf dem Produktions-VPS. [Abnahmebericht](issues/tp-022-belegstufe-2026-09-06.md). |
| Hoch, abgeschlossen (TP-022, Rechnung) | Rechnungsentwurf, Nummernvergabe, Forderungsjournal, PDF und Abschluss bestanden zuvor aus getrennten Requests ohne gemeinsame Source-Projektion. | Entwurfswrites und Abschluss committen nun über feste PB-Operationen. Kopf, vollständige Positionen, Stammdatenprojektion, PDF, Nummer, Journal, Rückverweis, Zeitpunkt, Status und Zähler sind gebunden; Replay, Source-Races und direkte Superuser-Bypässe sind abgenommen. Zahlungen und Rechnungsstorno waren außerhalb dieser TP-022-Stufe; die lokale Releasekorrektur TP-028 ergänzt sie. Der aktuelle Stand läuft bestätigt lokal, auf dem Test-VPS und auf dem Produktions-VPS. [Abnahmebericht](issues/tp-022-rechnungsstufe-2026-09-06.md). |
| Hoch, abgeschlossen (TP-022, Kasse) | Kassenanlage, Journal, Rückverweis und Nummernkreis sowie Kassenstorno liefen zuvor über getrennte Requests; der Saldo wurde außerhalb der Write-Transaktion geprüft. | Anlage und Storno laufen nun über feste PB-Operationen. Nummer, Kassenrecord, Journal, Rückverweis, Zeitpunkt und Zähler sind gebunden; Firmenwrites serialisieren die transaktionale Saldoentscheidung. Replay, alle Write-Grenzen, konkurrierende Auszahlungen, Source-Races, Firmen-/Rollenprüfung und direkte Superuser-Bypässe sind mit 27 echten Hook-Tests abgenommen. Beide historischen Kassenfehler sind grün. Der aktuelle Stand läuft bestätigt lokal, auf dem Test-VPS und auf dem Produktions-VPS. [Abnahmebericht](issues/tp-022-kassenstufe-2026-09-07.md). |
| Mittel, abgeschlossen (TP-023) | `einvoice/actions.ts`, `createBelegFromERechnungAction`, führte den Erfolgs-Redirect im `try/catch` aus. Der Bankimport hatte ihn bereits ausgelagert. | M1-15 ist auch im E-Rechnungs-Belegpfad behoben. Ein Regressionstest trennt erfolgreichen Redirect und echten Repository-Fehler. Lokal, Test-VPS und Produktions-VPS grün; produktiv läuft Commit `003c2d8`. |
| Mittel, lokal behoben (TP-024) | `reporting/repository.ts` begrenzte Journal-Läufe auf 10.000 Zeilen und Belegarchive auf 5.000 Belege. Downloadfehler einzelner Belegdateien wurden abgefangen und übersprungen. ZIP entsteht vollständig im Speicher. | Journal- und Belegleser durchlaufen jetzt alle von PocketBase gemeldeten Seiten und brechen bei geänderter Seitenmetadatenlage, falscher Gesamtzahl oder doppelten IDs verständlich ab. Eine fehlende referenzierte Belegdatei verhindert das gesamte Archiv. Die aktuelle In-Memory-Erzeugung akzeptiert höchstens 256 MiB summierte Dateinutzlast und fordert bei Überschreitung einen kleineren Zeitraum; echtes ZIP-Streaming bleibt eine spätere Optimierung. |
| Hoch, lokal behoben (TP-028) | Lockübernahme, wiederkehrende Erzeugung, Zahlungen, Bankmatching und Rechnungsstorno versagen unter reproduzierten Fehler-/Parallelfällen. | Feste PB-Operationen, vollständige Jobpagination und 195 echte Finanz-/RC-Tests grün. [Releaseabnahme](issues/release-abnahme-2026-09-10.md). Kein Produktionsupdate. |
| Wartung, historischer Prüfbefund | Beim Onboarding scheiterte Gesamt-Lint, der isolierte Build am Google-Fonts-Abruf. Next meldete `middleware` als veraltet. Spätere dokumentierte Docker-Builds bestanden. | Die damaligen Ergebnisse stehen unten; die spätere Releasevorbereitung am 2026-09-10 hat Lint und Produktionsbuild erfolgreich wiederholt. Vite-Konfigurations-, Next-Middleware-Hinweis und Google-Fonts-Buildabhängigkeit bleiben dokumentiert. |

Dokumentation und Code weichen außerdem an diesen Stellen ab:

- M1-/M2-Checklisten, frühe Sessions und Teile von `90-status.md` sagen
  „Zahlung erzeugt kein Journal“. Aktuell gilt ADR-0024 samt Zahlungsjournal.
  Frühere Aussagen „kein Einladen/keine Rollen“ sind durch ADR-0025 abgelöst.
- ADR-0020 beschreibt noch Kontakte ohne USt-Id-Feld; ADR-0021 und der Code
  ergänzen es. ADR-0026 nennt als damaligen Nachteil einen einfachen PDF-Byte-Scan;
  ADR-0029 ergänzt den Empfang komprimierter Anhänge. Die Entscheidung gegen
  Hybrid-Erzeugung bleibt bestehen.
- Die früher als vorhanden lesbaren Roadmap-Ziele Rabatte, eigene Gutschrift-/
  Stornodokumente, Dokumentlisten-CSV, Belegmatching und amtlicher EÜR-Kategorienplan
  stehen seit dem Abgleich vom 2026-09-10 gesondert als offene Ziele in der Roadmap.
- Session-TTL und Healthcheck-Grenzen sind in `betrieb.md` korrigiert. Die Session
  misst keine Aktivität; `/health` liefert auch bei `ok:false` HTTP 200.
- `app/README.md` wurde zur Releasevorbereitung durch einen kurzen App-Einstieg
  ersetzt. Maßgeblich bleiben Root-README, diese Übersicht und Betrieb. Die lokale Aufwandsschätzung
  vom 15.08. ist historisch, ebenso frühere Testzahlen. TP-015 stellt die
  Standard-Kennzahlen von Übersicht/EÜR/Auswertungen auf Kalenderjahr um;
  USt/ZM/Export bleiben standardmäßig beim Monat.

## Verifikation am 2026-09-05

Verwendet wurden die bereits installierten Abhängigkeiten unter Node 25.9.0
und npm 11.12.1. Der Container verwendet Node 22; Containerparität wurde nicht getestet.

| Prüfung | Ergebnis |
|---|---|
| `cd app && npm test` | 50 Testdateien, 589 Tests bestanden. Vite warnt zur zukünftigen nativen Konfigurationsladung. |
| `cd app && ./node_modules/.bin/tsc --noEmit --incremental false` | Bestanden. Nutzt auch bereits vorhandene generierte Next-Typen. |
| `cd app && npm run lint` | 3 Fehler, 6 Warnungen. Fehler: `prefer-const` in `einvoice/mapping.ts:22` und `einvoice/parse-pdf-xml.ts:185`; `react-hooks/immutability` in `reporting/uebersicht-kategorien.tsx:190`. Warnungen in Jobs, `platform/firma-write.ts` und `sales/pdf.tsx`. |
| `npm run build` in separater temporärer App-Kopie | Fehlgeschlagen beim Abruf von Geist/Geist Mono von Google Fonts. Originalquellen und vorhandene Abhängigkeiten kopiert, keine echten ENV-Dateien, Scheduler deaktiviert, kein erreichbarer PB-Zielbestand. Zusätzlich Next-Warnung zu `middleware`. Kein erfolgreicher Produktionsbuild behauptet. |
| Datenbank, Compose, Browser, SMTP, BZSt, Deployment, Restore | Nicht ausgeführt. Bestehende Datenbestände und Infrastruktur blieben unangetastet. |

Das Onboarding ergänzt nur Root-`AGENTS.md`, diese gemeinsame Übersicht und
Einstiegsverweise in den READMEs. Bestehende Skills, Framework-Regeldateien,
Quellcode, Lockfile, Migrationen und Betriebsdateien bleiben unverändert.

## Nachtest TP-020 am 2026-09-05

Die direkte PocketBase-Isolation wurde in der ausdrücklich freigegebenen lokalen
Docker-Installation mit zwei Testfirmen geprüft und korrigiert. Alle 30 bisherigen
Migrationen waren angewendet und bytegleich zum Repository. Migration 31 sperrt
27 Fachcollections für direkte Nutzertokens und schützt sieben Dateifelder.
Auth und Eigenzugriff auf `users` bleiben möglich. Der zentrale Next-Dateihelfer
holt den benötigten Dateitoken serverseitig; Next prüft weiterhin Firma und Rolle.

`./scripts/test-pocketbase-isolation.sh`: 1303/1303 HTTP-Prüfungen bestanden,
einschließlich Login, erlaubtem/verbotenem Firmenwechsel, Multipart-Upload,
Lese-/Schreibrollen und aller bestehenden Datei-Downloadarten. `npm test`:
51 Testdateien, 591 Tests bestanden. Typecheck und ESLint der geänderten
App-Dateien bestanden. Gesamt-Lint unverändert mit den oben genannten drei
Fehlern und sechs Warnungen. `docker compose build pocketbase next` bestand
mit den vorhandenen Lockfile-Abhängigkeiten. Die neuen lokalen Images laufen;
die Migration ist angewendet. Kein Commit, Push oder entferntes Deployment.

Vollständige Volume-Backups vor und nach der Änderung sowie eine separate
`.env`-Sicherung liegen lokal unter dem ignorierten `/backups/`. 21 synthetische
Records im finalen Lauf wurden anschließend entfernt. Die 26 Fach-/Nutzercollections
und alle 38 vorhandenen Speicherdateien waren im Backupvergleich unverändert.
Nur Scheduler-Protokolle und Lock änderten sich. Details, Rechte-Matrix,
Reproduktionskommando und Grenzen stehen im
[Prüfbericht](issues/pocketbase-firmenisolation-2026-09-05.md).

TP-009 bleibt eine spätere Produktentscheidung. M1-15 ist mit TP-023 lokal,
auf dem Test-VPS und auf dem Produktions-VPS behoben. Die lokale Abnahme umfasst
den neuen Regressionstest mit zwei Fällen, 633 bestandene Tests, 141 ohne sicheren
PocketBase-Starter übersprungene Tests, Typecheck und gezielten ESLint. Auf dem
Produktions-VPS bestanden der Regressionstest mit 2/2 Fällen, Typecheck,
Produktionsbuild sowie die direkten und über HTTPS ausgeführten Healthchecks.
Produktiv läuft Commit `003c2d8`; gegenüber dem getesteten Implementierungscommit
`cee84a4` kamen nur zwei Session-Dokumente hinzu.

TP-024 behebt lokal den gemeinsamen Export-Schnitt für Journal- und Belegdaten.
Die früheren Grenzen von 10.000 Journalzeilen und 5.000 Belegen entfallen.
PocketBase-Seiten werden vollständig und mit Konsistenzprüfungen gelesen;
fehlende referenzierte Dateien und eine Dateinutzlast über 256 MiB lassen den
Belegarchiv-Export ohne Teilarchiv verständlich scheitern. Echtes ZIP-Streaming
ist nicht Bestandteil der Korrektur. Die lokale Abnahme umfasst 22/22 gezielte
Tests, 645 bestandene Tests der Gesamtsuite, 141 ohne sicheren PocketBase-Starter
übersprungene Tests, Typecheck und gezielten ESLint.


## Erneute Prüfung für die Releaseplanung am 2026-09-10

`npm test`: 731 Tests bestanden, 145 übersprungen; fünf Integrationsdateien ohne
PB-Starter übersprungen. Typecheck ohne Emit bestanden. `npm run lint`: zwei
Fehler und sechs Warnungen. Noch offen sind `prefer-const` in
`einvoice/parse-pdf-xml.ts:185` und `react-hooks/immutability` in
`reporting/uebersicht-kategorien.tsx:190`; der frühere Fehler in `mapping.ts`
tritt nicht mehr auf. Warnungen betreffen Jobs, `platform/firma-write.ts` und
`sales/pdf.tsx`. Kein neuer Build, Browserlauf oder PB-Integrationstest in dieser
Planungsrunde. Einordnung und Releasefolge: [Release- und Cloud-Plan](release-und-cloud-plan.md).

## Releaseverifikation am 2026-09-10

739 Unit-Tests, Typecheck, warnungsfreies Lint, beide Generatorabgleiche,
195 echte Finanz-/RC-Integrationstests, Produktionsbuild und synthetische
Installation/Upgrade/Restore bestanden. Diagramme, Zahlungen, Bankmatch und RC
gezielt im Browser geprüft. [Umgebung, Images, Fehlerfälle und offene Grenzen](issues/release-abnahme-2026-09-10.md).
Dies ist eine lokale Abnahme des Arbeitsbaums ab `f48be21`, kein Deployment.


## Positionsbeschreibung, TP-031, 2026-09-11

`RechnungspositionInput`, `AngebotspositionInput` und gespeicherte Positionstypen
führen `description?: string`. Beide Formulare übertragen indexgleich
`position_description` über `FormData.getAll()`. Die gemeinsame Validierung
trimmt die äußeren Leerzeichen, erhält Zeilenumbrüche und begrenzt auf 2000 Zeichen.
Fehlende Werte werden als leerer String normalisiert, auch zum Leeren beim Editieren.
Keine Zod-Abhängigkeit. Katalogauswahl ergänzt keine Beschreibung und erhält
bereits manuell eingetragene Details.

Migration `1730003000_positionsbeschreibung.js` ergänzt nur
`rechnungspositionen` und `angebotspositionen`. `sales/repository.ts` übernimmt
das Feld in Reads, Writes, Normalisierungsprüfung, Festschreibungsprojektion
und Angebot → Rechnung. `pb_hooks/finanz.js` muss dieselbe Projektion verwenden;
die generierten Verkaufsregeln sind mit aktualisiert. App, Migration und Hooks
gehören deshalb in dasselbe Update. Artikel und wiederkehrende Vorlagen erhalten
kein neues Stammdatenfeld. Der E-Rechnungs-XML-Export ist nicht erweitert.

Der gemeinsame PDF-Renderer verwendet 9 pt für die Bezeichnung und davon
abgeleitet 7 pt für Details. Leere Beschreibungen erzeugen kein Textelement.
Positionen mit Beschreibung dürfen über Seiten umbrechen; der Einzug bleibt
auf Folgeseiten erhalten. Bestehende gespeicherte Original-PDFs bleiben unverändert.

Lokale Prüfung unter macOS, Node 25.9.0, Next 16.3.0 und isolierter PB 0.39.10:
760 Unit-Tests und 197 echte Finanz-/RC-Integrationstests bestanden; Typecheck,
warnungsfreies ESLint und beide Hook-Generatorabgleiche bestanden.
PDF-Regressionen lesen Text und Schriftgrößen aus den erzeugten PDF-Streams,
prüfen fehlende/leere Details sowie 120 Detailzeilen über zwei Seiten.
Browserprüfung beider Neu-/Bearbeitungsformulare und visuelle PDF-Prüfung mit
Poppler lokal erfolgt. [Einzelheiten](testphase.md#tp-031-optionale-positionsbeschreibung-2026-09-11).
Kein Produktionsbuild, kein VPS-Test und kein Deployment in diesem Auftrag.
