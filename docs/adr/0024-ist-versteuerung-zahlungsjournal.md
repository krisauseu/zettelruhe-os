# Ist-Versteuerung: Zufluss-Journal bei Zahlung

Regelbesteuerung ist in v1 nur Ist-Versteuerung; EÜR folgt dem Zuflussprinzip in beiden Steuer-Modi. Zahlungen schrieben bisher keinen Journal-Eintrag, Auswertungen lasen nur das Journal. Die Rechnungs-Festschreibung bleibt die Beleg-Buchungs-Verknüpfung (`quelle_typ=rechnung`). Zusätzlich erzeugt jede Zahlung festgeschriebene Journal-Zeilen (`quelle_typ=zahlung`, Buchungsdatum = Zahlungsdatum), anteilig nach Steuerstaffel. EÜR, USt, ZM, BWA, Dashboard und DATEV zählen den Zufluss, nicht die Forderungsbuchung. Löschen einer Zahlung storniert deren Journal; Rechnungs-Storno storniert auch die Zahlungsjournale. Bestehende Zahlungen werden idempotent nachgezogen. Begründung: ohne Journal-Nachzug wären EÜR und USt weiter Soll-ähnlich; beide Quellen gleichzeitig zu zählen würde Einnahmen verdoppeln; die Rechnungsbuchung wegzulassen bräche „Journal erst bei Festschreibung“.

## Alternatives considered

- Forderungsbuchung bei Festschreibung weglassen — verletzt die Invariante und die Beleg-Buchungs-Verknüpfung.
- Nur Auswertungen auf Zahlungsdatum umbiegen, ohne Journal — kein nachvollziehbarer Zufluss, DATEV bliebe Soll-ähnlich.
- Beide Quellen in EÜR/USt zählen — doppelte Einnahmen.
- Nur unter Regelbesteuerung journalisieren — EÜR unter Kleinunternehmerregelung bliebe Soll-ähnlich.
- Kassenbuch automatisch aus Barzahlung — eigene Open Decision, hier nicht vermischt.

## Ergänzung vom 2026-09-10 zum implementierten Stand

Die [RC-Umsetzung](../reverse-charge-umsetzung.md) ergänzt für unterstützte
Eingangsleistungen einen eigenen Steuerzeitpunkt im Journal-Schnappschuss.
RC-USt folgt diesem Datum, während EÜR und Geldberichte am Buchungsdatum bleiben.
Der Zahlungszufluss gewöhnlicher Ausgangsrechnungen bleibt wie oben beschrieben.
