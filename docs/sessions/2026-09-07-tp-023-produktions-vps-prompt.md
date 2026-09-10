# Prompt für den Produktions-VPS: TP-023 ausrollen

Freigegebener TP-023-Implementierungscommit:
`cee84a4442456bff675f80b8956cc0127c86ed7a`. Den Produktionsauftrag erst nach
einem grünen Bericht des Test-VPS ausführen.

## Prompt

Arbeite auf dem Produktions-VPS im Repository `/root/zettelruhe`. Ziel ist
ausschließlich das kontrollierte Deployment und der Nachtest von TP-023
beziehungsweise M1-15. Der erwartete Commit ist
`cee84a4442456bff675f80b8956cc0127c86ed7a`. Wenn kein grüner Test-VPS-Bericht
für denselben Commit vorliegt, stoppe sofort. Committe und pushe auf dem VPS
nichts.

Lies zuerst `AGENTS.md`, `CONTEXT.md`, `docs/entwicklung.md`,
`docs/testphase.md`, `docs/betrieb.md`, `app/AGENTS.md` und die lokale
Next-Dokumentation zu `redirect`. Prüfe Arbeitsbaum, aktuellen Commit, Remote,
laufende Container, verwendete Compose-Dateien, Host-Caddy und Zielvolume.
Erhalte vorhandene lokale Dateien. Stoppe bei einem schmutzigen Arbeitsbaum,
einem abweichenden Zielvolume oder wenn der erwartete Commit nicht auf
`origin/main` liegt.

Vor jeder Änderung:

1. Erstelle ein konsistentes Backup des PocketBase-Volumes und sichere `.env`
   getrennt nach `docs/betrieb.md`. Gib keine Geheimnisse aus. Verifiziere, dass
   beide Sicherungen existieren und lesbar sind.
2. Prüfe, dass der erwartete Commit die auf dem Test-VPS geprüfte TP-023-Änderung
   enthält. Vergleiche den Commit exakt mit dem Test-VPS-Bericht.
3. Führe mindestens den TP-023-Regressionstest und TypeScript aus. Nutze die
   vollständige Suite, sofern die installierte Umgebung sie ohne Änderung des
   produktiven Datenbestands ausführen kann. Stoppe bei Fehlern.

Deploye exakt den erwarteten Commit mit der bestehenden Produktionskonfiguration.
TP-023 enthält nur Next-Code und Dokumentation. Führe keine Migration,
Datenkorrektur oder Änderung an PocketBase-Hooks aus. Baue das Next-Image frisch
und starte nur die für diesen Stand nötigen Dienste kontrolliert neu. Alte und
neue Next-Versionen dürfen nicht gleichzeitig auf denselben Server-Action-Flow
geschickt werden. Prüfe danach Containerzustand, `/health`, HTTPS, Login und die
Logs seit dem Neustart.

Der schreibende M1-15-Smoke darf nur in einer eindeutig dafür vorgesehenen
Testfirma auf der Produktionsinstallation laufen. Falls keine solche Firma
vorhanden oder zweifelsfrei benannt ist, führe keinen schreibenden Test aus und
melde diesen Punkt als ausstehende manuelle Prüfung. Lege nicht eigenmächtig eine
Testfirma an und verwende keine Firma mit echten Buchhaltungsdaten.

Wenn eine freigegebene Testfirma vorhanden ist:

1. Lade eine synthetische XRechnung oder CII-Fixture über den E-Rechnung-Empfang
   hoch und erzeuge daraus genau einen Beleg-Entwurf.
2. Erwartet wird die direkte Navigation zu `/app/belege/<id>` ohne
   `error=NEXT_REDIRECT` und ohne sichtbaren Text `NEXT_REDIRECT`.
3. Prüfe, dass genau ein Entwurf entstand, der Empfang korrekt verweist und kein
   Journaleintrag oder Nummernkreisverbrauch entstand.
4. Halte alle erzeugten IDs fest. Räume ausschließlich die in diesem Test
   erzeugten Entwürfe und Empfangsrecords mit einer vorhandenen sicheren Methode
   auf. Wenn eine sichere Bereinigung nicht möglich ist, belasse die eindeutig
   markierten Testrecords und melde sie. Keine direkten Löschungen an
   festgeschriebenen oder fremden Records.

Prüfe abschließend Healthcheck und Logs erneut. Melde:

- vorherigen und deployten Commit sowie Abgleich mit dem Test-VPS,
- Image-ID und verwendete Compose-Dateien,
- Backup-Pfade ohne Geheimnisse,
- Ergebnisse der lokalen Prüfungen,
- Ergebnis des read-only Smokes und gegebenenfalls des Tests in der Testfirma,
- erzeugte IDs und Datenbilanz,
- Warnungen, ausgelassene Schritte und den finalen Go- oder No-Go-Status.

Ändere keine Superuser-Zugangsdaten, Proxyregeln, Finanzdaten oder andere offene
TPs außerhalb des ausdrücklich beschriebenen Testbestands.
