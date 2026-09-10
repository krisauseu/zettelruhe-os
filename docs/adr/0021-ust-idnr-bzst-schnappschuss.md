# USt-IdNr. als Stammdatum plus BZSt-Bestätigungsschnappschuss

Die Eigentümer:in speichert die eigene USt-IdNr. an der Firma und die fremde am Kontakt. Auf ausdrücklichen Klick holt Next die offizielle BZSt-eVatR-REST-Bestätigung (einfach oder qualifiziert) und legt den Datensatz unverändert als Schnappschuss ab. Das ist eine Aussage zum Anfragezeitpunkt, kein Dauer-„gültig“-Stempel und keine stille Änderung festgeschriebener Belege. Das Verfahren bestätigt ausländische USt-IdNrn. gegenüber einer eigenen DE-Nummer; eine isolierte Bestätigung der eigenen DE-Nummer und DE→DE gibt es hier nicht. Unter der Kleinunternehmerregelung darf die Nummer stehen — USt- und ZM-Übersicht bleiben nicht relevant. Kein ELSTER-Versand. Begründung: ADR-0020 hat das Kontaktfeld bewusst hierher verschoben; der Nachweis einer qualifizierten Abfrage ist der BZSt-Datensatz (§ 18e UStG / UStAE), nicht ein Flag am Stamm.

## Alternatives considered

- Dauer-Flag `ust_id_gueltig` an Firma/Kontakt — unehrlich, das BZSt bestätigt nur den Anfragezeitpunkt.
- USt-Id weiter nur in der Kontakt-Notiz — ZM und E-Rechnung raten weiter aus Freitext.
- Eigene DE-Nummer als `angefragteUstid` oder zweiter Anbieter (VIES) — das Auslandsverfahren lehnt DE→DE ab (`evatr-0006`); VIES ist nicht das vereinbarte BZSt-Verfahren.
- Bestätigung still ins festgeschriebene Journal/Beleg schreiben — verstößt gegen Festschreibung.
- XML-RPC eVatR — seit 30.11.2025 abgeschaltet.

## Standverweis vom 2026-09-10

Die [RC-Umsetzung](../reverse-charge-umsetzung.md) ergänzt inzwischen einen begrenzten USt-Arbeitsfall unter § 19. Die USt-IdNr. allein löst diesen weiterhin nicht aus; die BZSt-Bestätigung bleibt ein Schnappschuss.
