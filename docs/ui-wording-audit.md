# UI-Wording-Audit Zettelruhe

> Umsetzungshinweis, 2026-09-12: Die Punkte mit Priorität Hoch und Mittel wurden im UI umgesetzt. Fachlich offene oder bewusst unveränderte Punkte sind im Abschlussbericht des Umsetzungsauftrags festgehalten.

## Kurz-Zusammenfassung

- Untersuchte relevante Dateien: **113 UI-Dateien (`.tsx`) in `app/src/app`, `app/src/components`, `app/src/modules`) plus 9 zentrale UI-Text-Zugriffspunkte in `.ts` (`labels.ts`/`types`/Export-/Import-Helfer mit UI-Strings).
- Gefundene auffällige Texte: **56**.
- Häufige Problemtypen:
  1. technische Fachtermini ohne Kontext (z. B. `Parse`, `Festschreiben`, `Matching`, `stiller Auto-Match`)
  2. inkonsistente Benennung gleicher Aktionen (`Entwurf speichern` vs `Entwurf anlegen`, `Festschreiben` vs `Speichern`)
  3. lange Hilfetexte mit unnötig hoher technischer Dichte
  4. teils unklare/fehlerhafte Formulierungen (Rechtschreibung/Lesbarkeit)
- Besonders inkonsistent verwendete Begriffe:
  - `Beleg` / `Rechnung` / `Dokument` / `Datei`
  - `Entwurf` / `Speichern` / `Festschreiben`
  - `Import` / `Hochladen` / `Upload`
  - `Kunde` / `Lieferant`
  - `Lesezugriff` / `Nur lesen` / `keine Änderungen`
- Übergreifende Empfehlungen:
  - für Endanwender konsequent in Prozesssprache sprechen („Beleg anlegen“, „belegen“, „Daten sichern/auslesen“)
  - „Finalität“ immer klar trennen: Entwurf vs. abgeschlossener Beleg, statt beides in einem „Speichern“-Button zu verstecken
  - technisch aufgeladene Begriffe nur verwenden, wenn sie für Anwender wirklich genutzt werden
  - kurze Erklärungen vorangestellt, Details im Hilfetext (nicht in jedem Kopf-/Button-Label)

---

## Bereich: Globales Layout, Navigation, Setup / Zugriff

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| App-Layout | `/Users/kf/zettelruhe/app/src/app/app/layout.tsx` | `Für dieses Login liegt keine Mitgliedschaft vor. Bitte die Eigentümer:in um eine Einladung.` | Unvollständige Formulierung, klingt wie Halbsatz; „Einladung“ nicht als klare Aktion formuliert. | `Sie haben noch keine Mitgliedschaft in dieser Firma. Bitte bitten Sie die Eigentümer:in um eine Einladung.` | Mittel |
| App-Layout | `/Users/kf/zettelruhe/app/src/app/app/layout.tsx` | `Kein Zugang zu einer Firma` | Sehr technisch und unspezifisch. | `Sie haben noch keinen Zugriff auf eine Firma.` | Niedrig |
| App-Hauptbereich | `/Users/kf/zettelruhe/app/src/app/app/page.tsx` | `Keine Firma gefunden. Bitte Setup erneut durchlaufen oder Support prüfen.` | Unscharf, „Setup erneut durchlaufen“ klingt technisch; „Support prüfen“ ist passiv und unklar. | `Es ist noch keine Firma eingerichtet. Bitte schließen Sie das Setup ab oder wenden Sie sich an den Support.` | Mittel |
| App-Navigation | `/Users/kf/zettelruhe/app/src/components/app-nav.tsx` | `Alle öffnen` / `Alle schließen` | Als reine UI-Steuerung okay, aber ohne Kontext; für Screenreader/kleine Nutzerinnen/Anwender nicht eindeutig. | `Alle Menüpunkte anzeigen` / `Menü einklappen` | Niedrig |
| App-Navigation | `/Users/kf/zettelruhe/app/src/components/app-nav.tsx` | `Nur Favoriten` | Funktionale Kurzbezeichnung ohne Kontext, nicht deutlich als Filterangabe. | `Nur Favoriten anzeigen` | Niedrig |
| App-Navigation | `/Users/kf/zettelruhe/app/src/components/app-nav.tsx` | `Keine Favoriten. Stern an einem Eintrag setzen.` | Hinweis ist knapp und etwas befehlshaft; „Stern“ nicht als verbundene UI-Metapher erklärt. | `Noch keine Favoriten vorhanden. Tippen Sie auf den Stern neben einem Punkt, um ihn als Favorit zu markieren.` | Mittel |
| Shell | `/Users/kf/zettelruhe/app/src/components/app-shell.tsx` | `Lesezugriff auf diese Firma — Änderungen sind nicht erlaubt.` | Fachsprache und harte Negation ohne Nutzwert. | `Sie haben nur Leserechte in dieser Firma. Änderungen sind in dieser Ansicht deaktiviert.` | Niedrig |
| Navigationseintrag | `/Users/kf/zettelruhe/app/src/components/app-shell.tsx` | `Export` (Label) | Als Eintrag im Hauptmenü technisch kurz; eher Nutzersprache fehlt. | `Daten sichern` (oder `Daten exportieren`, falls technische Exportfunktion gewünscht) | Mittel |

## Bereich: E-Rechnungen (Upload, Parsing, Ergebnis)

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| E-Rechnung Import | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/neu/page.tsx` | `Originaldatei wird revisionssicher archiviert und geparst. Bei Parse-Fehler bleibt die Datei trotzdem erhalten.` | Fachlich schwer zugänglich (`geparst`), doppelt kompliziert; Grammatik schwer lesbar. | `Die Datei wird sicher gespeichert. Wir lesen sie automatisch aus. Wenn das nicht klappt, bleibt die Datei trotzdem erhalten.` | Hoch |
| E-Rechnung Import | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/neu/page.tsx` | `Hochladen und parsen` | Veralteter Anglizismus + Fachbegriff „parsen“. | `Rechnung auslesen` (Button) | Hoch |
| E-Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/page.tsx` | `Parse` (Filterwert/Spalte) | Unklar für Nicht-Entwickler. | `Auslesestatus` | Hoch |
| E-Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/page.tsx` | `Nach Nummer, Lieferant:in, Status oder Parse-Ergebnis filtern.` | Zu lange Formulierung, `Parse` ist technisch, `Lieferant:in` inkonsistent zu anderen Stellen (`Lieferantin`/`Lieferant`). | `Suchen nach Nummer, Kontakt oder Auslesestatus.` | Mittel |
| E-Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/page.tsx` | `Geparst` | Technische Kurzform statt verständlicher Statussprache. | `Ausgelesen` | Hoch |
| E-Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/page.tsx` | `Parse-Fehler` | Für Fachnutzer brauchbar, für Anwender zu technisch und negativ. | `Einlesefehler` | Hoch |
| E-Rechnung Detail | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/[id]/page.tsx` | `Geparste Felder` | Unpräzise und technisch. | `Ausgelesene Felder` | Mittel |
| E-Rechnung Detail | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/[id]/page.tsx` | `Parse-Fehler` | Ist oft als Statusetikett; ohne Handlungsbezug. | `Einlesefehler` | Mittel |
| E-Rechnung Detail | `/Users/kf/zettelruhe/app/src/app/app/e-rechnungen/[id]/page.tsx` | `Das Original ist trotzdem archiviert. XML hochladen oder Beleg manuell anlegen.` | „archiviert“ ist intern-jargonlastig; Reihenfolge der Optionen nicht klar. | `Die Datei bleibt gespeichert. Sie können jetzt eine XML-Datei nachladen oder den Beleg manuell anlegen.` | Mittel |
| E-Rechnung-Parsing | `/Users/kf/zettelruhe/app/src/modules/einvoice/actions.ts` | `Beleg-Entwurf konnte nicht angelegt werden.` | Fehlermeldung ist korrekt, aber im UI-Kontext fehlt Kontext „warum/was jetzt tun“. | `Beleg konnte nicht angelegt werden. Bitte prüfen Sie die Datei oder laden Sie sie erneut hoch.` | Mittel |

## Bereich: Belege (Ausgaben/Einnahmen, Entwurf, Festschreiben)

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Belege-Start | `/Users/kf/zettelruhe/app/src/app/app/belege/page.tsx` | `Ausgaben und Einnahmen mit Datei — Festschreibung schreibt ins Buchungsjournal.` | „Festschreibung“ und „Buchungsjournal“ ohne kurze Nutzerauswirkung. | `Ausgaben und Einnahmen mit Beleg: Als Entwurf speichern und danach buchen.` | Mittel |
| Belege-Start | `/Users/kf/zettelruhe/app/src/app/app/belege/page.tsx` | `Ausgaben und Einnahmen mit Datei — Festschreibung schreibt ins Buchungsjournal.` (Wiederverwendung) | Gleiche Aussage auf mehreren Stellen, aber im UI nicht auf das konkrete Ergebnis bezogen. | Vereinheitlichen mit obigem Belegtext überall. | Niedrig |
| Beleg-Neuanlage | `/Users/kf/zettelruhe/app/src/app/app/belege/neu/page.tsx` | `Zuerst als Entwurf speichern, optional Datei anhängen, dann` | Satzfragment ohne klaren Abschluss im UI-Kontext. | `Erstellen Sie zuerst einen Entwurf. Eine Datei können Sie jederzeit nachtragen.` | Mittel |
| Beleg-Neuanlage | `/Users/kf/zettelruhe/app/src/app/app/belege/neu/page.tsx` | `Entwurf` (CardTitle) | `Entwurf` ist alleinstehend und ohne Kontext. | `Beleg als Entwurf anlegen` oder `Neuer Beleg (Entwurf)` | Niedrig |
| Beleg-Detail | `/Users/kf/zettelruhe/app/src/app/app/belege/[id]/page.tsx` | `Entwurf — editierbar bis zur Festschreibung.` | Fachbegriff als Teil eines Satzes ohne konkrete Benutzeraktion. | `Sie können den Beleg bis zur Buchung noch bearbeiten.` | Mittel |
| Beleg-Detail | `/Users/kf/zettelruhe/app/src/app/app/belege/[id]/page.tsx` | `Festschreibung gesperrt: {rcError} Ein Entwurf verschiebt keine Erklärungspflicht.` | Satz ist stufig aufgebaut; die zweite Aussage („Erklärungspflicht“) wirkt intern. | `Sie können diesen Beleg noch nicht buchen: {rcError}` | Mittel |
| Beleg-Formular | `/Users/kf/zettelruhe/app/src/modules/expenses/beleg-form.tsx` | `Wird als Entwurf gespeichert. Festschreibung erfolgt...` | Fachbegriff „Festschreibung“ für Hauptnutzer unklar; semantischer Sprung. | `Der Beleg bleibt im Entwurfsstatus. Erst beim Buchen wird er abgeschlossen.` | Mittel |
| Kassenbuch | `/Users/kf/zettelruhe/app/src/app/app/kassenbuch/neu/page.tsx` | `Wird mit Speichern festgeschrieben und ins Buchungsjournal` | „Speichern“ als Abschlussaktion ohne Prozessklarheit, sehr technisch. | `Mit Speichern wird der Eintrag gebucht.` | Mittel |
| Kassenbuch | `/Users/kf/zettelruhe/app/src/modules/cash/kassenbuch-form.tsx` | `Mit Speichern wird der Eintrag festgeschrieben, erhält` | Fachbegriff + lange Satzkette, schwer verständlich. | `Mit Speichern wird der Kassenbuch-Eintrag abgeschlossen und im Journal geführt.` | Mittel |
| Kassenbuch | `/Users/kf/zettelruhe/app/src/app/app/kassenbuch/neu/page.tsx` | `Festschreiben` (CardTitle) | Nur als Buttontext, keine Nutzerbedeutung, klingt fachintern. | `Abschließen` oder `Buchen` | Hoch |
| Beleg-Formular | `/Users/kf/zettelruhe/app/src/modules/expenses/beleg-datei-input.tsx` | `Fotos werden vor dem Speichern` | Verweist auf technischen Prozess, nicht auf Nutzerhandlung bei Upload-Limit. | `Fotos werden vor dem Speichern verarbeitet` + ggf. „beim Hochladen verkleinert“ | Niedrig |

## Bereich: Rechnungen (Erfassung, Vorschau, Versand/Status)

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/page.tsx` | `Freie Rechnungen — Entwurf mit Vorschau, bei Festschreibung Nummer, Original-PDF und Buchungsjournal.` | Satz ist technisch, sehr dicht, nutzt `Festschreibung` als Verb ohne Erklärung. | `Rechnungen als Entwürfe erfassen. Beim Buchen erhalten sie Rechnungsnummer, Original-PDF und Buchungsjournal.` | Mittel |
| Rechnungen-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/page.tsx` | `Entwurf anlegen und bei Festschreibung Nummer, PDF und Buchungsjournal erzeugen.` | Redundanz und Fachsprache, unklares Ergebnis für Nutzer. | `Rechnung als Entwurf speichern. Erst beim Buchen werden Nummer und PDF erstellt.` | Hoch |
| Rechnung-Status | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/page.tsx` | Status `Entwurf` | Terminologie konsistent, aber in Aktionen teils anderes Mapping. | Beibehalten, nur in UI-Hilfetext als „Vorlage“ erklären. | Niedrig |
| Rechnung-Detail | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/[id]/page.tsx` | `Entwurf bearbeiten` | Gut, aber besser klarer als Aktionsziel benannt. | `Rechnung bearbeiten (Entwurf)` | Niedrig |
| Rechnung-Detail | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/[id]/page.tsx` | `Speichern aktualisiert den Entwurf. Die Vorschau zeigt den zuletzt gespeicherten Stand. Festschreiben vergibt die Nummer,` | Lange Satzkette; „Festschreiben“ wieder technisch. | `Speichern aktualisiert den Entwurf. Erst beim Buchen werden Nummer, PDF und Journal erstellt.` | Mittel |
| Rechnung-Detail | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/[id]/page.tsx` | `Vorschau / Druck (Entwurf)` | Typografisch und sprachlich schwer; Klammer als Zusatz verwirrt. | `Vorschau (Entwurf)` | Niedrig |
| Rechnung-Detail | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/[id]/page.tsx` | `Festschreiben` (Button/CardTitle) | Fachbegriff, ohne nutzergerechte Erklärung in Aktion. | `Buchen` | Hoch |
| Rechnung-Detail | `/Users/kf/zettelruhe/app/src/app/app/rechnungen/[id]/page.tsx` | `Entwurf löschen` | Deutlich; in manchen Bereichen nur „Löschen“. | Konsistent zu globaler Form „Entwurf entfernen`?` | Niedrig |
| Rechnungs-Form | `/Users/kf/zettelruhe/app/src/modules/sales/rechnung-form.tsx` | `Für die Festschreibung erforderlich. Im Entwurf optional speicherbar.` | „Festschreibung“ ohne Nutzerbild; „speicherbar“ Grammatik. | `Notwendig zum Buchen. Im Entwurf können Sie diese Angaben zuerst unvollständig speichern.` | Mittel |
| Rechnung-Form | `/Users/kf/zettelruhe/app/src/modules/sales/rechnung-form.tsx` | `{mode === "create" ? "Entwurf anlegen" : "Entwurf speichern"}` | Zwei Aktionen für gleichen Zustand; Inkonsistenz bei neuen/aktualisieren. | `Rechnung speichern` + klarer Statusindikator „Neuer Entwurf“ | Niedrig |

## Bereich: Angebote

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Angebote-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/angebote/page.tsx` | `Noch nicht verbindliche Verkaufsdokumente — Entwurf mit Vorschau, beim Senden Nummer und Original-PDF (ohne Buchungsjournal, ohne SMTP-Pflicht).` | Sehr technisch, `SMTP` ist intern. | `Angebote im Entwurf erstellen und prüfen. Beim Versenden wird eine Nummer vergeben und ein PDF erzeugt.` | Mittel |
| Angebote-Detail | `/Users/kf/zettelruhe/app/src/app/app/angebote/[id]/page.tsx` | `Entwurf — editierbar bis zum Senden. Keine Angebotsnummer vor dem Senden.` | Gute Aussage, aber Satz wirkt technisch; „Senden“ ist Geschäftsbegriff, klarer mit Statusbezug. | `Der Entwurf bleibt bis zum Versand änderbar. Vor dem Versand gibt es noch keine Angebotsnummer.` | Mittel |
| Angebote-Detail | `/Users/kf/zettelruhe/app/src/modules/sales/angebot-form.tsx` | `Für das Senden erforderlich. Im Entwurf optional speicherbar.` | Technische Verkürzung ohne Nutzerwirkung. | `Das Feld ist für den Versand erforderlich. In Entwürfen können Sie es vorab speichern.` | Mittel |
| Angebote-Neuanlage | `/Users/kf/zettelruhe/app/src/app/app/angebote/neu/page.tsx` | `Zuerst als Entwurf speichern, dann senden (Nummer + PDF). Kein` | Satzfragment (technisch ausgelassen). | `Erstellen Sie zuerst einen Entwurf, danach senden Sie das Angebot und erhalten Nummer + PDF.` | Hoch |
| Angebote-Job/Erzeugung | `/Users/kf/zettelruhe/app/src/modules/jobs/mail.ts` | `Angebots-Entwurf kann nicht per Mail versendet werden. Bitte zuerst senden (Nummer + PDF).` | „Bitte zuerst senden“ tautologisch nach Button „Senden“ und kann verwirrend sein. | `Der Angebotsentwurf kann nicht versendet werden. Bitte senden Sie ihn zuerst.` | Niedrig |

## Bereich: Angebot / Rechnung / Kontakt / Bankdaten / Eindeutigkeit der Labels

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Kontakte | `/Users/kf/zettelruhe/app/src/modules/contacts/kontakt-form.tsx` | `Nur ein Vorschlag bei neuen Ausgabenbelegen. Die endgültige Auswahl erfolgt am Beleg.` | Text ist etwas lang; „Ausgabenbelegen“ ist intern jargonie-lastig. | `Hinweis: Die Ermittlung ist eine Vorschau. Die endgültige Zuordnung machen Sie direkt im Beleg.` | Mittel |
| Kontakte | `/Users/kf/zettelruhe/app/src/modules/contacts/kontakt-form.tsx` | `Fremde Nummer als Stammdatum. Nach dem Speichern beim BZSt prüfbar` | Unvollständig/unklar, Abkürzung `BZSt` ungeeignet als allgemeiner UX-Text. | `Eine Fremdnumer kann als Stammdatum benutzt werden. Danach prüfen wir diese bei BZSt.` | Fachlich prüfen |
| Kontakte | `/Users/kf/zettelruhe/app/src/modules/sales/angebot-form.tsx` | `Entfernen` (Button) | Als knappe CTA oft ohne Kontext, bei mehreren Listenelementen mehrdeutig. | `Position entfernen`/`Kontakt entfernen` je Kontext ergänzen | Niedrig |
| Banken | `/Users/kf/zettelruhe/app/src/modules/banking/bankkonto-form.tsx` | `Aktiv (Import erlaubt)` | Klammerkonstruktion wirkt technisch und nicht direkt. | `Aktiv — Import möglich` oder `Aktiv für Importe` | Niedrig |
| Kontoauszug | `/Users/kf/zettelruhe/app/src/app/app/kontoauszug/page.tsx` | `Importierte Bankbewegungen zuordnen (Matching → Zahlung). Kein stiller Auto-Match — Vorschlag annehmen oder Rechnung wählen.` | `Matching` / `stiller Auto-Match` sind technisch; „stiller“ ist sprachlich fragil. | `Importierte Bankbewegungen zuordnen. Keine automatische Zuordnung: Vorschlag übernehmen oder Rechnung auswählen.` | Hoch |
| Modul-Einträge | `/Users/kf/zettelruhe/app/src/modules/travel/actions.ts` | `Speichern fehlgeschlagen.` | Neutral, aber in einer klaren Fehlermeldung Nutzerführung fehlt. | `Speichern ist fehlgeschlagen. Bitte prüfen Sie die Eingaben und versuchen es erneut.` | Mittel |
| Kassenbuch | `/Users/kf/zettelruhe/app/src/modules/cash/invariants.ts` | Kommentar/Invariant-Text enthält „keine stillen Änderungen“ | `stillen` kann verstanden werden als still → fehlerhafte Formulierung, wenn UI-Text daraus generiert wird. | `keine stillen (automatischen) Änderungen` | Fachlich prüfen |

## Bereich: Importe / Exporte / Katalog / Kontakte-Upload

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Kontakte Import | `/Users/kf/zettelruhe/app/src/app/app/kontakte/import/page.tsx` | `CSV-Import Kontakte` | Reihenfolge ungewöhnlich, nicht in vollem Satz/Instruktionscharakter. | `Kontakte aus CSV importieren` | Niedrig |
| Kontakte Import | `/Users/kf/zettelruhe/app/src/app/app/kontakte/import/page.tsx` | `Importieren` (Submit) | Ohne Objekt, kann mehrere Bedeutungen haben. | `Kontakte importieren` | Niedrig |
| Katalog-Import | `/Users/kf/zettelruhe/app/src/app/app/katalog/import/page.tsx` | `CSV-Import Katalog` | Sprachlich hart und nicht an Leitfaden der normalen Nutzer gebunden. | `Katalog aus CSV importieren` | Niedrig |
| Katalog-Import | `/Users/kf/zettelruhe/app/src/app/app/katalog/import/page.tsx` | `Importieren` (Submit) | Fehlender Kontext. | `Katalog importieren` | Niedrig |
| Katalog-Übersicht | `/Users/kf/zettelruhe/app/src/app/app/katalog/page.tsx` | `CSV-Import` / `CSV-Export` | Technische Abkürzung ohne erklärenden Kontext; im UI eher als Aktionstext. | `Katalog importieren` / `Katalog exportieren` | Niedrig |
| Exportseite (Routen/Repo-Fehler) | `/Users/kf/zettelruhe/app/src/modules/reporting/repository.ts` | `Exportdaten haben sich während des Exports geändert. Bitte Export erneut starten.` | Wiederholung und schwerer Satzbau; kann Nutzer verunsichern. | `Die Daten haben sich während des Exports geändert. Bitte starten Sie den Export neu.` | Mittel |
| Exportseite (Routen/Repo-Fehler) | `/Users/kf/zettelruhe/app/src/modules/reporting/repository.ts` | `Exportdaten konnten nicht vollständig gelesen werden. Bitte Export erneut starten.` | Direkt hilfreich, aber unpräzise; warum? | `Der Export konnte nicht vollständig gelesen werden. Bitte versuchen Sie es erneut.` | Niedrig |

## Bereich: Fahrten / Wiederkehrend / Sonstige Hinweise

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Fahrten | `/Users/kf/zettelruhe/app/src/app/app/fahrten/[id]/page.tsx` | `Rechnungs-Entwurf.` | Einzelnes Fragment ohne Aktionserläuterung. | `Rechnungsentwurf` (falls Label) oder `Rechnungsentwurf anzeigen` | Niedrig |
| Wiederkehrend | `/Users/kf/zettelruhe/app/src/modules/sales/wiederkehrend-form.tsx` | `Für die Erzeugung eines Rechnungs-Entwurfs erforderlich.` | Fachinternes „Erzeugung eines ...“ kann in UX zu lang sein. | `Pflichtfeld für die nächste Rechnungsvorlage.` | Niedrig |
| Nutzerverwaltung | `/Users/kf/zettelruhe/app/src/app/app/nutzer/page.tsx` | `Entfernen` (Bestätigung/Action) | Unklarer Gegenstand, mehrere Buttons gleich benannt. | `Mitglied entfernen` / `Nutzer entfernen` je Kontext | Mittel |

## Bereich: Hilfetexte & Datenintegrität (ADR-/UI-gebundene Strings)

| Bereich / Seite | Datei | Aktueller Text | Problem | Vorschlag | Priorität |
|---|---|---|---|---|---|
| Modul-Katalog/Beleg-Datei | `/Users/kf/zettelruhe/app/src/modules/expenses/beleg-datei-input.tsx` | `BELEG_DATEI_MAX_ANZAHL` (kontextbezogen: `{max} Dateien` + Hinweis) | Anzahl und Grenzwert wird nur technisch dargestellt, evtl. ohne Bezug. | `max. {n} Belege pro Ausgabenbeleg` (detaillierter Hinweis) | Niedrig |
| USt-ID-Validierung | `/Users/kf/zettelruhe/app/src/modules/ustid/status.ts` | `Bei der Verarbeitung der Daten aus dem angefragten EU-Mitgliedstaat ist ein Fehler aufgetreten. Ihre Anfrage kann deshalb nicht bearbeitet werden.` | Sehr formell, könnte für Endnutzer vereinfacht werden. | `Beim Prüfen der USt-IdNr. gab es einen Fehler. Bitte versuchen Sie es erneut.` | Niedrig |
| Angebote/Rechnungen Export | `/Users/kf/zettelruhe/app/src/modules/einvoice/send-invariants.ts` | `Ohne Rechnungsnummer keine E-Rechnung (Nummern erst bei Festschreibung).` | Fachbegriff `Festschreibung` und Klammertechnik schwer. | `E-Rechnungen benötigen eine Rechnungsnummer, die erst nach dem Buchen vergeben wird.` | Mittel |

## Nicht berücksichtigt

Die folgenden Bereiche wurden gezielt ausgeschlossen:

- `**/*.test.*` inkl. Beschreibungen
- technische Log- oder Konsolenmeldungen
- API-/Repository-Fehler, die nur im Dev-Kontext auftauchen
- Datenbank-/Collection-Namen, sofern nicht sichtbar im UI
- Entwickler-Doc-Kommentare

## Vorgeschlagene Sprachkonventionen für Zettelruhe

1. **Prozesswörter statt Technik**
   - Primär: `Beleg anlegen`, `Beleg bearbeiten`, `Beleg buchen`, `Vorschau anzeigen`
   - Vermeide: `Erfassen`, `Persistieren`, `Festschreiben`, sofern nicht fachlich zwingend.

2. **Einheitliche Entwurfsbezeichnung**
   - Entwurf-Status intern als `Entwurf` beibehalten, aber Aktionstexte klar trennen:
     - `Speichern` = Entwurf sichern
     - `Buchen` = Abschluss/Endgültig machen

3. **Import/Upload klar trennen**
   - `Upload`/`Hochladen`/`Import` konsistent als:
     - `Datei hochladen` für Dateiauswahl
     - `Daten importieren` für Verarbeitung in Tabelle/Belege

4. **Fehlerkommunikation als Handlungstext**
   - Jeder Fehler textuell mit nächstem Schritt schließen:
     - `Bitte prüfen…` / `Versuchen Sie es erneut` / `Kontaktieren Sie den Support`

5. **Knappe UI-Texte, lange Erklärungen nur bei Bedarf**
   - Überschriften/Button-Labels kurz; ergänzende Erläuterung im Fließtext.

6. **Begriffe konsistent halten**
   - Festlegen und dokumentieren:
     - `Kunde` und `Lieferant:in` konsequent als benutzernahe Rollen verwenden
     - `Datei` nur für echte Dateien, nicht als allgemeiner Sammelbegriff für Belege
     - `Dokument` nur bei PDF/Export-Dokumenten verwenden

7. **Mischsprache vermeiden**
   - Anglizismen nur dort verwenden, wo die Nutzer sie erwarten (`Export`, `PDF`, `CSV`).
   - `Parse`, `Matching`, `Auto-Match`, `on-the-fly` in Anwender-UI vermeiden.

8. **Subjektive Tonalität ruhig und direkt**
   - Keine Befehlsflut, kurze Aufforderungen:
     - `Bitte` sparsam, nicht als Floskeldruck bei jedem Satz.

9. **Aktionen benennen, nicht Status kodieren**
   - Statt `Festschreibung` auf Aktionen: in der UI-Formulierung `Buchung abschließen` oder `Rechnung buchen`.

10. **Technische Grenzen transparent machen**
   - Wenn `stille` Prozesse notwendig (z. B. automatische Zuordnung), nur erklären, was passiert: `Wir schlagen passende Positionen vor. Sie entscheiden final.`
