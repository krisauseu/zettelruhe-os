# Prompt für den Test-VPS: TP-023 prüfen

Freigegebener TP-023-Implementierungscommit:
`cee84a4442456bff675f80b8956cc0127c86ed7a`.

## Prompt

Arbeite auf dem temporären Test-VPS im Repository `/root/zettelruhe`.
Ziel ist ausschließlich das Deployment und der Nachtest von TP-023 beziehungsweise
M1-15. Der erwartete Commit ist
`cee84a4442456bff675f80b8956cc0127c86ed7a`. Committe und pushe auf dem VPS
nichts.

Lies zuerst `AGENTS.md`, `CONTEXT.md`, `docs/entwicklung.md`,
`docs/testphase.md`, `docs/betrieb.md`, `app/AGENTS.md` und die lokale
Next-Dokumentation zu `redirect`. Prüfe danach Arbeitsbaum, aktuellen Commit,
Remote und die aktive Compose-Konfiguration. Erhalte vorhandene lokale Dateien.
Stoppe bei einem schmutzigen Arbeitsbaum oder wenn der erwartete Commit nicht
auf `origin/main` liegt. Nenne dann den genauen Befund, ohne etwas zu verändern.

Vor dem Deployment:

1. Sichere das PocketBase-Volume und die vorhandene `.env` nach dem Verfahren
   aus `docs/betrieb.md`. Gib keine Geheimnisse aus.
2. Prüfe, dass der erwartete Commit TP-023 enthält. Erwartet werden die Änderung
   in `app/src/modules/einvoice/actions.ts`, der Regressionstest
   `app/src/modules/einvoice/actions.test.ts` und der Eintrag in
   `docs/testphase.md`.
3. Führe den Regressionstest, die vollständige Vitest-Suite, TypeScript und den
   gezielten ESLint für die beiden E-Rechnungsdateien aus. Stoppe bei Fehlern.

Deploye anschließend exakt den erwarteten Commit mit der tatsächlich auf diesem
VPS verwendeten Compose-Konfiguration. Für TP-023 ändert sich nur Next-Code;
führe keine Migration und keine Datenkorrektur aus. Baue das Next-Image frisch,
starte den Dienst kontrolliert neu und prüfe Containerzustand, `/health`, Caddy,
TLS und die Logs seit dem Neustart. PocketBase darf nicht auf einen anderen
Endpunkt oder ein anderes Volume zeigen.

Prüfe M1-15 im Browser mit einer klar als Testbestand erkennbaren Firma:

1. Lade eine synthetische XRechnung oder CII-Fixture über den vorhandenen
   E-Rechnung-Empfang hoch.
2. Erzeuge daraus über die Oberfläche einen Beleg-Entwurf.
3. Erwartet wird die direkte Navigation zu `/app/belege/<id>`. Die URL und die
   Oberfläche dürfen weder `error=NEXT_REDIRECT` noch den Text `NEXT_REDIRECT`
   enthalten.
4. Prüfe, dass genau ein Beleg-Entwurf entstand, der Empfang auf diesen Beleg
   verweist und kein Journaleintrag oder Nummernkreisverbrauch entstand.
5. Wiederhole den Klick nicht blind. Halte alle erzeugten IDs fest. Räume nur
   die in diesem Test erzeugten Entwürfe und Empfangsrecords auf, sofern die
   vorhandene Oberfläche oder eine bereits dokumentierte sichere Testmethode
   das erlaubt. Verändere keine fremden Records.

Prüfe abschließend Healthcheck und Logs erneut. Melde:

- vorherigen und deployten Commit,
- Image-ID und Compose-Dateien,
- Backup-Pfade ohne Geheimnisse,
- Ergebnisse von Tests, TypeScript und ESLint,
- URL-Verhalten und IDs des M1-15-Smokes,
- Datenbilanz vor und nach der Bereinigung,
- verbleibende Warnungen oder Abweichungen.

Ändere keine Superuser-Zugangsdaten, Proxyregeln oder andere offene TPs. Der
bekannte Zugangsdatenhinweis des temporären Test-VPS gehört nicht zu diesem
Auftrag.
