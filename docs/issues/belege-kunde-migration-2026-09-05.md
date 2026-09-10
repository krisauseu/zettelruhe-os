# Einnahmekontakte in Migration 1730002600, TP-021

Geprüft am 2026-09-05 auf Basis von `32b9789`. TP-021 ist abgeschlossen:
**Fehler bestätigt, geprüfter Bestand nicht betroffen, keine Korrekturmigration
erforderlich.** Keine Änderung an Anwendungslogik oder historischen Migrationen,
keine Datenkorrektur.

## Befund und Entscheidung

Die Originalmigration verletzt die Festschreibungsinvariante. Sie kann den
Kontakt eines festgeschriebenen Einnahmebelegs entfernen, während der
Journalkontakt erhalten bleibt. Reproduziert durch Ausführung der Originaldatei
in einem isolierten JavaScript-Testbestand. Ein Kontakt mit `ist_kunde=true`
wird dagegen mit derselben ID nach `kunde` verschoben. Das erhält die fachliche
Kontaktidentität, ändert aber ebenfalls still einen festgeschriebenen Record.

**Variante A gilt für die zwei geprüften lokalen Backupstände:** keine
Einnahmebelege, keine betroffenen vorhandenen Records, keine festgestellte
Beleg-/Journalabweichung. Eine historische Korrektur ist dort nicht begründet.
Variante C ist durch die Reproduktion ausgeschlossen. Variante B wurde im
verfügbaren Bestand nicht nachgewiesen. Der Betreiber bestätigt für seine kleine
eigene Produktivinstallation, dass auf Basis dieser Ergebnisse keine historische
Datenkorrektur erforderlich ist, und hat den Abschluss beauftragt. Eine erneute
Prüfung der laufenden Produktivinstallation wurde dabei nicht durchgeführt.
Die Prüfgrenzen bleiben dokumentiert; daraus folgt keine offene Aufgabe in TP-021.

## Originalmigration und fachliche Grenzen

Owner ist `pocketbase/pb_migrations/1730002600_belege_kunde.js`.

1. Lädt `belege`; ein Fehler hierbei bricht ab. Fehlt `kontakte` oder scheitert
   dessen Collection-Zugriff, kehrt die Up-Funktion ohne Änderung zurück.
2. Ergänzt bei Bedarf die optionale Relation `kunde` zu `kontakte`, maximal
   ein Kontakt, ohne `cascadeDelete`. Ein vorhandenes Feld wird nicht angepasst.
3. Lädt **alle** Belege aller Firmen, ohne Status-, Zeit- oder Journalfilter.
4. Selektiert genau `richtung === "einnahme"`, nichtleeren `lieferant` und
   leeren `kunde`. Relationswerte werden getrimmt; bei Arrays zählt das erste
   Element. `null`, fehlendes Feld, leerer String und leeres Array gelten als leer.
5. Lädt den Lieferantenkontakt. Ist `Boolean(ist_kunde)` wahr, setzt sie
   `kunde = lieferant`. Sonst bleibt `kunde` leer. Auch **jeder Fehler beim
   Kontaktzugriff** führt zum Leeren, nicht zum Abbruch.
6. Setzt in beiden Fällen `lieferant = ""` und speichert den Beleg. Ein Fehler
   beim Speichern wird nicht abgefangen. Die Tests simulieren keine
   PocketBase-Transaktion und treffen keine Aussage zu deren Rollbackverhalten.

| Fall | Wirkung am Beleg | Wirkung auf vorhandenes Journal |
|---|---|---|
| Einnahmeentwurf, Lieferant ist auch Kunde, Kunde leer | Lieferant nach Kunde verschoben | Keine |
| Einnahmeentwurf, reiner Lieferant oder Kontaktzugriff fehlgeschlagen | Lieferant geleert, Kunde bleibt leer | Keine; ursprünglicher Kontakt am Entwurf geht verloren |
| Festgeschriebene Einnahme, Lieferant ist Kunde | Dieselbe Verschiebung, trotz Festschreibung | Kontakt-ID bleibt bei zuvor passendem Journal gleich |
| Festgeschriebene Einnahme, Lieferant ist kein Kunde oder Zugriff scheitert | Kontakt entfernt, trotz Festschreibung | Bisheriger Journalkontakt bleibt stehen, dadurch Abweichung |
| Beliebiger selektierter Beleg mit Journal-Verweis | Verweis verhindert die Änderung nicht | Journal wird weder gelesen noch geschrieben |
| Einnahme mit vorhandenem Kunden | Vollständig übersprungen, auch bei zusätzlichem Lieferanten | Eine bestehende Abweichung bleibt bestehen |
| Einnahme ohne Lieferant | Übersprungen | Keine |
| Ausgabe, Entwurf oder festgeschrieben | Übersprungen, selbst bei ungewöhnlicher Kundenbelegung | Keine |

Die expliziten Record-Writes betreffen ausschließlich `lieferant` und
gegebenenfalls `kunde`. Unverändert bleiben Beträge, Steuersatz, Richtung,
Kategorie, Konto, Bezeichnung, Daten, Dateien, Belegnummer, Festschreibungsstatus,
Festschreibungszeitpunkt und Journal-Verweis. Das geprüfte Belegschema hat keine
`created`-/`updated`-Felder; es gibt keine projektseitigen PB-Hooks. Lokale
Schemaerweiterungen mit Autodatumsfeldern sind davon nicht abgedeckt.

Kontaktstammdaten und Kategorien werden nicht geschrieben. Die Migration prüft
weder Kontaktfirma noch Lieferantenrolle, Kategorie-Richtung oder
Quellverknüpfung des Journals. Eine schon vorhandene firmenfremde Relation würde
sie deshalb nicht erkennen. Es wurde keine solche Relation im Backup gefunden.

Die Up-Logik ist bei unverändertem Bestand idempotent: Nach dem ersten Lauf
ist `lieferant` leer; ein weiterer Lauf selektiert den Record nicht mehr.
Das stellt einen verlorenen Kontakt nicht wieder her. Die Down-Funktion
entfernt lediglich das Kundenfeld, sofern `removeByName` verfügbar ist; sie
rekonstruiert keine Lieferanten. Ein Downgrade ist kein Reparaturweg.

## Abgleich mit Belegen und Journal

- ADR-0004 und `CONTEXT.md` verbieten stille Änderungen nach Festschreibung.
  ADR-0012 ergänzt die Dateisperre. ADR-0006 verortet Finanz-Writes in Next;
  Migrations-Writes durchlaufen diese Domain-Guards nicht.
- `expenses/repository.ts` lädt bei `updateBeleg` und `deleteBeleg` den Record
  und ruft `assertEntwurfEditable` auf. `festschreibenBeleg` lässt nur einen
  Entwurf ohne Journal-Verweis zu und validiert die Partnerfelder erneut.
  Alte Einnahmen mit Lieferant werden dabei abgewiesen, nicht automatisch geleert.
- Vor TP-019 verwendete `buildJournalInputFromBeleg` immer `beleg.lieferant`
  als Journalkontakt, belegt durch `git show 2eb2d20^:app/src/modules/expenses/invariants.ts`.
  Heute nimmt `belegPartnerId` bei Einnahmen ausschließlich `kunde`, bei
  Ausgaben `lieferant`. Belegliste und Belegdetail nutzen denselben Helfer.
  Der Kontaktverlust kann deshalb auch als leerer Geschäftspartner sichtbar werden.
- `journal/repository.ts` persistiert den Kontakt beim Anlegen. Update und
  Delete sind gesperrt; Storno erzeugt einen neuen Eintrag und übernimmt den
  ursprünglichen Kontakt. Die Migration stößt weder Storno noch Neubuchung an.
- Journalzeilen haben keine eigene Kategorie- oder Belegnummernspalte.
  `buildBuchungstextFromBeleg` nimmt diese Werte in den Buchungstext auf.
  Die Auswertung lädt Kategorien über den Quellbeleg, die ZM Kontakte über
  `JournalEintrag.kontakt`. Kategoriezuordnung und Journalbeträge werden durch
  diese Migration nicht geändert. Beleganzeige und journalbasierte
  Kontaktzuordnung können dennoch unterschiedlich sein.

## Reproduktion und Absicherung

`app/src/modules/expenses/migration-kunde.test.ts` führt die **Originaldatei**
über `node:vm` aus. Nur die PocketBase-Zugriffe sind durch einen vollständig
isolierten Speicherbestand ersetzt. Kein PB-Prozess und kein Next-Server werden
gestartet; es gibt weder Netzwerkzugriff noch Zugangsdaten. Die Fixtures
enthalten ausschließlich synthetische Daten. Vor jedem Lauf wird der komplette
Belegzustand kopiert und nachher feldweise verglichen.

18 Charakterisierungstests decken Entwurf/Festschreibung × ohne/mit Journal ×
Kundenrolle wahr/falsch/Kontaktzugriff fehlgeschlagen ab, außerdem Ausgabe,
vorhandenen Kunden, leeren Lieferanten, Feldanlage und Relationsnormalisierung.
Die Matrix vergleicht den vollständigen Beleg, den gespeicherten Journalkontakt
und die erneute Ausführung. Sie hält den **bekannten Fehler der historischen
Migration** fest und ist keine Freigabe für dieses Verhalten in neuen Migrationen.

Der erste minimale Lauf der Originalmigration schlug bei der Forderung
`assert.deepEqual(after, before)` bewusst fehl:

```text
status: festgeschrieben; journal_eintrag: journal
lieferant: supplier -> leer; kunde: leer -> leer
journal.kontakt: supplier -> supplier
AssertionError: Festgeschriebener Beleg wurde verändert
```

`app/src/modules/expenses/festschreibung.test.ts` ergänzt acht Regressionstests
über die tatsächlichen Expenses- und Journal-Repositories, mit gemocktem
PB-Transport. Sie prüfen blockierte Kontaktänderungen und Löschungen,
Wiederfestschreibung, Altentwürfe mit Lieferant und Entwürfe mit Journal sowie
die konsistente Festschreibung von Einnahme mit Kunde, Ausgabe mit Lieferant
und Einnahme ohne Kontakt. Verbotene Pfade dürfen weder Nummern vergeben noch
Records anlegen, ändern oder löschen. Die bestehenden Journaltests prüfen
Update-/Delete-Sperren und Storno zusätzlich.

Das ist ein Nachweis der Migrationslogik und heutigen Domainpfade, kein
PocketBase-Integrationstest für Save-Validierung, Systemfelder oder Rollbacks.

## Read-only Prüfung der vorhandenen Kopien

Verwendet wurden die bereits in TP-020 dokumentierten Offline-Backups unter
`backups/`. Nur `data.db` wurde in ein privates temporäres Verzeichnis extrahiert.
Beide Archive enthielten keine WAL-/SHM-Dateien. Vor dem ersten SQLite-Zugriff
wurden Herkunft und SHA-256 dokumentiert, die Datenbankkopien mit `mode=ro`
geöffnet. Es wurden keine Belege oder Dateien über Next/PocketBase abgerufen.
Das laufende Docker-Volume und entfernte Systeme wurden nicht untersucht.

| Backup | SHA-256 Archiv | SHA-256 data.db vor und nach Prüfung |
|---|---|---|
| `pb_data-20260905-isolation-before.tar.gz` | `e6d9e6cf8d2c41d9a7811dfd87670dc0028b93ed682a6e621a8b3e30e90eb432` | `cb74142fe0c16f97a20f1d3c80a5483760ea17b98aeb5d60516d397b04bbce93` |
| `pb_data-20260905-isolation-after.tar.gz` | `7cc7073a2499355390ffdee68d65c212cb7d063f0f4f10c05c50e8a27c9dbe52` | `5b1e812f369cd2cfe8a50157525c6203b893e53670f859d512a605592831a2a1` |

**Beide Backups liegen nach 1730002600.** Ihre Namen beziehen sich auf TP-020,
nicht auf den hier untersuchten Kontaktumbau. `_migrations` enthält in beiden
`1730002600_belege_kunde.js`. Sie sind kein Vorher-/Nachher-Paar dieser Migration.

Ergebnis je Backup:

| Merkmal | Anzahl |
|---|---:|
| Belege insgesamt | 4 |
| Einnahmebelege | 0 |
| Ausgabenentwürfe | 3 |
| Festgeschriebene Belege | 1 |
| Belege mit Journal-Verweis | 1 |
| Aktuell durch 1730002600 selektierte Belege | 0 |
| Davon festgeschrieben / mit Journal | 0 / 0 |
| Journalzeilen insgesamt / Quelle Beleg | 18 / 1 |
| Kontakt- oder Quellverweisabweichungen | 0 |
| Abweichende Beträge, Steuersatz, Richtung, Konto oder Daten am verknüpften Paar | 0 |
| Fehlende oder firmenfremde Belegkontakte | 0 |

Technische Fallliste, identisch in beiden Backups:

| Beleg-ID | Richtung / Status | Journal-ID | Kontaktvergleich |
|---|---|---|---|
| `4xa5vomon1sjq6c` | Ausgabe / Entwurf | leer | Kein Journal; beide Partnerfelder leer |
| `nblbnbkpfi6g892` | Ausgabe / Entwurf | leer | Kein Journal; beide Partnerfelder leer |
| `vyho90w7d8cjd6t` | Ausgabe / festgeschrieben | `7t1dwg4lyz5g81r` | Beide Partnerfelder und Journalkontakt leer, konsistent |
| `wqyg21bg073s1uy` | Ausgabe / Entwurf | leer | Kein Journal; beide Partnerfelder leer |

Der vollständige SQL-Zeilenvergleich zwischen beiden Backups ergab identische
`belege` mit vier, `buchungsjournal` mit 18 und `kontakte` mit sechs Records.
`integrity_check` meldete jeweils `ok`. Archiv- und Datenbankhashes blieben bei
der Untersuchung unverändert. **Vorhandene Records geändert: 0.** Es wurden
auch keine Historien zurückgesetzt, Migrationseinträge gelöscht oder Kopien
eines realen Bestands migriert. Die synthetischen Tests sind davon getrennt.

Die vier heute vorhandenen Ausgaben fallen nicht unter die Migration, die
selbst keine Richtung ändert. Die exakte Zahl damals veränderter, später
gelöschter oder als Entwurf weiterbearbeiteter Records ist ohne älteren
Backupstand nicht rekonstruierbar. Insbesondere wäre ein heute kontaktloser
Einnahmeentwurf kein Beweis für eine frühere Kontaktlöschung.

## Wiederholbare Bestandsprüfung

```bash
python3 scripts/audit-belege-kunde.py backups/pb_data-20260905-isolation-before.tar.gz
python3 scripts/audit-belege-kunde.py backups/pb_data-20260905-isolation-after.tar.gz
python3 -B scripts/test-audit-belege-kunde.py
cd app
./node_modules/.bin/vitest run src/modules/expenses src/modules/journal
npm test
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint src/modules/expenses/migration-kunde.test.ts src/modules/expenses/festschreibung.test.ts
```

Das Audit akzeptiert ausschließlich ein Tar-Backup, kopiert Datenbankdateien
in ein privates temporäres Verzeichnis und liest mit `mode=ro` sowie
`PRAGMA query_only=ON`. Manifest und Ergebnis enthalten Hashes, Zähler, IDs und
technische Merkmale, keine Kontaktstammdaten, Bezeichnungen oder Betragswerte.
Es prüft alle Belege, nicht nur noch selektierbare Einnahmen, und zusätzlich
Journal-Rückverweise. Ohne Kundenfeld vergleicht es den historischen Lieferanten
mit dem Journal; mit Kundenfeld verwendet es die heutige Richtungszuordnung.
Es benennt Auffälligkeiten, behauptet aber keine Verursachung durch die Migration.

Exit 2 bedeutet Kandidaten oder Auffälligkeiten: vor einem Update einzeln
prüfen. Exit 0 bedeutet keine aktuellen Treffer, **keinen Beweis einer
unveränderten Historie**. Die anfänglichen manuellen Kopien und Ergebnisse
liegen lokal unter `/private/tmp/zettelruhe-tp021/`; das Audit selbst entfernt
seine temporäre Datenbankkopie nach dem Hashvergleich.

Für andere Bestände bleibt das Audit als wiederverwendbare Prüfung erhalten.
Es liest eine konsistente Backupkopie nach `docs/betrieb.md`. Wenn 1730002600
in einem solchen Bestand noch aussteht,
darf sie bei Treffern nicht ungeprüft automatisch laufen. Eine neue Migration
mit höherer Nummer würde erst **nach** dem möglichen Kontaktverlust laufen
und verhindert diesen nicht. Die hier ergänzten Tests sichern die heutigen
Domainpfade; sie sperren keinen automatischen PocketBase-Migrationslauf.

Falls in einem anderen Bestand bei bereits angewendeter Migration Abweichungen
festgestellt werden, braucht es die genaue
Fallliste und möglichst ein Backup vor TP-019. Ein Journalkontakt allein ist
kein ausreichender Beweis für eine automatische Änderung festgeschriebener
Belege. Erst anhand dieser Belege wäre Variante B mit einem separat
reviewbaren, gezielten und idempotenten Reparaturentwurf zu verfolgen.
Für den hier abgeschlossenen Auftrag ist kein weiterer Prüfschritt erforderlich.
**Keine neue Korrekturmigration erforderlich, implementiert oder ausgeführt.**

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| Expenses und Journal | 8 Testdateien, 103 Tests bestanden |
| Vollständige Unit-Suite | 53 Testdateien, 617 Tests bestanden |
| Typecheck | Bestanden |
| Audit-Regressionsfälle auf synthetischem SQLite | 5 Tests bestanden |
| Beide vorhandenen Offline-Backups | Exit 0, `integrity_check=ok`, keine Hashänderung |
| ESLint der beiden neuen TS-Testdateien | Bestanden |

Kein App-Build oder Browserlauf erforderlich, da keine Oberfläche oder
Produktionslogik geändert wurde. Keine Dependencies, Deploymentdateien oder
fachfremden Lint-Probleme geändert. Kein Commit oder Push.
