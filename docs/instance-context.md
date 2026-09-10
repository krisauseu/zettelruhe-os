# Serverseitiger Instanzkontext

Stand 2026-09-10, Entwicklung nach v1.0.0 für Cloud-TP-002. Kein neuer Release
und kein Produktionsdeployment. Die generischen Änderungen bleiben AGPL in
diesem Repository; Register, Secrets und Betriebssteuerung liegen außerhalb.

## Kontext und Zugriff

`app/src/lib/instance-context.ts` ist der generische Serveradapter. Ohne
`INSTANCE_MODE=cloud` liest er die bekannte einzelne Instanz aus ENV.
Im Cloud-Modus sind `INSTANCE_CONTROL_URL`, `INSTANCE_CONTROL_TOKEN` und
`INSTANCE_INGRESS_TOKEN` erforderlich. Fehlender Kontext ergibt einen Fehler,
auch wenn zusätzlich `PB_URL` gesetzt ist. Der Next-Build enthält keine
proprietären Cloud-Imports.

`GET /v1/resolve?hostname=...` liefert den unveränderlichen Kontext mit tenantId,
PB-Origin, kanonischer HTTPS-App-URL, configVersion, sessionVersion,
Session-Schlüssel, Superuser-Zugang und optionaler SMTP-Konfiguration.
Dienstauthentifizierung erfolgt über Bearer-Token. Beide Diensttokens brauchen
mindestens 32 Zufallszeichen. PB-/Control-Aufrufe verwenden Timeouts, `no-store`
und verfolgen keine Redirects. `/v1/instances` liefert bereite Hosts für Jobs.

Der Node-Proxy in `app/src/proxy.ts` ersetzt die bisherige Middleware und prüft
den geschützten Eingang, Hostauflösung, genaue Origin bei Schreibmethoden und
Sessionbindung. Er gilt für alle Pfade. Der nachgelagerte Serveradapter prüft den
Eingang erneut und bindet die Auflösung an das requesteigene Next-Headerobjekt.
React-Cache unterstützt Server Components; eine WeakMap hält den gleichen
Snapshot auch im Route Handler. Secrets werden nicht in weitergereichte
Kontextheader oder Client-Props geschrieben.

Jobs laufen in `withInstance(context, work)` über AsyncLocalStorage. Verschachtelte
und parallele Aufrufe stellen ihren jeweiligen äußeren Kontext wieder her.
Der Scheduler lädt je Tick die bereiten Hosts, löst jede Instanz vor ihrem Lauf
neu auf und bearbeitet weitere Instanzen auch nach einem Fehler.
Manuelle Jobs bleiben an den geprüften Request und dessen Firma gebunden.

Admin-Tokens gehören zum Kontext, mit maximal zehn Minuten Wiederverwendung.
Self-Hosting hat einen eigenen unveränderlichen ENV-Snapshot; Konfigurationswechsel
erzeugen einen neuen. SMTP-Transporter werden pro Versand erzeugt, ohne globalen
Passwortcache. Der Zahlungsnachzug-Cache trennt tenantId, configVersion und Firma.
Es gibt keine globale aktuelle Kundeninstanz und keine ENV-Umschaltung.

## Sessions und URLs

Cloud-Sessions sind HS256-signiert und binden tenantId sowie sessionVersion.
Die Bindung wird vor PB-Datenzugriffen geprüft, auch bei identischen User-IDs.
Der aktuelle Nutzer samt Instanzrolle wird aus der ausgewählten PB geladen,
danach die aktuelle Firmenmitgliedschaft. Ein Versions- oder Schlüsselwechsel
widerruft die Sessions dieser Instanz. Gelöschte Nutzer verlieren ihren Zugang.

Cloud verwendet `__Host-zettelruhe_session`, `Secure`, `HttpOnly`, `Path=/`,
`SameSite=Lax`, ohne Domain. Login über Form-POST und Server Action verwendet
denselben gebundenen Setter. Logout löscht das Cookie und verlangt in Cloud POST
mit passender Origin. Firmenwechsel prüft die Mitgliedschaft und erhält die
Instanzbindung. Self-Hosting behält `zettelruhe_session` und seinen Setup-Wizard.
Öffentliches Cloud-Setup ist an beiden Einstiegspfaden vollständig gesperrt.

Redirects und Einladungslinks verwenden die kanonische App-URL. Vom Formular
gewählte Rücksprungpfade bleiben innerhalb `/app` auf derselben Instanz.
Private Seiten und Downloads sind nicht öffentlich cachebar. Es gibt keinen
tenantübergreifenden Next-Datencache; PB-Fetches verwenden `no-store`.

## Abnahme und Grenzen

Cloud-TP-002 enthält den ausführbaren Starter. Er prüft ein gebautes Next mit
zwei echten PB-Instanzen, getrennten Daten-/Dateivolumes und Credentials hinter
Caddy, einschließlich echter Kontakt-Server-Actions, Login, gleicher IDs,
übertragener/manipulierter Sessions, Firmenwechsel, Dateien, PDFs, Host/SNI,
Header/Origin, Parallelität, PB-Ausfall, Konfigurations-/Secret-Wechsel und Jobs.
`instance-context.integration.test.ts` ergänzt 20 verschachtelte parallele
Kontexte mit echten PB-Zugriffen. Ohne den sicheren Starter wird dieser Test
übersprungen. Anschließend läuft dasselbe Image im Self-Hosting-Modus mit einer
neuen leeren PB, Setup und Login.

Der Betreiber muss Next und PB netzseitig abschirmen. Nur ein kontrollierter
Proxy darf Next erreichen. Client-Header werden vor dem Setzen der vertrauten
Header entfernt; ein Host/SNI-Abgleich verhindert widersprüchliche HTTPS-Ziele.
Die interne HTTP-Verbindung ist nur im privaten Netz zulässig, andernfalls ist
authentifiziertes TLS erforderlich. Das ist keine Freigabe für öffentliches PB
oder einen frei erreichbaren Control-Dienst.

Laufende Requests/Jobs behalten ihren Snapshot. Konfigurations-/Sessionwiderruf
wirkt beim nächsten Request oder Job, nicht rückwirkend auf bereits laufende
Operationen. Next und Host bleiben gemeinsame Ausfallbereiche. Der Test belegt
keinen Schutz vor einem kompromittierten Next-/Hostprozess, kein öffentliches
TLS, keine Produktionslast und keinen VPS-Rollout. SMTP wurde hinsichtlich
Kontext/Passwortwechsel geprüft, ohne echten Mailversand.

Prüfergebnis vom 2026-09-10: 748 Unit-Tests, Typecheck, Lint, Produktionsbuild,
195 echte Finanz-/RC-Tests und 14 Cloud-Integrationsgruppen bestanden.
Die 161 übersprungenen Fälle des normalen Unit-Laufs sind kein Fehlbefund;
die sicheren Starter führen die jeweiligen Integrationsfälle separat aus.
Siehe [TP-030](testphase.md#tp-030-generischer-instanzkontext-für-cloud-tp-002-2026-09-10).
