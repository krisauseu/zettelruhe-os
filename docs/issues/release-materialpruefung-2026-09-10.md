# Arbeitsmaterialien vor dem Release

Geprüft am 2026-09-10 im lokalen Checkout auf `f48be21` mit vorhandenen
Auditänderungen. Keine Inhalte an einen OCR-Dienst hochgeladen. Keine vertraulichen
Werte in Prüfprotokolle oder Chat übernommen.

## Konkreter Befund

Die versionierte Datei
`docs/issues/2026-08-18_09-34-42_bunq-Transaktionsübersicht.sta` enthält
Kontokennungen und einzelne finanzielle Geschäftsvorfälle. Sie ist kein als
synthetisch gekennzeichneter Testbeleg. Der Screenshot
`docs/issues/kontoauszug-issue.png` enthält ebenfalls Kontokennungen und
Finanzinformationen. Weitere Kontokennungen wurden lokal in
`layout-rechnung.png`, `logo-pdf-screenshot.png` und
`logo-weit-pdf-screenshot.png` erkannt. Die Inhalte werden hier nicht wiederholt.
Die Kontoauszugsdatei und der Kontoauszug-Screenshot sind spätestens seit Commit
`32b9789` vom 2026-09-05 Bestandteil der Historie.

Die Prüfung umfasste sämtliche versionierten PNG-/JPEG-Dateien, PDF, XML-Fixtures
und MT940-Dateien. Text wurde lokal mit macOS Vision beziehungsweise PDFKit
extrahiert. Eine Suche in den versionierten Textdateien nach privaten
Schlüsselblöcken, GitHub-Tokenformaten und AWS-Zugriffsschlüsseln ergab keinen
Treffer. Dies ist kein vollständiger Geheimnis- oder Rechteaudit der Historie.
OCR kann Inhalte übersehen.

## Änderung im Releasebestand

Die Kontoauszugsdatei, die historischen UI-/Finanzscreenshots unter `docs/issues/`,
`docs/dokumentenlayout-setup-demo.png` und `docs/muster_rechnung.pdf` wurden aus
dem Arbeitsbaum entfernt. Bei den weiteren Bildern und der Muster-PDF lässt sich
anhand des Dateinamens oder vorhandener Mustertexte keine vollständige
Veröffentlichungsfreigabe ableiten. Ihre Entfernung ist vorsorglich; sie werden
nicht pauschal als bestätigte Offenlegung vertraulicher Daten bezeichnet.
Die Testberichte bleiben mit gekennzeichneten Ersatzverweisen erhalten.
Die reine App-Marke und die beiden Geschäftslogo-Referenzen bleiben bestehen;
sie enthalten nach lokaler Texterkennung keine Konto- oder Transaktionsdaten.

Benötigte Importdaten liegen jetzt ausschließlich synthetisch unter
`app/src/modules/banking/fixtures/synthetisch.sta`. Der MT940-Regressionstest prüft
die beiden künstlichen Bewegungen. Die vorhandenen UBL-/CII-Testdateien verwenden
Musterangaben. Neu erstellte Browserdaten sind ebenfalls synthetisch.

Die bereits vor dem Auftrag vorhandene Löschung von
`docs/Bericht_Test_VPS_06092026` bleibt unverändert und zählt nicht zu dieser
Bereinigung. Es wurden keine vorhandenen lokalen Backups oder Belege verwendet.

## Gesondert zu entscheidende Maßnahme

Ein späterer Löschcommit entfernt die veröffentlichten Altversionen nicht.
Vor Freigabe als stabilen Release die Historienbereinigung dieser Fundstellen
entscheiden. Empfohlen ist ein gesicherter Mirror, eine vollständige Liste der
betroffenen Pfade und Varianten und anschließend eine gezielte Entfernung der
Blobs aus allen veröffentlichten Referenzen, etwa mit `git filter-repo`.
Tags, Forks, Pull-Request-Referenzen und GitHub-Caches sind dabei separat zu prüfen.
Ein Rewrite ändert Commit-IDs und erfordert abgestimmten Force-Push sowie neue
Klone. Gegebenenfalls GitHub Support zur Entfernung zwischengespeicherter Inhalte
ansprechen. Das ist eine vorgeschlagene Maßnahme, kein ausgeführter Vorgang.

Der öffentliche Stand wurde nur lesend abgefragt. Keine Historienumschreibung,
kein Push, kein Tag und keine GitHub-Veröffentlichung. Ob betroffene Personen
oder Stellen zu informieren sind, muss der Betreiber anhand der konkreten
Originale entscheiden. Dieser Bericht enthält dazu keine rechtliche Bewertung.
