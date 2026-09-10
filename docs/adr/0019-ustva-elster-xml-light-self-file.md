# UStVA-Kennzahlen und ELSTER-XML light als Self-File

Die USt-Übersicht bleibt Journal-Aggregation der aktiven Firma. Zusätzlich mappen wir nur ehrlich befüllbare UStVA-Kennzahlen (Kz 81, 86, 66, 83) und erzeugen einen lokalen `Anmeldungssteuern`-Datensatz (Mein-Elster-Upload-Form, ISO-8859-15) zum Abschreiben oder Hochladen. Kein ERiC, keine Hersteller-ID, kein Versand, keine Zertifikate. Ig. Lieferungen, § 13b, EUSt und andere Arten bleiben „nicht geführt“. XML nur für Kalendermonat oder -quartal. Begründung: Solo-Self-File ohne Softwarehersteller-Zulassung; gleiches Ehrlichkeitsprinzip wie DATEV-CSV light.

## Alternatives considered

- ERiC-Versand mit Zertifikat und Hersteller-ID — außerhalb Scope, Abgabe aus der App.
- Eigenes XML ohne Mein-Elster-Form — weniger nützlich für Self-File.
- 0 %-Umsätze still als Kz 41/43/48 raten — unehrlich, Journal unterscheidet die Arten nicht.

## Ergänzung vom 2026-09-10 zum implementierten Stand

Die damalige Grenze „§ 13b nicht geführt“ ist durch die
[RC-Umsetzung](../reverse-charge-umsetzung.md) für EU-/Drittlandsdienstleistungen
in EUR erweitert. Kz 46/47, 84/85 und 67 sowie der begrenzte §-19-Arbeitsfall sind
implementiert. Der XML-Export unterstützt nur 2026 und Monat/Quartal. Die frühere
Bezeichnung „zum Hochladen“ belegt keine amtliche Importkonformität; eine solche
Abnahme ist nicht nachgewiesen. Der lokale Export ohne ELSTER-Versand bleibt die
Grenze dieser Entscheidung.
