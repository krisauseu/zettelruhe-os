# Arbeitsmaterialien vor dem Release

> Nachtrag 2026-09-10: R-01 ist abgeschlossen. Der Betreiber hat das neue
> Repository `krisauseu/zettelruhe-os` mit einem bereinigten Initial-Commit
> erstellt und lokale Entwicklung, Test-VPS sowie Produktion darauf umgestellt.
> Die in diesem Bericht beschriebene Vorgänger-Historie wird nicht fortgeführt.

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

## Historische Maßnahme im Vorgänger-Repository

Ein Löschcommit im Vorgänger-Repository hätte die veröffentlichten Altversionen
nicht entfernt. Stattdessen hat der Betreiber ein neues Repository mit einem
bereinigten Initial-Commit angelegt. Dieser Release nutzt ausschließlich dieses
neue Repository. Alte Klone, Forks, Tags und Caches des Vorgänger-Repositorys
sind nicht Teil dieses Releaseumfangs und müssen getrennt behandelt werden.

Dieser Bericht enthält keine rechtliche Bewertung. Ob über den Umgang mit dem
Vorgänger-Repository hinaus Personen oder Stellen zu informieren sind, entscheidet
der Betreiber anhand der Originale.
