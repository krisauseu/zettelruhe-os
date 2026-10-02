# Serverseitiger Instanzkontext

Stand 2026-09-29: Cloud-TP-013 ergänzt den für Cloud-TP-002 eingeführten
Instanzkontext um getrennte Mailwege und ist lokal mit echter SMTP-Kette
abgenommen und in Core-Release `v1.0.2` enthalten. Kein Produktionsdeployment. Die generischen
Änderungen bleiben AGPL in diesem Repository; Register, Secrets und
Betriebssteuerung liegen außerhalb.

## Kontext und Zugriff

`app/src/lib/instance-context.ts` ist der generische Serveradapter. Ohne
`INSTANCE_MODE=cloud` liest er die bekannte einzelne Instanz aus ENV.
Im Cloud-Modus sind `INSTANCE_CONTROL_URL`, `INSTANCE_CONTROL_TOKEN` und
`INSTANCE_INGRESS_TOKEN` erforderlich. Fehlender Kontext ergibt einen Fehler,
auch wenn zusätzlich `PB_URL` gesetzt ist. Der Next-Build enthält keine
proprietären Cloud-Imports.

`GET /v1/resolve?hostname=...` liefert den unveränderlichen Kontext mit tenantId,
PB-Origin, kanonischer HTTPS-App-URL, configVersion, sessionVersion,
Session-Schlüssel, Superuser-Zugang und optional `smtp` (Tenant),
`systemSmtp` (Zettelruhe-Systemmail) sowie `fallbackSmtp`
(Zettelruhe-Geschäftsmail). Die private Control-Schnittstelle
`GET/PUT/DELETE /v1/mail` verwaltet Tenant-SMTP nur nach serverseitiger
Instanz-Eigentümer-, Session- und Originprüfung. Passwörter werden nicht an
Browser ausgeliefert. Der vollständige lokale Auftrag steht im
Cloud-Repository unter `docs/tasks/TP-013-cloud-mail.md`.
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

Seit TP-036 (2026-10-02) erhält der Proxy den kanonischen Host aus dem bereits
aufgelösten `context.appUrl` in internen Next-Requests.
`NextResponse.next({ request: { headers } })` setzt `x-instance-app-host` und
`x-instance-app-host-proof` ausschließlich für den nachgelagerten Request.
Der Nachweis enthält einen Ausgabezeitpunkt und einen domänengetrennten
HMAC-SHA256 über Zeit und Host, signiert mit dem vorhandenen Ingress-Schlüssel,
maximal fünf Minuten gültig. Next reicht diese Header beim internen RSC-Redirect
einer Server Action weiter. Keine neue ENV und keine Kontextsecrets im Header.

`requireIngress()` verlangt auch dabei das geschützte Eingangstoken und einen
gültigen Nachweis. Öffentliche Hosts und vorhandener `x-forwarded-host` müssen
exakt zum kanonischen Host passen. Ein abweichender IP:Port-Transporthost wird
nur mit dem authentifizierten kanonischen Host akzeptiert; IP allein bleibt
abgewiesen. Control wird weiterhin mit dem kanonischen Host aufgerufen und
prüft dessen App-URL-Bindung. Unbekannte Hosts, Queryparameter und ungeprüfte
Forwarded-Hosts liefern keine Tenantidentität. Session-/Originprüfung bleibt
erhalten. Ablauf oder Schlüsselrotation verwirft alte Nachweise.

Die lokale Produktions-Next-Regressionsprüfung besteht mit Firma und Rechnung,
echten Actions und erzwungenem internem IP:Port-Folgehost. Control/PB sind
synthetische lokale HTTP-Fixtures; keine Cloud-/VPS-/Deploymentabnahme.
[Prüfung und Grenzen](testphase.md#tp-036-kanonischer-host-bei-internen-next-redirects-2026-10-02).

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
Einladungen verwenden in Cloud ausschließlich `systemSmtp`; Geschäftsbriefe
verwenden `smtp` oder, falls nicht vorhanden, `fallbackSmtp` mit einem
Reply-To aus der aktiven Firma. Self-Hosting behält sein eigenes `SMTP_*`-ENV
für beide Mailarten. Der Scheduler erzeugt derzeit nur Entwürfe, keinen Versand.
Ein vorhandener, aber fehlerhafter Tenant-Zugang führt zu einem sichtbaren
Versandfehler und löst keinen Fallback aus. `smtp.ts` ersetzt DNS-, TLS-,
Authentifizierungs- und Versandfehler an der gemeinsamen Versandgrenze durch
eine neutrale Meldung ohne ursprünglichen Fehler, `cause` oder Logausgabe.
Fachliche Validierungen wie ungültiger Empfänger oder fehlende Firmenadresse
bleiben erhalten.

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

## Lokale Mailabnahme Cloud-TP-013 am 2026-09-29

Der Starter `zettelruhe-cloud/scripts/test-tp013-mail-local.mjs` besteht
13 Prüfgruppen mit ausschließlich synthetischen Daten und lokalen
SMTP-Capture-Servern. Eine gemeinsame Cloud-Next-Runtime nutzt zwei getrennte
PocketBase-Instanzen und den echten Cloud-Control-Kontext. Die Prüfung ruft
Server Actions aus tatsächlich gerenderten App-Seiten auf und verbindet sich
per SMTP mit STARTTLS und AUTH; `sendMail()` wird dabei nicht gemockt.

- Tenant A: Einladungen über den zentralen Systemmailer, Angebot, Rechnung
  und Zahlungserinnerung über eigenes SMTP mit konfiguriertem Absender.
- Tenant B ohne eigenen Zugang: Einladungen über Systemmail; alle drei
  Geschäftsmailarten über den zentralen Fallback. `From` bleibt zentral,
  `Reply-To` folgt dem tatsächlich geladenen aktiven Firmenrecord, auch
  nach dessen Änderung in PocketBase.
- Isolation: direkt aufeinanderfolgende und parallele A/B/A/B-Vorgänge
  sowie zwölf zusätzliche parallele Vorgänge bleiben getrennt. Temporär
  erhält auch B einen eigenen SMTP-Zugang; die Capture-Server belegen
  getrennte Credentials und Absender. Der Quellcode und zwölf Unit-Fälle
  in `app/src/lib/smtp-cloud.test.ts` sichern ergänzend einen neuen
  Transporter pro Versand, parallele Kontexte und Secret-Rotation ab.
- Falsches SMTP-Passwort für A: alle drei Geschäftsmailaktionen scheitern
  sichtbar, ohne Fallback-Versand. Antworten, UI und normale Logs enthalten
  keine Credentials oder sensitiven SMTP-Details. Tenant B und Einladungen
  über den Systemmailer bleiben funktionsfähig.
- Self-Hosting: dasselbe Next-Image mit einer dritten, getrennten PB nutzt
  `SMTP_*` für System- und Geschäftsmail. Ein lokaler Relay ohne STARTTLS
  und AUTH bleibt möglich. Keine neue Self-Hosting-Architektur.
- Scheduler: Die Quellprüfung bestätigt ausschließlich wiederkehrende
  Rechnungsentwürfe; kein Mailversand und deshalb kein zusätzlicher SMTP-Fall.

Nach dem E2E bestanden Core-Tests, Typecheck und Lint unter Node 22.22.3/npm
10.9.8. Vitest meldet 775 bestandene und 163 übersprungene Tests; zusätzlich
führt der JSON-Reporter 35 nicht ausgeführte Fälle der verschachtelten
RC-Integrationssuite als `pending` (keine Todos oder Fehler).
Der native Produktionsbuild `npm run build -- --webpack` bestand unter
Node 25.9.0/npm 11.12.1 ohne Fontfixture oder Build-Overrides.

Der vollständige Aufbau und die verbleibenden Produktionspunkte stehen im
Cloud-Repository unter `docs/tasks/TP-013-cloud-mail.md`, die spätere
Commit-Dateiauswahl in `docs/tasks/TP-013-diff-scope.md`. Der AGPL-Core-Release
`v1.0.2` wird direkt auf diesem TP-013-Commit veröffentlicht. Die finale
Cloud-Bindung dokumentiert der Cloud-Auftrag; Cloud-Images und gesonderte
Produktionsabnahme bleiben offen. Die lokalen Capture-Ergebnisse
belegen keine Zustellung an echte Empfänger, Provider-/DNS-Freigabe oder
Produktionslast. Der Releaseauftrag umfasst keinen VPS-Zugriff und kein Deployment.

## Historische Abnahme Cloud-TP-002 und Betriebsgrenzen

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
TLS, keine Produktionslast und keinen VPS-Rollout. In der damaligen Abnahme
vom 2026-09-10 wurde SMTP hinsichtlich Kontext/Passwortwechsel geprüft, ohne
echten Mailversand. Die lokale SMTP-Abnahme vom 2026-09-29 steht oben.

Prüfergebnis vom 2026-09-10: 748 Unit-Tests, Typecheck, Lint, Produktionsbuild,
195 echte Finanz-/RC-Tests und 14 Cloud-Integrationsgruppen bestanden.
Die 161 übersprungenen Fälle des normalen Unit-Laufs sind kein Fehlbefund;
die sicheren Starter führen die jeweiligen Integrationsfälle separat aus.
Siehe [TP-030](testphase.md#tp-030-generischer-instanzkontext-für-cloud-tp-002-2026-09-10).
