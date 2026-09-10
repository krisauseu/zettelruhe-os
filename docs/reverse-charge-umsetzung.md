# Reverse Charge für betriebliche Auslandsdienstleistungen

Stand des Abgleichs: 10. September 2026, Codebasis `0842832`.
Abschnitte 1–3 sind implementiert und lokal abgenommen. Die öffentliche Freigabe
ist seit `6d4de5b` in Next und PocketBase geöffnet. Danach folgten TP-025 und die
Formularvereinfachung `961d06d`. Betreiberbestätigung vom 10. September 2026:
Reverse Charge ist auf dem Produktions-VPS getestet und läuft live. Der genaue
Produktionscommit und einzelne Testschritte wurden nicht genannt. Die frühere
ELSTER-Prüfsperre ist verworfen, da Zettelruhe lediglich XML exportiert und keine
Finanzamtsschnittstelle betreibt. Es bleibt kein RC-Freigabeissue offen.
Betriebsstand: [90-status.md](90-status.md).

Releasevorbereitung auf `f48be21` am 2026-09-10: Die angezeigte Zahllastdifferenz
verwendet nun denselben Decimal-Geldhelfer wie der übrige Rechenkern. Die einfache
Bedienung bleibt erhalten. Lieferantenvorschlag, Vollzahlung, Speichern/erneutes
Laden und Festschreibung mit UStVA-Werten wurden im isolierten Browser geprüft;
bei Kleinunternehmern bleibt der Abzug ausgeschlossen, Teil-/Mehrfachzahlungen
zeigen die bestehende Grenze. [Lokale Abnahme](issues/release-abnahme-2026-09-10.md).

Dieses Dokument bleibt Fach- und Implementierungsreferenz. Die ursprünglichen
Aufträge und datierten Abschnittsberichte darunter sind historisch. Aussagen wie
„Sperre bleibt geschlossen“ oder „Abschnitt 3 noch nicht begonnen“ beschreiben
nur den damaligen Zwischenstand. Sie sind keine aktuellen Arbeitsaufträge.

## Aktuelle Bedienung nach der Formularvereinfachung

In der Belegerfassung die Steuerbehandlung für EU- oder Drittlandsdienstleistung
wählen oder den Lieferantenvorschlag bewusst übernehmen. Leistungszeitraum,
Zahlungsstatus und gegebenenfalls Zahlungsdatum angeben; den Vorsteuerabzug prüfen.
Unter Regelbesteuerung ist voller Abzug vorausgewählt, unter § 19 ausgeschlossen.
Der deutsche RC-Satz steht unter „Weitere steuerliche Details“ und ist mit 19 %
vorbelegt; 7 % ist wählbar. Das Vorliegen eines Vorschlags bestätigt keine
steuerliche Einordnung.

Bei „Vollständig bezahlt“ übernimmt das Formular den Rechnungsbetrag als
Zahlbetrag und das Zahlungsdatum als Buchungsdatum. Im Hintergrund werden
Firmenmodus und Leistungsabschnitt bestätigt und eine einzelne Zahlung gesetzt.
Diese Werte werden nicht mehr durch eigene Bestätigungs-Checkboxen abgefragt.
Ein Standard-Nachweistext wird mitgegeben. Referenz, abweichender Nachweis und
„bereits separat erklärt“ liegen unter den weiteren Details. Ohne eigene Referenz
wird ein Bezug aus Beleg-ID oder Lieferant, Belegdatum und Leistungszeitraum
gebildet. Zusammengehörige Voraus-/Schlussrechnungen brauchen weiterhin einen
passenden gemeinsamen Bezug; der automatisch gebildete Text erkennt diese
Beziehung nicht selbst.

Die Vorschau zeigt Rechnungsbetrag, deutsche Umsatzsteuer, Vorsteuer,
Auswirkung auf die Zahllast und Steuermonat. Sie erscheint erst bei ausreichenden
Angaben. Kennziffern werden in dieser kompakten Ansicht nicht mehr angezeigt;
sie stehen in der UStVA-Auswertung. Gespeicherte Entwürfe laden seit TP-025 ihren
persistierten Formularzustand erneut.

Der Rechenkern und die Abschlussgrenzen wurden bei der Vereinfachung nicht
geändert. Unbezahlte, teilbezahlte und durch mehrere Zahlungen ausgeglichene Fälle
können als Entwurf gespeichert, aber nicht festgeschrieben werden. Die heutige
Oberfläche zeigt den ausführlichen Hinweis zur gesonderten Erklärung bei
Teil-/Mehrfachzahlung; bei unbezahlten Belegen steht nur der Entwurfshinweis.
Die früher dokumentierten ausdrücklichen Modusbestätigungen und ständig sichtbaren
KU-Hinweise entsprechen daher nicht mehr der aktuellen Oberfläche. Diese
Abweichung ist hier festgehalten; der Dokumentationsabgleich ändert keinen Code.

## Ursprünglicher Auftrag und Abschnittshistorie

Die folgenden Vorgaben waren der Ausgangspunkt für die drei getrennten
Implementierungsschritte. Aktueller Abschluss und Bedienung stehen oben.

## Einstieg in eine neue Session

1. Lies dieses Dokument sowie die Einstiegsvorgaben aus `AGENTS.md`.
2. Prüfe aktuellen Branch, HEAD, Arbeitsbaum und die tatsächlichen Änderungen
   des vorherigen Abschnitts. Erhalte fremde Änderungen und Arbeitsmaterialien.
3. Bearbeite ausschließlich den im Startprompt genannten Abschnitt.
4. Halte dessen Entscheidungen, Code-Einstiege, tatsächlich ausgeführte Tests,
   Einschränkungen und Abschlussstand unten fest. Danach stoppen.

Die Umsetzung erfolgt in drei frischen Sessions in der Reihenfolge 1 → 2 → 3.
Ein unvollständiger Abschnitt wird nicht still vom nächsten als erledigt angenommen.
Öffentliche RC-Verarbeitung erst nach Abschnitt 3 freigeben. Eine kleine zentrale
serverseitige Sperre reicht; kein allgemeines Feature-Flag-System bauen.
Zwischenstände sind keine freigegebenen Produktionsreleases.

Commit und Push bleiben an den ausdrücklichen Auftrag der jeweiligen Session
gebunden. Das Anlegen dieses Planungsdokuments autorisiert weder Implementierung
noch Commit, Push, Deployment oder Migration eines realen Datenbestands.

## Geschäftsfall und gewünschtes Ergebnis

Auslöser ist eine Rechnung von OpenAI Ireland Limited über 19,33 EUR ohne
ausgewiesene Umsatzsteuer, mit dem Hinweis "Tax to be paid on reverse charge basis".
Der Empfänger ist deutscher Unternehmer mit deutscher USt-ID. Weitere tatsächliche
Anbieter sind beispielsweise xAI, Google und Anthropic. Entscheidend ist jeweils
der konkrete Rechnungsaussteller und Leistungsfall, nicht der Markenname.

Vor diesem Ausbau konnte Zettelruhe die Ausgabe erfassen, aber die deutsche
Empfängersteuerschuld und deren gesonderten Vorsteuerabzug nicht auswerten.

| Größe bei 19 % | Regelbesteuerung, voller Abzug | Kleinunternehmer |
|---|---:|---:|
| Rechnungsnetto | 19,33 EUR | 19,33 EUR |
| Auf Rechnung ausgewiesene USt | 0,00 EUR | 0,00 EUR |
| Brutto / Lieferantenzahlung | 19,33 EUR | 19,33 EUR |
| Deutsche §-13b-Steuerschuld | 3,67 EUR | 3,67 EUR |
| Abziehbare §-13b-Vorsteuer | 3,67 EUR | 0,00 EUR |
| Zusätzliche wirtschaftliche Steuerbelastung | 0,00 EUR | 3,67 EUR |

Regelbesteuerung allein garantiert keinen vollständigen Vorsteuerabzug. Auch dort
muss ausgeschlossener Abzug mit voller Steuerschuld und null Vorsteuer möglich sein.
Die wirtschaftliche Belastung ist keine fiktive Zahlung an den Lieferanten oder
das Finanzamt. Tatsächliche Finanzamtszahlungen bleiben getrennte Geldbewegungen.

Zielkette: Lieferantenstandard → überprüfbarer Vorschlag → Entscheidung am Beleg →
atomar festgeschriebener Journal-Schnappschuss → steuerliche Periodenabfrage →
UStVA und nachvollziehbare Exporte.

## Bestand und Priorität

Betreiberbestätigung nach dem Analysebericht: Auf der einzigen produktiven Instanz
existieren keine bereits gebuchten Rechnungen oder Belege, die unter die neue
RC-Logik fallen. Es gibt keine rückwirkend zu korrigierenden OpenAI-/SaaS-Fälle.
Historische Erkennung, Nachklassifikation und Reparatur entfallen vollständig.
Insbesondere keine Klassifikation alter 0-%-Belege aus Land, Namen oder Text.
Normale Bestandsbuchungen und Belege ohne neue Klassifikation behalten ihre Bedeutung.

Analysebasis war Commit `21d0000`, kein verbindlicher zukünftiger Startcommit.
TP-020 und TP-021 sind fachlich abgearbeitet; TP-022 sichert Beleg-, Rechnungs-
und Kassenabschluss atomar ab. TP-023 ist abgeschlossen. TP-024 ist im genannten
Commit lokal abgenommen; sein VPS-Rollout war in den geprüften Unterlagen nicht
bestätigt. Aktuellen Stand vor Arbeit prüfen, keine alte Statusaussage fortschreiben.

Empfehlung: RC als nächster Fachpunkt. Scheduler-Locks/Firmenpagination,
nicht vollständig atomarisierte Zahlungswege und Wartungsthemen separat behandeln.
Kein allgemeiner Architekturumbau als Vorprojekt. Quellen zum aktuellen Stand:
[Entwicklung](entwicklung.md), [Testphase](testphase.md), [Roadmap](feature-roadmap.md).

## Freigegebener Umfang

| Tatbestand | Grundlage | Geschuldete USt | Abziehbare Vorsteuer |
|---|---|---|---|
| EU-Dienstleistung nach § 13b Abs. 1 | Kz 46 | Kz 47 | Kz 67 |
| Drittlandsdienstleistung nach § 13b Abs. 2 Nr. 1 | Kz 84 | Kz 85 | Kz 67 |

- Betriebliche Dienstleistungen in EUR.
- Ein unterstützter Tatbestand und Steuersatz je Beleg.
- Vorsteuerabzug vollständig oder ausgeschlossen; teilweise Abziehbarkeit erkennen
  und als nicht unterstützt behandeln.
- Beide Firmenmodi: `kleinunternehmer` und `regelbesteuerung_ist`.
- Kein Warenfall, innergemeinschaftlicher Erwerb, EUSt oder Mischbeleg.
- Kein vollständiger §-13b-Ausbau, keine allgemeine Tax Engine.
- Keine Kennziffern-Eingabe durch den Nutzer.
- Kein allgemeines Pflichtfeld Ware/Dienstleistung. Die bewusste Wahl eines
  Dienstleistungstatbestands enthält diese Festlegung bereits.

Kz 84/85 umfasst amtlich mehr Fälle als dieser Ausbau unterstützt. Daraus keine
Freigabe weiterer Tatbestände ableiten. Auslandsland, Rechnungssteuersatz oder
USt-ID allein entscheiden den Sachverhalt nicht. Auch die Steuerbefreiung eines
ausländischen Kleinunternehmers als Leistender kann eine gesonderte Prüfung erfordern.

## Vorhandene Architektur und Code-Einstiege

Vor Änderungen aktuelle Dateien und einschlägige ADRs lesen, insbesondere
0004, 0006, 0008, 0012, 0016, 0019 und 0024. Unter `app/` zusätzlich
`app/AGENTS.md` und die einschlägige installierte Next-Dokumentation beachten.

| Bereich | Stand der Analyse / Einstieg |
|---|---|
| Firmenmodus | `app/src/lib/pb.ts`, `firmen.steuermodus`; unverändert erhalten |
| Beleg | `app/src/modules/expenses/{types,invariants,repository,actions}.ts`, `beleg-form.tsx`; Netto/USt/Brutto, ein Satz, kein RC-Tatbestand |
| Journal | `app/src/modules/journal/{types,invariants,repository}.ts`; ein ursprünglicher Eintrag pro Beleg, Storno als Gegenbuchung |
| Geld | `app/src/lib/money.ts`; Decimal, Cent-Serialisierung, HALF_UP |
| Atomare Operation | `app/src/lib/finanz-transaktion.ts`, `pocketbase/pb_hooks/finanz.js` und Hook-Routen; Quellenprojektion, Journalwerte, Guards, Replay |
| Kontakt | `app/src/modules/contacts`; `land` und `ust_id` vorhanden, kein Ausgaben-Steuerstandard |
| Auswertung | `app/src/modules/reporting/{repository,aggregate,ustva,types}.ts` |
| Exporte | `reporting/export-csv.ts`, `export-datev.ts`, Archiv im Repository |
| Oberfläche | `app/src/app/app/belege`, `app/src/app/app/ust` samt XML-Route, Export-Routen |
| E-Rechnung | `app/src/modules/einvoice/{types,mapping,repository}.ts`, UBL-/CII-Parser |

Wichtige heutige Annahmen:

- `betrag_ust` ist der einzige normale Steuerbetrag; Netto plus USt ergibt Brutto.
  Die Normalisierung toleriert bisher einen Cent Differenz. Nicht beiläufig umbauen.
- Steuersatz ist `0`, `7`, `19` oder leer. Ein Steuertatbestand fehlt.
- `richtung` und `quelle_typ` beschreiben Richtung/Herkunft, keinen RC-Schlüssel.
- Kategorie ist ein Kostenbereich als Text-Schnappschuss; `konto` ist optionaler
  SKR-Text. Beide beweisen weder Ware/Dienstleistung noch Steuerbehandlung.
- KU blendet Steuerfelder aus. Allgemeine Beleg-/Journalvalidierung kennt den
  Firmenmodus nicht durchgängig. UI-Ausblendung ist keine serverseitige Garantie.
- E-Rechnungs-Mapping setzt unter KU USt null und Brutto als Netto-Basis.
- USt-Auswertung sperrt KU pauschal und behandelt normale Ausgaben-USt als Vorsteuer.
- Reporting filtert bisher nach Buchungsdatum. Das reicht für RC nicht.
- UStVA befüllt bisher 81/86/66/83. Die XML-Reihenfolge enthält RC-Kennziffern
  bereits, deren fachliche Befüllung fehlt.
- UStVA rundet Grundlagen bisher kaufmännisch auf volle Euro. Diese konkrete
  Annahme wurde nicht abschließend verifiziert und darf nicht übernommen werden.
- DATEV-light leitet BU-Schlüssel allein aus Steuersatz ab und schreibt EUR.
- Das E-Rechnungs-DTO kennt Währung; der Beleg besitzt kein durchgängiges
  Fremdwährungsmodell. Unbekannte Währung ist kein nachgewiesenes EUR.
- Rechnungen haben einen Modus-Schnappschuss; Belege/Journal bisher nicht analog.

Pauschale Aussagen in CONTEXT/ADRs, KU müsse keine USt abführen und brauche keine
UStVA, sind für diese Eingangsleistungen zu weit. Bei Umsetzung gezielt berichtigen;
die bestehenden Modi und normalen Arbeitsabläufe bleiben bestehen.

## Verbindliche Daten- und Journalinvarianten

1. Bestehende Rechnungsbeträge behalten ihre Bedeutung. RC-Steuer niemals in
   `betrag_ust` schreiben und Lieferantenbrutto niemals um RC-Steuer erhöhen.
2. Tatbestand, RC-Satz und Vorsteuerberechtigung getrennt modellieren. Kein großes
   Enum aus vermischten Werten wie Inland 19 %, steuerfrei und keine Vorsteuer.
3. Separate RC-Daten umfassen mindestens Tatbestand, Grundlage, deutschen Satz,
   geschuldete Steuer, tatsächlich abziehbare Vorsteuer, steuerlichen Zeitbezug
   und maßgeblichen Firmenmodus. Ein kleiner versionierter Schnappschuss ist sinnvoll.
4. Exakte Feldnamen, flache Felder versus streng validiertes JSON und Indizes werden
   erst in Abschnitt 1 entschieden. Filterbare Steuerdaten müssen abfragbar sein.
5. Serverseitige Berechnung ist verbindlich. Client-Steuerbeträge nicht vertrauen.
6. Vollständigen Schnappschuss beim Abschluss atomar mit Beleg und Journal sichern.
   Alle neuen Angaben in Quellenvergleich, Guards, Projektion und Replay aufnehmen.
7. Firmenmoduswechsel während der Vorbereitung/Festschreibung kontrollieren.
   Spätere Auswertung verwendet die gespeicherte Berechtigung, keine aktuellen Defaults.
8. Eine Journalzeile mit separaten Steuerinformationen für den unterstützten
   einfachen Fall. Keine künstlichen zusätzlichen Einnahme-/Ausgabezeilen für Steuer.
9. Storno nimmt die ursprünglichen Steuerdaten nachvollziehbar mit. Erfassungsfehler
   und spätere Entgeltänderung dürfen nicht ungeprüft gleich periodisiert werden.
10. Alte Datensätze ohne neue Felder werden ausschließlich im bisherigen Pfad gelesen.

## Steuerperiode, Rundung und offene Entscheidungen

Die Grundregeln wurden im Analysebericht anhand amtlicher Quellen eingeordnet:
EU-Dienstleistungen knüpfen an Leistungsausführung an, Drittlandsdienstleistungen
an Rechnungsausstellung mit gesetzlicher Folgemonatsgrenze. Vorauszahlungen haben
eigene Entstehungsregeln. Die eigene Ist-Versteuerung verschiebt § 13b nicht generell
auf das Zahlungsdatum. Leistungsabschnitt, Rechnung und Zahlung auseinanderhalten.
Die konkreten implementierbaren Regeln vor Codefestlegung erneut verifizieren.

| Entscheidung | Stand | Wann zwingend klären |
|---|---|---|
| Unbezahlte/teilbezahlte RC-Belege | Variante B ausdrücklich vom Betreiber gewählt: serverseitige Festschreibungssperre, klarer UI-Hinweis und gegebenenfalls separate Erklärung | Abschnitt 1, UI in Abschnitt 2 |
| Vollständige Vorauszahlung, Teil-/Dauerleistung, relevante Datumsnachweise | Konkreter Berechnungsvertrag offen | Abschnitt 1 |
| Beleg-/Steuerrundung und ganze Euro in UStVA, negative Werte | Konkrete Ausgaberegel fachlich verifizieren | Abschnitt 1; anwenden/prüfen in Abschnitt 3 |
| Storno versus Berichtigung einer ursprünglich falschen Erfassung | Periodenvertrag festlegen | Abschnitt 1 |
| DATEV-RC-Codierung | Nicht verifiziert | Abschnitt 3; Ablehnung ist erlaubte Lösung |
| XML-Schema und Plausibilitäten 2026 | Kennziffern geprüft, technische Abnahme ausstehend | Abschnitt 3 |

Für unbezahlte/teilbezahlte Fälle A und B anhand des tatsächlichen Codes bewerten:

- A: sauber unterstützen, sofern kleiner Zusatzaufwand; nötigen Zahlungsprozess,
  spätere EÜR-Wirkung und unveränderbares Journal konkret erklären.
- B: klar als nicht vollständig unterstützt kennzeichnen und entsprechende
  Verarbeitung sperren. Hinweis auf dennoch mögliche Steuer-/Erklärungspflicht.

Empfehlung mit Umfang und Risiken dem Nutzer vorlegen und Entscheidung abwarten.
Keine Variante still auswählen. Keine Steuer bis zur Zahlung verschieben, nur weil
die App den Zahlungsprozess noch nicht abbildet. Falls A einen größeren Ausbau
erfordert, vor Umsetzung benennen, statt einen vierten Hauptabschnitt zu erzeugen.

Rundungsziel: Steuer einmal auf einer festgelegten Cent-genauen Grundlage berechnen
und speichern; Beleg, Journal und Aggregation verwenden dieselben Beträge. Ganze
Euro erst bei der amtlichen Ausgabe, nicht pro Beleg. Keine Steuer aus bereits
gekürzten Grundlagen neu berechnen, ohne dass die fachliche Regel dies verlangt.
Mehrere homogene Positionen brauchen einen einheitlichen Rundungsweg. Mischfälle
bleiben außerhalb. Normale Rundungslogik nur bei belegtem Fehler gezielt korrigieren.

## Erfassung und Lieferantenstandard

- Endgültige Steuerbehandlung am Beleg wählen; 0 % ist niemals automatisch RC.
- Vorhandenes Land und USt-ID verwenden. Optionaler Ausgabenstandard schlägt nur
  bei neuen Belegen vor. Keine Änderung bestehender Entwürfe durch Kontaktänderung.
- Manueller Override bleibt erhalten. Herkunft des Vorschlags sichtbar machen.
- RC mit ausgewiesener Rechnungssteuer vor Festschreibung klären.
- Rechnungssteuersatz und deutscher RC-Satz verständlich unterscheiden.
- Pflichtangaben für Leistung/Zahlungsfall gemäß Abschnitt 1 erfassen, Steuerdetails
  automatisch anzeigen; keine Eingabe von Kz oder berechneten Steuerbeträgen.
- KU-Hinweis außerhalb eingeklappter Details: trotz § 19 zusätzliche Steuerschuld,
  im unterstützten Fall kein Vorsteuerabzug und Erklärung/Zahlung erforderlich.
- Import darf RC nicht still in gewöhnliche 0 % verwandeln. Vorschläge prüfen lassen.
- Nicht-EUR und ungesicherte Währung nicht als EUR-Beleg übernehmen.

## Auswertungen und Exportvertrag

- RC anhand steuerlichen Datums laden, auch wenn Buchungsdatum außerhalb liegt.
  Vereinigung mehrerer Abfragen deduplizieren, Firmenfilter und Pagination erhalten.
- RC-Vorsteuer nur Kz 67, nicht zusätzlich 66. RC-Grundlagen nicht 81/86.
- Für den unterstützten Umfang: bisherige Zahllast + Kz 47 + Kz 85 − Kz 67.
- Begrenzter KU-RC-Auswertungsworkflow mit Perioden und Erklärungshinweis.
  Voranmeldungen für betroffene Perioden und Jahreserklärung können erforderlich
  sein; eine Jahresübersicht ist kein implementiertes Jahreserklärungsformular.
- Historische RC-Schnappschüsse auch nach Firmenmoduswechsel erreichbar halten.
- XML im bestehenden Serializer; nur tatsächlich unterstützte, validierte Werte.
  Kein ELSTER-Versand. Jahresbezogene Schema-/Plausibilitätsprüfung erforderlich.
- Journal-CSV und Archivmetadaten geben Steuerdaten vollständig wieder.
- DATEV ohne verifizierten Schlüssel verständlich ablehnen und auf vollständigen
  Journalexport verweisen. Kein stiller Ausschluss einzelner RC-Zeilen/Teilexport.
- EÜR, BWA, Dashboard und Geldsummen nicht durch Steuerinformationen verändern.
  Tatsächliche Finanzamtszahlung nicht doppelt erfassen. Kein neues Zahlungsmodul.
- Bezogene Dienstleistungen sind keine eigenen Umsätze für §-19-Wächter oder ZM.

## Migration und Betrieb

Additiv, optional/defaultbar, voraussichtlich `belege`, `buchungsjournal` und optional
`kontakte`. Alte Migrationen unverändert lassen. Keine neue allgemeine Steuer-Collection,
keine Bestandsklassifikation. Synthetische Altbelege müssen dieselben Ergebnisse behalten.
Nötige Firmen-/Steuerdatumsindizes prüfen.

Hooks, Next und Schema koordiniert ausrollen. Alte Writer dürfen RC-Daten nicht
still ignorieren. Ein Downgrade nach RC-Buchungen ist kein automatisch sicherer Rollback.
Migrationen und Integrationstests nur mit dokumentierten isolierten Teststartern.
Keine produktiven Daten anfassen. Produktiver Rollout ist ein separater Auftrag.

## Abschnitt 1: Fachvertrag, Berechnung, Persistenz

**Ziel:** Isoliert geprüfter RC-Kern mit atomarem Journal-Schnappschuss.

**Vorbedingungen:** Aktuellen Git-Stand und Module prüfen; Zahlungsentscheidung
ausdrücklich einholen; konkrete fachliche Regeln verifizieren.

**Enthalten:** Datenvertrag, reine Validierung/Decimal-Berechnung, Datumskonzept,
additive Beleg-/Journalmigration, Quellenprojektion, Guards, atomare Festschreibung,
Replay, Storno/Korrekturvertrag und zentrale öffentliche Freigabesperre. Kontaktfeld
nur vorziehen, wenn dessen Vertrag feststeht; sonst Abschnitt 2.

**Nicht enthalten:** Nutzbare öffentliche RC-UI, Lieferantenstandard-UX, fertige
UStVA-/Exportverarbeitung, Produktivmigration oder Rollout.

**Hauptmodule:** expenses, journal, money, finanz-transaktion, PB-Hooks/Migrationen.

**Tests:** Berechnung aller Moduskombinationen; normale 19/7/0 unverändert; Termine,
Vorauszahlung, Zahlungsgrenzen, Rundung, Storno; echte isolierte PB-Tests für Migration,
Atomarität, Rollback, Replay, Konkurrenz, Quellen-/Firmenmoduswechsel, Rechte/Isolation.

**Definition of Done:** Entscheidungen dokumentiert; Berechnung und Persistenz
abgenommen; alte Pfade unverändert; erforderliche Hook-Tests tatsächlich gelaufen;
öffentliche RC-Erfassung gesperrt. Feldvertrag und Prüfnachweise hier ergänzen.

## Abschnitt 2: Erfassung, Vorschläge, Importgrenzen

**Ziel:** Verständliche RC-Erfassung in isolierter Testumgebung.

**Vorbedingungen:** Commit/Diff und Ergebnisse aus Abschnitt 1 prüfen; Datenvertrag,
Zahlungsentscheidung, Periodisierung und Replay müssen stehen.

**Enthalten:** Formular/Detailansicht, Leistungs-/Zahlungsangaben, berechnete Details,
sichtbarer KU-Hinweis, Abzugsauswahl, optionaler Kontaktstandard samt kleiner Migration,
Override, Konfliktprüfung, E-Rechnungs-Mapping und EUR-Grenze. Serverseitige Prüfung
und UI verwenden denselben Vertrag.

**Nicht enthalten:** Neue Grundsatzentscheidung, allgemeiner Parser-/Zahlungsumbau,
UStVA-Aggregation, XML/DATEV-Ausbau, öffentliche Freigabe oder Rollout.

**Hauptmodule:** expenses, contacts, einvoice, Beleg-/Kontaktseiten und Formularbausteine.

**Tests:** Formular-/Servertests für Vorschlag/Override, Kontaktänderungen, beide Modi,
Abzugsausschluss, normale deutsche USt beim Auslandsanbieter, Widersprüche,
Zahlungsgrenzen, Vorauszahlung, Fremdwährung/unbekannte Währung; isolierter Browsertest.

**Definition of Done:** Test-UI funktioniert; Beträge/Kz werden nicht manuell eingegeben;
KU-Hinweis sichtbar; Umfangsgrenzen serverseitig durchgesetzt; Persistenzgarantien erhalten;
öffentliche Sperre bleibt bestehen. Übergabe um UI-/Importvertrag ergänzen.

## Abschnitt 3: UStVA, XML, Exporte, Abnahme

**Ziel:** Durchgängige Verarbeitung innerhalb der beschlossenen Grenzen.

**Vorbedingungen:** Tatsächliche Commits/Diffs beider Vorgänger prüfen. Offene
Entscheidungen nicht im Reporting durch Annahmen ersetzen.

**Enthalten:** Steuerperiodenabfrage, RC-Aggregation/Kz, KU-Auswertung, XML im bestehenden
Serializer, Journal-/Archivmetadaten, sichere DATEV-Grenze, vollständige Regression,
isolierter End-to-End-Ablauf und dokumentierte spätere Rollout-Reihenfolge.
Öffentliche Sperre im Code erst nach erfolgreicher Abnahme lösen.

**Nicht enthalten:** Weitere Kz, Jahreserklärungsmodul, ELSTER-Versand, historische
Reparatur, allgemeines DATEV-/Zahlungsmodul oder produktiver Rollout.

**Hauptmodule:** reporting, Journalfilter, USt-/XML-/Export-Routen, gegebenenfalls Navigation.

**Tests:** Gesamte Matrix unten, jahresbezogenes XML-Schema/Plausibilitäten, sichere
Build-/Typecheck-/Lint-Prüfungen, relevante Gesamtsuite und echte PB-Integration.

**Definition of Done:** Beleg → Journal → richtige Steuerperiode → UStVA → Export
abgenommen; keine Doppelzählung oder Geldverfälschung; Historie stabil; Exportgrenzen
ehrlich. Fehlende erforderliche Abnahme bedeutet keine öffentliche Freigabe.

## Gemeinsame Testmatrix

Bestehende Tests erweitern, nicht ersetzen. Nur synthetische Daten. Übersprungene
Hook-Tests sind nicht bestanden. Sichere Starter und Prüfkommandos aus dem aktuellen
Repository verwenden, tatsächlich ausgeführte Kommandos im Abschluss festhalten.

| Fall | Erwartung |
|---|---|
| Deutsche 19-/7-%-Rechnung | Normale Beträge und bisherige Behandlung unverändert |
| Alter 0-%-Beleg | Keine RC-Zuordnung |
| EU-RC Regelbesteuerung | 46/47, bei Abzug 67; Zahlung unverändert |
| EU-RC KU | 46/47, null Vorsteuer, sichtbarer Hinweis |
| Drittland-RC Regelbesteuerung/KU | 84/85 statt 46/47; modusrichtiger Abzug |
| Regelbesteuerung ohne Abzug | Volle RC-Schuld, null Vorsteuer |
| Auslandsanbieter mit normaler deutscher USt | Kein automatischer RC-Zwang |
| EU-Anbieter ohne RC-Fall | Kein Tatbestand allein aus Land |
| Override und Kontaktänderung | Belegentscheidung bleibt erhalten |
| Getrennte Monate/Quartale | Steuerperiode findet Beleg unabhängig von Zahlungsdatum |
| Vorauszahlung | Richtige Entstehung, keine zweite Steuer für denselben Betrag |
| Unbezahlt/teilbezahlt | Beschlossene Unterstützung oder klare Grenze, kein Steueraufschub |
| Storno/Korrektur | Richtige Steuerperiode, Originalkontext auch außerhalb der Abfrage |
| Rundung, kleine/negative Beträge | Konsistenter dokumentierter Berechnungsweg |
| UStVA | Keine 67/66-Doppelzählung, keine RC-Grundlagen in 81/86 |
| XML | Unterstützte Kz, korrekte Jahresstruktur und Ausgabe |
| DATEV | Verifizierte Behandlung oder vollständige verständliche Ablehnung |
| Journal-/Archivexport | Steuerdaten vollständig, keine irreführenden Teilresultate |
| Nicht-EUR/unklare Währung | Keine stille EUR-Interpretation |
| Rechte und Atomarität | Isolation, Rollback, Replay, Konkurrenz, Quellenvergleich |
| Späterer Firmenmoduswechsel | Historische RC-Berechtigung/Beträge unverändert |
| Geldberichte und Steuerzahlung | Keine fiktiven Bewegungen oder doppelte Schuld |

## Amtliche Quellen aus der Analyse

Abrufstand der ursprünglichen Analyse: 7. September 2026. Die Kennziffern wurden
am Formular 2026 geprüft. Die Liste ist ein Einstieg zur Verifikation, kein Beleg
für bereits absolvierte technische Schema- oder Importtests.

- [§ 3a UStG](https://www.gesetze-im-internet.de/ustg_1980/__3a.html): Leistungsort.
- [§ 13b UStG](https://www.gesetze-im-internet.de/ustg_1980/__13b.html): Tatbestand,
  Empfängersteuerschuld und Entstehung.
- [§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html): KU und Verweis
  auf fortbestehenden § 18 Abs. 4a.
- [§ 18 UStG](https://www.gesetze-im-internet.de/ustg_1980/__18.html): Erklärungspflichten.
- [BMF-Vordrucke 2026](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2025-12-29-vordruckmuster-USt-voranmeldung-2026.pdf?__blob=publicationFile&v=7): Kz 46/47, 84/85 und 67.
- [ELSTER-Anleitung 2026](https://www.elster.de/elsterweb/helpGlobal?themaGlobal=help_ustva_2026).
- [UStAE 13b.15, Ausgabe 2024](https://usth.bundesfinanzministerium.de/usth/2024/A-Umsatzsteuergesetz/IV-Steuer-und-Vorsteuer/Paragraf-13b/ae-13b-15.html):
  Vorsteuer; historische Handbuchausgabe, für Implementierung aktuellen Rechtsstand prüfen.
- [§ 11 EStG](https://www.gesetze-im-internet.de/estg/__11.html): Abfluss und Jahreswechsel.
- [ELSTER-XML-Upload](https://www.elster.de/eportal/helpGlobal?themaGlobal=ustva_upload):
  Nutzdaten, Zeichensatz, Verweis auf Jahres-Schemata/Plausibilitäten.

## Übergabestand je Abschnitt

| Abschnitt | Status | Implementierungscommit | Tatsächlich ausgeführte Prüfungen |
|---|---|---|---|
| 1 | Lokal abgenommen | Lokaler Commit `RC Abschnitt 1: Fachvertrag und atomare Persistenz` einschließlich dieser Übergabe | 175 echte Hook-Tests; separate Sperrprüfung; 681 normale Tests; Typecheck, gezieltes Lint, Generator-/Syntax-/Diff-Prüfung |
| 2 | Lokal abgenommen | Lokaler Commit `RC Abschnitt 2: Erfassung, Vorschläge und Importgrenzen` einschließlich dieser Übergabe | 176 echte Hook-Tests, separate Sperrprüfung, zusätzlicher gezielter Original-Importtest; 711 normale Tests und abschließend 23 Formulartests; Typecheck, gezieltes Lint, isolierte Browserprüfung |
| 3 | Reporting und Exporte lokal implementiert, vollständig regressionsgetestet und öffentlich freigegeben | lokaler Abschnitt-3-Commit, siehe Git-Historie | 728 normale Tests; 179 echte RC-Kerntests; Typecheck, gezieltes Lint, Hook-Generatorprüfung, Docker-Produktionsbuild und isolierter Browserablauf |

Beim Abschluss des jeweiligen Abschnitts hier ergänzen: Nutzerentscheidungen,
endgültige Feldnamen/Verträge, betroffene Dateien, Testkommandos und Ergebnisse,
bekannte Restpunkte, Stand der öffentlichen Sperre und Startfähigkeit des Nachfolgers.
Keine Implementierung oder Abnahme allein aufgrund dieses Plans als erledigt markieren.

### Abschnitt 1: Entscheidungsbegründung vom 7. September 2026

Ausgangspunkt war `main`, HEAD `21d0000c6add43a72f02f4e6bfe673be0d6bb17a`.
Bereits vorhanden waren die Änderung an `docs/entwicklung.md`, dieses
unversionierte Dokument und `docs/Bericht_Test_VPS_06092026`. Der Auftrag wurde
zunächst vor abhängigen Feldern angehalten; anschließend hat der Betreiber B
hier ausdrücklich gewählt. Fremde Änderungen und Arbeitsmaterialien bleiben erhalten.

| | A: unbezahlte/teilbezahlte Belege unterstützen | B: Verarbeitung sperren, gewählt |
|---|---|---|
| Daten | Einzelne Ausgabenzahlungen, Restbeträge, Anzahlungszuordnung und Rückzahlungen | Zahlungsfall, vollständiger Ausgleich, Leistungs-/Rechnungsdaten und Nachweise |
| Journal/Zahlungsfolgen | Steuerliche Erfassung vor Zahlung, getrennte spätere Abflüsse mit eigener EÜR-Wirkung | Eine Belegzeile mit tatsächlichem Abfluss und getrenntem Steuerzeitbezug; unvollständige Fälle nicht festschreiben |
| Risiko | Doppelzählung, neue Korrektur- und Konkurrenzfälle über mehrere Zahlungen | Nicht unterstützte Fälle müssen gegebenenfalls außerhalb der App erklärt werden; kein Steueraufschub bis Zahlung |
| Umfang | Neuer Ausgaben-Zahlungsprozess mit UI, Persistenz und Berichtsanpassungen; kein kleiner Zusatzaufwand | Begrenzter RC-Kern mit verbindlicher Sperre und sichtbarem Hinweis in Abschnitt 2 |

Codebelege für die Empfehlung B: `expenses/types.ts` kennt nur Entwurf und
Festschreibung; `payments/types.ts` hängt Zahlungen an Ausgangsrechnungen.
`reporting/aggregate.ts`, `istZuflussRelevant`, zählt Belegzeilen vollständig als
Geldbewegung. `finanz.js` bindet den Abschluss an eine ursprüngliche Journalzeile.
A hätte deshalb einen größeren, nicht beiläufig freigegebenen Zahlungsumbau verlangt.

### Abschnitt 1: Verbindlicher Vertrag nach Entscheidung B

Der Betreiber hat ausdrücklich freigegeben: automatische Festschreibung und
steuerliche Verarbeitung nur für vollständig bezahlte RC-Eingangsbelege.
Unbezahlt/teilbezahlt bleibt außerhalb des unterstützten Umfangs. Ein Entwurf
ist keine abgeschlossene steuerliche Erfassung. Die serverseitige Fehlermeldung
nennt die notwendige gesonderte Erklärung; Abschnitt 2 muss sie zusätzlich
sichtbar am Zahlungsfall darstellen. Diese Entscheidung ist getroffen und nicht
bei der Fortsetzung erneut einzuholen.

#### Daten und Abgrenzung

- `belege.rc`: optionales, streng validiertes JSON `RcInput` im Entwurf,
  `RcSnapshot` nach Festschreibung. Fehlend/null bedeutet den unveränderten
  normalen Pfad; keine Bestandsklassifikation. Keine Kontaktmigration.
- `buchungsjournal.rc`: vollständiger unveränderbarer `RcSnapshot`.
  Beide Collections erhalten zusätzlich `rc_steuerdatum` und `rc_vorgang`
  als filterbare Textfelder mit Firmenindizes. Diese beiden Felder werden nur
  intern gesetzt; ein Entwurf führt sie leer. Migration `1730002800_reverse_charge.js`.
- Vertrag und reine Funktionen: `app/src/modules/expenses/reverse-charge.ts`.
  Eingaben: `version=1`, `tatbestand=eu_dienstleistung|drittland_dienstleistung`,
  `waehrung=EUR`, `satz=7|19`, `abzug=voll|ausgeschlossen`, `steuermodus`,
  `modus_bestaetigt`, `leistung_von`, `leistung_bis`,
  `leistungsabschnitt_bestaetigt`, `zahlungsstatus=unbezahlt|teilbezahlt|bezahlt`,
  `zahlungsdatum`, `zahlungsbetrag`, `eine_zahlung`, `vorgang`,
  `bereits_erklaert` und `nachweis`.
- Der Schnappschuss ergänzt `grundlage`, `schuld`, `vorsteuer`, `steuerdatum`
  und `zeitregel`. Eine Gegenbuchung ergänzt `korrektur` mit `art`, `original`,
  `datum`, `nachweis`. Berechnete Felder sind keine zulässigen Entwurfseingaben.
- Rechnungssteuer bleibt `steuersatz=0`, `betrag_ust=0.00`, Netto gleich Brutto.
  `rc.satz` ist der davon unabhängige deutsche Satz. Der Bruttobetrag bleibt
  allein die Lieferantenzahlung. Geldtexte haben exakt zwei Nachkommastellen;
  der RC-Vertrag erlaubt höchstens zwölf Vorkommastellen und positive Originale.
- Bewusst einfacher Zahlungsfall: eine belegte vollständige Zahlung in EUR,
  Buchungsdatum gleich Abflussdatum. Zahlungsketten, unklare Währung,
  Teilabzug, Mischbelege und bereits separat erklärte Vorgänge werden abgelehnt.
  Ein erledigter Leistungsabschnitt muss gesondert vereinbart/abgerechnet sein
  und darf höchstens ein Jahr umfassen. Längere Dauerleistungen bleiben gesperrt.
- `vorgang` bezeichnet innerhalb der Firma dieselbe wirtschaftliche Leistung,
  auch auf einer späteren Schlussrechnung. Abschnitt 2 muss diesen Bezug erhalten
  und erklären; pro Rechnung einen neuen Schlüssel zu erzeugen wäre falsch.
  Die Transaktion sperrt eine zweite Festschreibung desselben Vorgangs.
  Ein anderer manuell angegebener Vorgangsbezug ist keine automatische
  Dublettenerkennung desselben Sachverhalts.
- Ein Moduswechsel zwischen Vorbereitung und Abschluss erzeugt `RC_MODE_CHANGED`.
  `modus_bestaetigt` bestätigt zusätzlich die Geltung für den abgeleiteten
  Steuerzeitpunkt. Eine abweichende historische Moduslage wird nicht aus dem
  heutigen Firmenmodus rekonstruiert. Spätere Änderungen berechnen nichts neu.

#### Fachliche Herleitung und Rundung

Amtlicher Abruf am 7. September 2026:

- [§ 3a Abs. 2 UStG](https://www.gesetze-im-internet.de/ustg_1980/__3a.html)
  und [§ 13b Abs. 1, 2, 7 UStG](https://www.gesetze-im-internet.de/ustg_1980/__13b.html):
  betriebliche Dienstleistungen mit deutschem Leistungsort, EU-Ansässigkeit für
  Abs. 1, hier auf Drittlandsdienstleistungen begrenzter Abs. 2 Nr. 1.
  Land/USt-ID allein ersetzen diese Prüfung nicht; steuerfreie Leistungen
  ausländischer Kleinunternehmer und Sonderleistungsorte sind keine automatisch
  unterstützten RC-Fälle. Die Tatbestandswahl und der Nachweis halten die
  Prüfung fest.
- EU ohne Vorauszahlung: `steuerdatum=leistung_bis`. Drittland nach Leistung:
  früheres Datum aus Rechnungsausstellung und letztem Tag des Folgemonats nach
  Leistung. `belegdatum` bezeichnet dabei ausdrücklich das Ausstellungsdatum,
  nicht den Rechnungseingang. Die eigene Ist-Versteuerung verschiebt diese
  Periode nicht. Grundlage: § 13b Abs. 1, 2 und 4.
- [Aktueller UStAE, Stand 2. Juni 2026](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/Umsatzsteuer-Anwendungserlass-aktuell.pdf?__blob=publicationFile),
  13b.12 Abs. 3: bei Vorauszahlungen ist die Anmeldung schon im Zeitraum des
  eigenen Abflusses ausdrücklich zulässig. Der Kern nutzt diese Vereinfachung
  für die vollständige Zahlung vor Ende der Leistung. Damit ist kein geratener
  Vereinnahmungstag des Lieferanten erforderlich. `zeitregel=vorauszahlung_abfluss`
  hält diese Herleitung fest; spätere Leistung/Rechnung erzeugt keine zweite Steuer.
- [§ 15 Abs. 1 Nr. 4, Abs. 2 UStG](https://www.gesetze-im-internet.de/ustg_1980/__15.html)
  und UStAE 13b.15: Vorsteuer im selben Steuerzeitraum bei voller Berechtigung;
  Vorauszahlung setzt Zahlung voraus. Rechnungserhalt ist für §-13b-Vorsteuer
  keine allgemeine zusätzliche Voraussetzung. KU und ausgeschlossener Abzug
  ergeben hier null Vorsteuer, die Schuld bleibt bestehen. Die Pflicht zur
  Erklärung nach [§ 18 Abs. 4a UStG](https://www.gesetze-im-internet.de/ustg_1980/__18.html)
  entfällt durch die Produktsperre nicht.
- UStAE 13b.13 und 14.5 Abs. 20 stützen Nettogrundlage/deutschen Satz und
  Cent-Rundung. Implementierter Belegvertrag: homogene Grundlage in Cent,
  einmal `Grundlage × Satz / 100` mit Decimal und HALF_UP auf Cent.
  Kein Summieren einzeln gerundeter Positionssteuern. Gegenbuchungen negieren
  die gespeicherten Centbeträge exakt. Beispiel: 19.33 × 19 % → 3.67.
- [BMF-Vordrucke 2026, Anleitung](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2025-12-29-vordruckmuster-USt-voranmeldung-2026.pdf?__blob=publicationFile&v=7)
  und [ELSTER-Anleitung 2026](https://www.elster.de/elsterweb/helpGlobal?themaGlobal=help_ustva_2026):
  Bemessungsgrundlagen ohne Cent, Steuer/Vorsteuer mit Cent, negative Beträge
  mit Minuszeichen. Daraus folgt für Abschnitt 3: erst je Kennziffer/Periode
  vorzeichenrichtig summieren, dann Centanteil der Grundlage weglassen,
  also gegen null kürzen. Beispiele: 19.99 → 19, −19.99 → −19.
  Das ist keine kaufmännische Ganz-Euro-Rundung. Steuer aus den gespeicherten
  Centbeträgen summieren, nicht aus der gekürzten Grundlage neu berechnen.
  Abschnitt 3 korrigiert deshalb auch die bisherige normale UStVA-Ausgabe:
  Kz 81/86 werden nicht mehr kaufmännisch gerundet, sondern erst nach der
  Periodensumme gegen null auf volle Euro gekürzt. Eigene Regressionen sichern
  positive und negative Werte; die ZM behält ihre bisherige Rundung.

Begründete Grenze: Bei Drittlands-Vorausrechnung vor Leistung, aber Zahlung
erst bei/nach Leistungsende, wird kein unzureichend abgesicherter Sonderfall
automatisch periodisiert. Der Kern verlangt gesonderte Prüfung. Vollständig
bezahlte Vorauszahlungen sind dagegen wie oben unterstützt. Tagesangaben sind
Berliner Kalendertage; Zeitstempel bleiben UTC. Keine manuelle Steuerperiode.

#### Korrektur und Persistenzgarantien

- `beleg/rc-stornieren` ist eine feste interne PB-Operation. Sie prüft Firma,
  Schreibrecht, vollständige Originalprojektion und originalen Beleg-Schnappschuss.
  Gegenbuchung, laufende Journalnummer und Replay sind transaktional gebunden.
- `erfassungsfehler` negiert den ursprünglichen Schnappschuss in dessen
  Steuerperiode und reversiert den ursprünglichen Abfluss. Danach kann der
  korrigierte Beleg denselben Vorgangsbezug verwenden; die alte Erfassung samt
  Gegenbuchung bleibt erhalten. Das ist keine Änderung einer Lieferantenrechnung.
- `vollstaendige_rueckzahlung` verlangt das Datum der nachgewiesenen vollständigen
  Entgeltrückgewähr. Geld- und Steuerkorrektur liegen dann in dieser späteren
  Periode. Grundlage sind [§ 17 UStG](https://www.gesetze-im-internet.de/ustg_1980/__17.html)
  und UStAE 17.1 Abs. 2 zur tatsächlichen Rückzahlung. Eine bloße Gutschrift ohne
  Rückgewähr löst hier keine automatische Rückbuchung aus. Teilminderungen,
  Rückzahlungsketten und andere Entgeltänderungen sind nicht implementiert.
- Neue RC-Daten nehmen vollständig am Quellenvergleich teil, auch bei Entfernen
  einer Klassifikation. Alte Writer ohne erwartete RC-Daten können solche
  Quellen nicht verändern. Direkte oder unvollständige Journal-/RC-Writes
  werden durch Record-Hooks abgewiesen. Normale Altpfade bleiben erhalten.
- Replay prüft die gespeicherten Daten mit dem damaligen Modus und Abschlussdatum;
  aktuelle Kontakt-/Firmendaten ändern Schuld und Abzug nicht. Ein beschädigter
  Schnappschuss wird abgelehnt, nicht repariert.
- Die zentrale Freigabe `RC_PUBLIC_ENABLED=false` gilt für Next und PB. Es gibt
  keinen Request- oder Produktions-ENV-Schalter. `scripts/build-rc-hook.mjs`
  erzeugt den PB-Rechenkern aus derselben TypeScript-Quelle und kopiert die
  bereits installierte Decimal-Version samt Lizenz. `--check` erkennt Abweichungen.
  Keine neue npm-Abhängigkeit, keine zweite handgeschriebene Steuerberechnung.

#### Übergabe und verbleibende Arbeiten

Abschnitt 2 muss die Erfassung samt Nachweisen, Zahlungsfall, Abzug, Modusbestätigung
und stabilem Vorgangsbezug anbinden. Die Sperrmeldung gehört sichtbar an unbezahlte
und teilbezahlte RC-Belege. Lieferantenstandard, Override und Import-/Währungsgrenzen
sind noch nicht umgesetzt. Der normale manuelle Journal-/Stornopfad darf RC nicht
als normalen 0-%-Beleg weiterreichen. Die RC-Korrekturoperation braucht eine
entsprechende ausdrückliche Auswahl und Nachweisanzeige.

Abschnitt 3 muss `rc_steuerdatum` unabhängig vom Buchungsdatum abfragen, die
Schnappschüsse vorzeichenrichtig aggregieren, KU berücksichtigen und XML/Exporte
vervollständigen. Reporting-/Exportmodule sind hier unverändert. EÜR/Geldberichte
zählen weiterhin reale Abflüsse; normale bestehende Jahreswechsel-Sonderregeln
wurden nicht erweitert. Öffentliche Freigabe erst nach Abschnitt 3, Rollout nur
mit eigenem Auftrag. Kein Abschnitt 2 oder 3 wurde begonnen.


#### Tatsächlich ausgeführte Abnahme am 7. September 2026

| Kommando | Ergebnis |
|---|---|
| `node scripts/test-festschreibung-isolated.mjs --rc-kern` | 175/175 Tests in fünf Dateien bestanden, keine übersprungenen Tests. PB 0.39.10, neue tmpfs-Instanz, Produktionshooks mit ausdrücklich nur in der temporären Kopie geöffneter RC-Sperre. Enthält 34 RC-Tests und die bisherigen 141 Finanztests. |
| `node scripts/test-festschreibung-isolated.mjs` | 144 Tests mit geschlossener Produktionssperre bestanden, darunter echte Ablehnung von RC-Anlage, Abschluss und Korrektur. Die damals 30 RC-Kernfälle dieses Laufs waren gesperrt/übersprungen und sind kein Erfolgsnachweis; der vollständige freigegebene Lauf darüber prüft den Kern. |
| `cd app && npm test` | 681 Tests bestanden. Ohne isolierten Starter werden die Integrationssuiten nicht ausgeführt; deren Abnahme stammt ausschließlich aus den beiden Starter-Läufen. |
| `cd app && ./node_modules/.bin/tsc --noEmit --incremental false` | Bestanden. |
| `cd app && ./node_modules/.bin/eslint src/modules/expenses/reverse-charge.ts src/modules/expenses/reverse-charge.test.ts src/modules/expenses/types.ts src/modules/expenses/invariants.ts src/modules/expenses/repository.ts src/modules/expenses/actions.ts src/modules/journal/types.ts src/modules/journal/invariants.ts src/modules/journal/repository.ts src/lib/finanz-transaktion.ts src/lib/rc-transaktion.integration.test.ts` | Bestanden; nach letzten Änderungen betroffene Dateien erneut geprüft. |
| `node scripts/build-rc-hook.mjs --check` | TypeScript/Hook, Decimal-Laufzeit und Lizenz bytegleich; zusätzlich als Unit-Test abgesichert. |
| `node --check pocketbase/pb_hooks/finanz.js`, `node --check pocketbase/pb_migrations/1730002800_reverse_charge.js`, `node --check scripts/test-festschreibung-isolated.mjs`, `git diff --check` | Bestanden. |

Die Migrationsfixture läuft ausschließlich im temporären Migrationsordner vor
der echten additiven RC-Migration. Sie erzeugt drei synthetische festgeschriebene
Altbelege samt Journal mit 19/7/0 %; deren Werte und fehlende RC-Klassifikation
bleiben nach Migration erhalten. Jeder Starter entfernt seinen Container und
seine temporären Daten/Dateien. Der Docker-Socket-Zugriff des Starters benötigte
Sandbox-Freigabe; keine reale Dateninstanz, kein produktives Volume und keine
Produktivzugangsdaten wurden verwendet. Kein App-Start, Browserlauf, Build,
Deployment, Push oder Produktivmigration.

Abschnitt 1 ist abgeschlossen. Abschnitt 2 kann auf diesem Commit beginnen,
bleibt aber ein eigener Auftrag. Die öffentliche RC-Sperre bleibt unverändert
aktiv; daraus folgt noch keine produktive RC-Nutzbarkeit. Der Commit enthält
gezielt die RC-Quellen, Hooks, Migration, Tests, sicheren Starter und Fachübergabe.
Die schon vorhandene Änderung in `docs/entwicklung.md` und der unversionierte
VPS-Bericht bleiben außerhalb dieses Commits.


### Abschnitt 2: Erfassung und Importgrenzen, 8. September 2026

Ausgangsbasis war `main`, HEAD `d33522cd8342e1d2346ef0df43544d621a485f43`.
Der tatsächliche Abschnitt-1-Diff wurde einschließlich Migration, Kern,
Quellenprojektion, Transaktion, Replay, Korrektur und Tests geprüft.
Keine fehlende Persistenzvoraussetzung und keine neue Grundsatzentscheidung.
Der Vertrag `RcInput`/`RcSnapshot`, Berechnung, Journalgarantien und
`RC_PUBLIC_ENABLED=false` bleiben unverändert. Die vorhandene Änderung in
`docs/entwicklung.md` und `docs/Bericht_Test_VPS_06092026` bleiben unangetastet.

#### Bedienung und neue Felder

- `/app/belege/neu` und `/app/belege/[id]`: Steuerbehandlung `bisherig`,
  `eu_dienstleistung` oder `drittland_dienstleistung`. Das Formular sendet
  `steuerbehandlung` und die einzelnen `rc_*`-Eingaben aus Abschnitt 1.
  `beleg-form-input.ts` übersetzt und validiert diese Eingaben. Unbekannte,
  berechnete und widersprüchliche RC-Formularfelder werden abgewiesen.
  Ein ausdrücklicher Wechsel zur bisherigen Behandlung setzt `rc=null`.
- `rc-fields.tsx` erfasst Leistungsabschnitt, eine vollständige Zahlung,
  Abzug, Nachweis, stabilen Vorgangsbezug und die Modusbestätigung.
  Nach einem abweichenden Firmenmodus ist die Bestätigung nicht vorausgewählt.
  Der deutsche RC-Satz und bei Regelbesteuerung die Abzugsberechtigung
  müssen ausdrücklich gewählt werden. KU zeigt ausschließlich ausgeschlossenen Abzug.
- Die Vorschau verwendet `parseBelegForm`, `validateBelegInput` und denselben
  `calculateRc` wie die serverseitige Festschreibung. `rc-details.tsx` zeigt
  Grundlage, Schuld, Vorsteuer, Steuerdatum/Monat, Zeitregel und Kennziffern.
  Der gesicherte Beleg und das Journal zeigen den gespeicherten Schnappschuss.
  Steuerbeträge und Kennziffern sind keine Eingabefelder.
- Belegdatum bezeichnet bei RC die Rechnungsausstellung. Buchungsdatum ist
  ausdrücklich das Abflussdatum; Steuerdatum wird gesondert berechnet.
  Voraus- und Schlussrechnung derselben Leistung müssen denselben Vorgangsbezug
  verwenden. Der Bezug ist keine automatische Dublettensuche nach Inhalt.
- KU-Hinweis und Zahlungsgrenze stehen sichtbar außerhalb eingeklappter Details.
  Unbezahlte und teilbezahlte Entwürfe bleiben speicherbar, der Abschluss ist
  gesperrt. Der Hinweis stellt klar, dass die steuerliche Pflicht dadurch nicht
  aufgeschoben wird und gegebenenfalls eine separate Erklärung erforderlich ist.
- `/app/kontakte/neu` und `/app/kontakte/[id]` erhalten den optionalen
  `kontakte.ausgaben_steuerstandard`: leer, `bisherig`, `eu_dienstleistung`
  oder `drittland_dienstleistung`. Additive Migration ausschließlich für Kontakte:
  `1730002900_kontakt_ausgabensteuerstandard.js`. Alte Migrationen unverändert.
  Kontakt-CSV-Import setzt keinen neuen Standard; das bisherige CSV-Format
  enthält dieses optionale Feld noch nicht.
- Nur neue Belege bieten den Lieferantenstandard per „Vorschlag übernehmen“ an.
  Herkunft und Übersteuerbarkeit werden angezeigt. Land und USt-ID bleiben
  Hinweise, keine automatische Entscheidung. Bestehende Entwürfe laden ausschließlich
  ihre gespeicherte Wahl; Kontaktänderungen klassifizieren nichts um.
  Die Vorschlagsherkunft wird während der Eingabe angezeigt, nicht als zusätzliches
  Journalfeld persistiert. Nach Speichern heißt sie „Gespeicherte Auswahl am Beleg“.
- `/app/journal/[id]` zeigt RC-Daten und ergänzt für RC eine ausdrückliche
  Korrekturwahl samt Datum und Nachweis. Die Action nutzt die vorhandene atomare
  RC-Korrektur. Erfassungsfehler und vollständige Rückzahlung bleiben getrennt;
  kein neuer Zahlungsprozess. Manuelle Journalformulare weisen RC-Eingaben ab
  und verweisen auf die Belegerfassung.

#### Importgrenzen

UBL/CII behalten eine fehlende Rechnungswährung als leer. Insbesondere eine
UBL-Steuerwährung ersetzt keine Rechnungswährung. Nicht-EUR und unbekannte
Währung werden vor der Übernahme und vor KU-Betragsnormalisierung abgewiesen.
Vor der Übernahme wird das archivierte Original erneut gelesen und geparst;
ältere DTOs mit damals geratenem EUR oder fehlendem RC-Hinweis sind kein Nachweis.
Das Original und der bestehende Inbox-Datensatz werden dabei nicht repariert.

`ParsedEInvoice.rc_hinweis` hält einen überprüfbaren Hinweis aus Kategorie AE,
VATEX-EU-AE oder RC-Text fest. Auch spätere Positions-/Steuergruppen werden auf
Hinweise geprüft. Der Hinweis bestimmt weder Dienstleistungsart noch deutschen Satz.
Eine solche Rechnung wird nicht automatisch als gewöhnlicher 0-%-Beleg angelegt.
Die Inbox erklärt die Grenze und verlinkt zur manuellen fachlichen Erfassung.
Dies ist bewusst keine vollständige RC-Importvorbefüllung und kein neuer Parser.
Normale Auslandsanbieter mit deutscher Rechnungs-USt bleiben im bisherigen Pfad.
Die geprüften automatischen Beleg-Anlagepfade sind die manuelle Action und der
E-Rechnungsempfang; Bank-Matching erzeugt keine RC-Ausgabenbelege.

#### Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `node scripts/test-festschreibung-isolated.mjs --rc-kern` | 176/176 echte Tests bestanden. Enthält Kontaktmigration, Formular → Repository → PB, manuellen Override, Kontaktänderungen bei Entwurf und Festschreibung sowie sämtliche bisherigen Finanz-/RC-Garantien. |
| `node scripts/test-festschreibung-isolated.mjs` | 144 Tests bestanden, 32 freigabeabhängige Kernfälle bewusst übersprungen. Eigene echte Ablehnung durch die geschlossene öffentliche Sperre. Kein Ersatz für den freigegebenen Testlauf. |
| `cd app && npm test` | 711 normale Tests bestanden. Integration ohne Starter übersprungen; deren Abnahme steht separat darüber. |
| `node scripts/test-festschreibung-isolated.mjs --rc-kern --testNamePattern='rechecks archived originals'` | Der zuletzt ergänzte Original-Importtest bestanden: USD, fehlende Währung und RC-Hinweis trotz verfälschtem altem DTO. 176 andere Fälle gezielt nicht wiederholt. Keine neuen Belege durch die abgewiesenen Importe. |
| `cd app && ./node_modules/.bin/vitest run src/modules/expenses/beleg-form-input.test.ts` | Abschließend 23 Tests bestanden, einschließlich neuem Fall zur erneuten Modusbestätigung. |
| `cd app && ./node_modules/.bin/tsc --noEmit --incremental false` | Nach den letzten Codeänderungen bestanden. |
| Gezieltes ESLint | Alle geänderten TS/TSX-Dateien in expenses, contacts, einvoice, journal, RC-Integration und vier betroffenen Seitenbereichen bestanden. |
| `node scripts/build-rc-hook.mjs --check` | Kern und PB-Generat einschließlich Decimal unverändert konsistent. |
| `node --check scripts/test-rc-ui-isolated.mjs`, `node --check pocketbase/pb_migrations/1730002900_kontakt_ausgabensteuerstandard.js`, `git diff --check` | Bestanden. |

Die letzte kleine UI-Anpassung setzt beim erstmaligen Einblenden der
Rechnungssteuerfelder für KU-RC den Satz auf 0 und verlangt nach Moduswechsel
eine erneute Bestätigung. Sie wurde durch Typecheck, Lint und Formulartest geprüft;
der bereits erfolgreiche Browserablauf wurde danach nicht komplett wiederholt.

#### Isolierter Browserlauf

`scripts/test-rc-ui-isolated.mjs` startet eine eigene PB 0.39.10 mit leerem tmpfs,
einer temporären Kopie der Hooks und einer App-Kopie ohne `.env`. Nur in diesen
Kopien wird die Sperre geöffnet. Zwei synthetische Firmen, EU-/US-Lieferanten
und ein Testkonto werden angelegt. Alle Bindungen sind Loopback, Jobs aus.
Der Starter beendet die Sitzung spätestens nach 30 Minuten und entfernt Container
samt temporärem Bestand. Die Bereinigung wurde abschließend geprüft.

Im Browser ausgeführt und beobachtet:

- EU-Vorschlag unter KU übernommen, sichtbarer KU-Hinweis, Beleg über echte Action
  angelegt und festgeschrieben. 19,33 EUR Grundlage/Zahlbetrag, 3,67 EUR Schuld,
  0,00 EUR Vorsteuer. Leistung Januar, Rechnung Februar, Zahlung März;
  Steuerdatum bleibt 31. Januar. Detailansicht zusätzlich visuell geprüft.
- Drittland unter Regelbesteuerung: 3,67 EUR Schuld und bei voller Berechtigung
  3,67 EUR Vorsteuer in der Vorschau. Wechsel auf ausgeschlossenen Abzug ergibt
  0,00 EUR Vorsteuer. Steuerdatum 3. Februar statt Zahlungsdatum 5. März.
- Teilbezahlt gespeichert: deutliche Sperrmeldung und deaktivierter Abschluss.
  Danach auf vollständig bezahlt geändert, gespeichert und festgeschrieben.
- Widersprüchliche Rechnungs-USt erzeugt eine Vorschaufehlermeldung. Lieferantenwechsel
  im bestehenden Entwurf überschreibt dessen Drittlandswahl nicht.
- Journalnavigation erreichbar. Die Korrekturoperation wurde durch die echte
  Persistenzsuite geprüft; kein vollständiger Korrektur-Browserablauf durchgeführt.

Temporäre Belege hießen `RC UI EU KU 19,33` und `RC UI US Regelbesteuerung`.
Die übrigen Kombinationen, Vorauszahlung, manipulierte Eingaben und Kontaktänderung
sind durch Unit-/PB-Tests abgedeckt, nicht sämtlich zusätzlich per Browser.
Der erste UI-Starterversuch scheiterte am Sandboxzugriff; ein weiterer Start
scheiterte vor dem ergänzten `--dev`. Der oben beschriebene Lauf war erfolgreich.
Bekannte nicht blockierende Entwicklungswarnungen: Middleware-Konvention,
React-`encType` am vorhandenen Action-Formular, Smooth-Scroll-Hinweis und Vite-Konfiguration.
Kein Produktionsbuild, Deployment, Push oder Zugriff auf Produktivdaten.

#### Übergabe an Abschnitt 3

Abschnitt 3 ist auf diesem Stand startfähig und bleibt ein eigener Auftrag.
Er muss `rc_steuerdatum` unabhängig vom Abflussdatum abfragen, Schnappschüsse
vorzeichenrichtig aggregieren, KU berücksichtigen, Kennziffern ausgeben und die
XML-/DATEV-/Journal-/Archivexportgrenzen abschließen. Auch die Ausgabespalten des
optionalen Kontaktstandards sind noch nicht erweitert. Normale Geldbeträge bleiben
unverändert; RC-Schuld erzeugt keine Finanzamtszahlung. Reporting und Exporte
wurden in Abschnitt 2 nicht implementiert oder freigegeben.

Die öffentliche Sperre bleibt in Next und PB aktiv. Kein Produktionsrollout und
keine Migration realer Daten. Abschnitt 2 endet mit dem gezielten lokalen Commit;
Abschnitt 3 wurde nicht begonnen. Keine weiteren Tasks oder Automationen angelegt.

### Abschnitt 3: Abschlussstand vom 8. September 2026

Abschnitt 3 ergänzt eine eigene, vollständig paginierte Journalabfrage nach
`rc_steuerdatum`. Normale Buchungszeilen und RC-Zeilen werden anhand der Journal-ID
vereinigt; fehlende Storno-Originale werden auch außerhalb der Periode geladen.
Die Aggregation verwendet ausschließlich den unveränderbaren RC-Schnappschuss.
Kontakt- oder Firmenänderungen berechnen historische Fälle nicht neu.

Die UStVA führt Kz 46/47, 84/85 und 67. Kz 67 enthält nur gespeicherte
abziehbare RC-Vorsteuer und wird nicht in Kz 66 aufgenommen. RC-Grundlagen gehen
nicht in Kz 81/86 ein. Kz 83 berücksichtigt RC-Schuld abzüglich RC-Vorsteuer.
Unter § 19 bleiben eigene Umsätze und allgemeine Vorsteuer gesperrt; eine Periode
mit RC-Schnappschuss zeigt dagegen den begrenzten Arbeitsfall und die Steuerschuld.
Das Regelbesteuerungs-Dashboard verwendet für seine USt-Zahllast dieselbe
Steuerperiodenmenge. EÜR, BWA, Geldsummen, Verlauf und §-19-Wächter bleiben am
Buchungsdatum und erzeugen keine zusätzliche Geldbewegung.

Der vorhandene XML-Serializer wurde erweitert und auf 2026 sowie amtliche Monats-
und Quartalszeiträume begrenzt. Journal-CSV und Belegarchiv-Metadaten enthalten
RC-Steuerdatum, Vorgang, Kennziffernwerte und den vollständigen Schnappschuss;
Originaldateien bleiben unverändert. DATEV light lehnt jeden betroffenen Zeitraum
vollständig ab und verweist auf den Journal-CSV. Es gibt keine still ausgelassenen
RC-Zeilen und keinen als vollständig bezeichneten Teilexport.

Ausgeführt wurden:

- `npm test`: 60 Testdateien bestanden, 728 Tests bestanden; fünf Dateien bzw.
  145 umgebungsabhängige Tests in diesem Lauf übersprungen.
- `node scripts/test-festschreibung-isolated.mjs --rc-kern`: fünf Dateien,
  179 echte Tests bestanden, temporäre RC-Freigabe nur in den Testkopien.
- `node scripts/test-festschreibung-isolated.mjs`: fünf Dateien, 145 Tests
  bestanden und 34 freigabeabhängige Tests erwartungsgemäß übersprungen;
  produktive Sperre blieb geschlossen. Beide Läufe nutzten PocketBase 0.39.10,
  synthetische Daten und löschten Container samt tmpfs danach.
- TypeScript ohne Emit, gezieltes ESLint, `build-rc-hook.mjs --check` und der
  Docker-Produktionsbuild bestanden.
- Isolierter Browserablauf: EU-RC unter Regelbesteuerung von Beleg über
  Festschreibung und Journal bis Januar-UStVA mit Kz 46/47/67; Drittlands-RC
  unter § 19 bis Februar-UStVA mit Kz 84/85, Kz 67 null und 38,00 EUR Zahllast.
  Beide Buchungsdaten lagen später. Die DATEV-Route antwortete für den
  RC-Zeitraum vollständig mit HTTP 400.

Die Kennziffern und Ausgabeeinheiten sind am BMF-Vordruck 2026 belegt. Nach der
vollständigen lokalen Abschlussprüfung ist Reverse Charge öffentlich freigegeben.
`RC_PUBLIC_ENABLED=true` steht in der Next-Quelle und im über den vorgesehenen
Generator erzeugten PocketBase-Hook. Der Generator-Check bestätigt den
bytegleichen Rechenkern samt Decimal-Laufzeit und Lizenz.

Zettelruhe hat keine direkte ELSTER-Schnittstelle. Die Anwendung erzeugt nur den
lokalen UStVA-XML-Export. Es gab keinen ELSTER-Versand, keine amtliche
Zertifizierung, keinen ERiC- oder Mein-ELSTER-Import und keine Registrierung für
einen ELSTER-Entwicklerzugang. Eine amtliche ELSTER-Entwicklerfreigabe ist deshalb
nicht Teil dieses Projektschritts. Die nächste Abnahmestufe ist der Test-VPS.
