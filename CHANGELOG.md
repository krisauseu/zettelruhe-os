# Release Notes

## Vorbereitet, noch unveröffentlicht — 2026-09-10

Release-Titel: **Zettelruhe – Open-Source-Buchhaltung für Solo-Selbstständige**

Ein stabiler Versionsname ist noch nicht vergeben. Der technische Kandidat ist
lokal geprüft; vor Veröffentlichung ist der Umgang mit vertraulichen Materialien
in der bereits öffentlichen Git-Historie zu klären. Ein Vorab-Tag umgeht diesen
Befund nicht. [Abnahme](docs/issues/release-abnahme-2026-09-10.md).

### Release-Text

Zettelruhe bündelt die Buchhaltung und Abrechnung für Solo-Selbstständige in einer
selbst betriebenen Anwendung: Kontakte, Katalog, Projekte, Zeiten und Fahrten,
Angebote, Rechnungen und wiederkehrende Entwürfe, Belege, Kassenbuch, Bankimport
sowie Auswertungen und Exporte. Eine Instanz unterstützt mehrere Firmen und
Mitgliedschaften mit den Rollen Eigentümer:in, Bearbeiten und Lesen.

Reverse Charge für betriebliche EU- und Drittlandsdienstleistungen in EUR ist
enthalten. Der Beleg speichert Steuerschuld, abziehbare Vorsteuer und den
Steuerzeitpunkt getrennt vom Lieferantenbetrag. Lieferantenstandards bleiben
übersteuerbare Vorschläge. Reverse Charge ist laut Betreiberbestätigung bereits
auf dem Produktions-VPS getestet und live. Zettelruhe erzeugt einen lokalen
XML-Datenexport und betreibt keine Finanzamtsschnittstelle.

Die Releasevorbereitung behebt reproduzierte Fehler bei konkurrierenden
Schedulerläufen, Zahlungen, Bankzuordnungen und Rechnungsstornos. Entwurf und
Vorlagenfortschritt committen gemeinsam; Firmen und fällige Vorlagen werden über
alle Seiten gelesen. Zahlungen, Steuerstaffeljournale und Rechnungsstatus sowie
Bankzuordnung und Stornogegenbuchungen werden jeweils gemeinsam gespeichert.
Wiederholungen nach verlorenen Antworten erzeugen für dieselbe Zahlungs-ID keine
zweite Zahlung. Das Löschen einer zugeordneten Zahlung gibt die Bankbewegung frei.

Die Diagramme rendern ohne mutierten Renderzustand und ohne den reproduzierten
SVG-Hydrierungsfehler. Die RC-Zahllastanzeige verwendet Decimal. Lintfehler und
alle sechs ESLint-Warnungen sind behoben. Eine minimale CI prüft Unit-Tests,
Typecheck, Lint und die generierten Finanz-Hooks. Installations-, Beitrags- und
Sicherheitshinweise sind ergänzt. Historische Finanzscreenshots und ein echter
Kontoauszug wurden aus dem aktuellen Stand entfernt; Importtests verwenden eine
synthetische MT940-Datei.

### Installation und Update

[README](README.md) und [Betrieb](docs/betrieb.md) beschreiben den Dockerstart.
Das PocketBase-Image verwendet linux/amd64; ARM-Nativbetrieb ist nicht abgenommen.
Next und PocketBase gemeinsam aktualisieren. Alte und neue App-Versionen dürfen
nicht gleichzeitig auf denselben Datenbestand schreiben. Vor einem Update
Datenbank, Dateien und Konfiguration sichern und den Restore isoliert prüfen.
Es kommt keine neue Schema- oder Korrekturmigration hinzu. Historische
Teiljournale werden bei erkannter Abweichung abgewiesen und müssen gesondert
geprüft werden; diese Version repariert keine ungesichteten Altbestände.

### Bekannte Grenzen

- RC unterstützt einen Dienstleistungsfall je Beleg, EUR, eine vollständige
  Zahlung und vollen oder ausgeschlossenen Vorsteuerabzug. Waren, Teil-/Mehrfach-
  zahlungen, Fremdwährungen und anteiliger Abzug bleiben außerhalb des Umfangs.
- DATEV light lehnt Zeiträume mit RC vollständig ab. Journal-CSV enthält RC-Daten.
  Das Belegarchiv entsteht im Speicher und akzeptiert höchstens 256 MiB
  Dateinutzlast; fehlende Dateien verhindern den gesamten Download.
- UStVA-XML unterstützt 2026 und Monat/Quartal. Kein Versand an ELSTER, keine
  Zertifizierung oder Zusicherung eines amtlichen Imports. ZM ist eine
  Kandidatenübersicht; EÜR/BWA sind vereinfachte Auswertungen. E-Rechnungsversand
  liefert XML neben dem PDF, kein Hybrid-PDF/A-3 und keinen zertifizierten Versand.
- Wiederkehrende Rechnungen erzeugen Entwürfe. Pro Vorlage werden höchstens zwölf
  Perioden je Aufruf nachgeholt. Es gibt keinen separaten dauerhaften Worker und
  keine Leaseverlängerung. Gleichzeitiges Bearbeiten von Vorlagenpositionen und
  Erzeugen ist nicht als konsistenter Snapshot abgenommen.
- Ein Bankeingang wird einer Rechnung zugeordnet; ein Rest aus Teilzuordnung
  wird nicht automatisch verteilt. Barzahlungen erzeugen kein Kassenbuchduplikat.
  Gewöhnlicher Storno erzeugt Gegenbuchungen, kein separates Stornorechnungs-PDF.
  Die offene-Posten-Liste liest höchstens 500 Rechnungen je berücksichtigtem Status.
- Sessionlaufzeit ist fest. `/health` kann bei `ok:false` HTTP 200 liefern;
  Überwachung muss den JSON-Inhalt auswerten. Leseaufrufe können Zahlungsjournale
  nachziehen. Ein anderer Compose-Projektname isoliert das fest benannte
  `zettelruhe_pb_data`-Volume nicht.

### Prüfstand

Am 2026-09-10 bestanden lokal 739 Unit-Tests, Typecheck, Lint ohne Warnungen,
195 echte Finanz-/RC-Integrationstests sowie beide Hook-Generatorabgleiche.
Docker-Produktionsbuild, frische Einrichtung, synthetisches Offline-Upgrade/Restore
ab `f48be21` und gezielte Browserregressionen sind geprüft. Die normale
Unit-Suite überspringt die Datenbankintegration; sie wurde separat ausgeführt.

Kein neuer Produktions-/Test-VPS-Nachweis, kein Restore eines echten Backups,
keine vollständige erneute M1-/M2-, SMTP-, BZSt-, TLS- oder externe Importabnahme.
Die CI-Datei ist lokal vorbereitet, noch nicht auf GitHub gelaufen.
[Prüfschritte, Befunde und Restarbeiten](docs/issues/release-abnahme-2026-09-10.md).

Der heutige Funktionsumfang bleibt Open Source unter AGPL-3.0. OCR, Briefpapier,
Stripe-Abos und Managed Hosting gehören zum späteren separaten Projekt
`zettelruhe-cloud`; in diesem Auftrag wurden sie nicht gebaut.
