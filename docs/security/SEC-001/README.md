# SEC-001: Sicherheitsupdate im AGPL-Kern

Stand: 2026-09-14. Lokal geprüfter SEC-001-Stand für den beauftragten
Repositoryabschluss auf `origin/main`; kein Release oder Deployment. Arbeitsrepository `/Users/kf/zettelruhe`, origin
`https://github.com/krisauseu/zettelruhe-os.git`. Ausgangscommit der Prüfung und vor dem Abschluss per `git ls-remote`
bestätigter Remote-main: `6ecc6499e7c674460532dfe1b9c21e820a08cb4c`.
Die vorhandene fremde Änderung `.codex/config.toml` wurde nicht bearbeitet.

Auftrag: lesend übernommene Referenz
`/Users/kf/zettelruhe-cloud/docs/tasks/SEC-001-core-dependencies.md`.
Cloud-Code, `core.lock.json`, Pilotkonfiguration und VPS bleiben unverändert.
Der dort gebundene Commit ist `595fff545d4f377806d273b2b8bfa8d5ac32a7dc`.
Bereits zwischen diesem Commit und dem heutigen Kern-main liegen weitere
Änderungen, insbesondere Positionsbeschreibungen, Finanz-Hooks und Migration
`1730003000_positionsbeschreibung.js`. Eine spätere Cloud-Übernahme muss auch
diesen bestehenden Abstand prüfen; SEC-001 führt selbst keine Migration ein.

## Abhängigkeiten und Advisories

| Paket | Vorher | Nachher | Einordnung |
|---|---|---|---|
| next, eslint-config-next, @next/* | 16.3.0 | 16.3.5 | Bestehende 16.3-Linie; keine Codemod-/Routerumstellung. |
| sharp | 0.35.3 | 0.35.4 | Transitiv durch Next, keine neue direkte App-Abhängigkeit. |
| @img/sharp-libvips-* | 1.3.2 | 1.3.3 | Plattformpakete mit korrigierter libheif. |
| libheif im Linux/amd64-Image | 1.23.1 | 1.23.2 | Laufzeitabfrage `require('sharp').versions`, nicht aus npm-Audit abgeleitet. |
| nodemailer | 9.0.5 | 9.1.1 | Bestehende Major-Linie; SMTP-API bleibt kompatibel. |
| vitest, @vitest/* einschließlich mocker | 4.1.10 | 4.1.11 | Korrigierte Dev-Linie, kein Wechsel auf Vitest 5. |
| js-yaml | 4.3.1 | 4.3.2 | Transitive ESLint-Entwicklungsabhängigkeit. |
| @swc/helpers | 0.5.15 | 0.5.23 | Von Next 16.3.5 exakt gefordert. |

Der [vollständige Versionsdiff](dependency-diff.json) umfasst 50 Einträge,
überwiegend plattformspezifische Next-/sharp-Pakete und die zusammengehörenden
Vitest-Pakete. Kein `npm audit fix --force`. Ein von npm mitgezogenes fastq-Update
und Änderungen an Metadaten unveränderter Pakete wurden entfernt. Sauberes
`npm ci` und beide Nachher-Audits prüfen den bereinigten Lockfile-Stand.
Lokales npm 11 und Container-npm 10 scheiterten beim gezielten Vitest-Update
mit `Cannot read properties of null (reading 'edgesOut')`; npm 12.0.2 löste es
in einer temporären Paketkopie auf. Keine neue npm-Abhängigkeit im Projekt.

Maintainer-Quellen, abgerufen am 2026-09-14:

- [Next August Security Release](https://nextjs.org/blog/august-2026-security-release):
  GHSA-2xp9-vwfh-vxw4 betrifft AVIF im Image Optimizer. 16.3.3 deaktivierte AVIF
  zunächst; 16.3.5 bindet das korrigierte sharp. Der isolierte direkte Optimizer
  verarbeitet ein gültiges AVIF wieder zu JPEG. Die Proxyumleitung bleibt bestehen.
- [Next Windows-RCE, GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36):
  Linux/macOS sind von diesem Windows-Dateisystemfall nicht betroffen; trotzdem
  wird die betroffene Next-Version ersetzt.
- [sharp, GHSA-rgj7-g3m4-5g8c](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c):
  0.35.4 liefert libheif 1.23.2. Die zugrunde liegenden Befunde sind
  [GHSA-g89c-p67h-r497](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497)
  und [GHSA-2jg2-4ch7-h545](https://github.com/strukturag/libheif/security/advisories/GHSA-2jg2-4ch7-h545).
  Eigene/global installierte Bibliotheken sind separat zu prüfen.
- [Nodemailer GHSA-8m3c-c648-2xjj](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8m3c-c648-2xjj):
  Der Legacy-Aufruf von `resolveContent` konnte Datei-/URL-Sperren umgehen;
  korrigiert in 9.1.1. Die App nutzt `sendMail` mit Buffer-Anhängen, keine
  benutzerdefinierten Attachment-Dateipfade oder URL-Anhänge und keine Plugins.
- Nodemailer-Adressparser: [GHSA-wmmp-3585-3rmp](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-wmmp-3585-3rmp),
  [GHSA-2x7j-588g-ccc2](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-2x7j-588g-ccc2),
  [GHSA-cc9r-2j5m-2m83](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-cc9r-2j5m-2m83).
  Korrigiert ab 9.1.0. App-Empfänger kommen aus Kontakten bzw. Eingaben;
  der Parser ist relevant. Eine Domain-Allowlist ist im Kern nicht implementiert.
- [Vitest/@vitest/mocker GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9):
  Dateilesen über Redirect-Mocks in erreichbaren Entwicklungsservern.
  Hier `vitest run` in CI/Tests, keine öffentliche Mocker-Integration;
  trotzdem gepatcht. Nicht im Standalone-Produktionsumfang erforderlich.
- [js-yaml GHSA-2883-xcg3-v3hh](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh):
  CPU-DoS durch Merge-Quellen, korrigiert in 4.3.2. Entwicklungsabhängigkeit
  von ESLint; kein YAML-Uploadpfad der Anwendung. Ebenfalls aktualisiert.

## Auditnachweis

Aus `app/`, vor jeder Änderung und nach der abschließenden Bereinigung:

```sh
npm audit --package-lock-only --json
npm audit --omit=dev --package-lock-only --json
```

| Umfang | Vorher | Nachher |
|---|---|---|
| Gesamtes Lockfile | 6 Pakete: 1 kritisch, 3 hoch, 2 mittel | 0 |
| Ohne Dev | 3 Pakete: 1 kritisch, 2 hoch | 0 |

Originale JSON-Ausgaben: [gesamt vorher](audit-before.json),
[Produktion vorher](audit-production-before.json), [gesamt nachher](audit-after.json),
[Produktion nachher](audit-production-after.json). Die Vorher-Aufrufe endeten
wegen der Befunde mit Exit 1, die Nachher-Aufrufe mit Exit 0.
Audit ist eine zeitpunktbezogene Registry-Prüfung, kein Nachweis gegen unbekannte
Lücken und kein vollständiger Alpine-/ELF-Schwachstellenscan.

## Lokale Prüfungen

macOS auf ARM64; Produktions-/Testimages Linux/amd64 mit Node 22.23.2,
PocketBase 0.39.10 und Caddy 2.10. App-ENV, echte Backups und laufende
Instanzen wurden nicht als Testbestand verwendet. Die installierte
Next-Anleitung zum Upgrade und `app/AGENTS.md` wurden vor Änderungen gelesen.
Keine App-Quellcodeänderung erforderlich.

| Prüfung | Ergebnis |
|---|---|
| `npm test` | Lokal 763 bestanden; finaler Node-22-Container 765 einschließlich zwei Netzwerkregressionen. Je 163 Integrationsfälle ohne sicheren Starter übersprungen. |
| `npm run typecheck` | Next typegen und TypeScript ohne Fehler. |
| `npm run lint -- --max-warnings=0` | Bestanden. |
| Beide Hook-Generatoren mit `--check` | Bestanden. |
| `scripts/test-festschreibung-isolated.mjs` | 197 echte Finanz-/RC-Tests bestanden, synthetische tmpfs-Daten entfernt. |
| Linux-Produktionsbuild | Bestanden; Standalone unter unprivilegiertem Nutzer. |
| Lesender Cloud-Starter `scripts/test-tp002-isolated.mjs` | 14 Gruppen: zwei private PBs, echte verschachtelte Zugriffe, Setup-Sperre, Login/Sessions, Origin/Header/SNI, Firmenwechsel, Dateien/PDFs, Actions, Jobs, PB-Ausfall, Rotation, Logout und Self-Hosting. |
| `scripts/security/sec001-image.mjs` | 27 Pfad-/AVIF-Kombinationen plus HEAD/POST und SSRF-/private-/verschachtelte URLs bestanden. Kodierte Pfade, Doppel-Slashes, Dot-Segmente, AVIF unter PNG-Endung und abgeschnittenes AVIF; keine optimierte Bildantwort durch die Proxyabschirmung. |
| SMTP/BZSt isoliert | 22 Tests bestanden, darunter echter SMTP-Dialog mit PDF-Buffer an lokale Testsenke sowie echte HTTP-Verbindungen für Status, ungültige Antwort und Timeout. Container `--network none`. |
| BZSt-Egress separat | Eigener kurzlebiger Container: TLS 1.3, Zertifikat verifiziert, HTTP 303 vom BZSt-Einstieg. Keine USt-ID oder echte Firmendaten gesendet; kein fachlicher Bestätigungsnachweis. |
| Upgrade/Restore/Rollback | Synthetischer Bestand ab Pilot-Kerncommit: Records und Datei-Bytes identisch, neues Next sowie Rückkehr zum alten Next mit ursprünglichem Backup/alten Hooks samt Login geprüft. Kein Downgrade einer migrierten Datenbank. |

Rohprotokolle: [Container-Tests/Typecheck/Lint](container-checks.txt),
[Build](build.txt), [PB-Integration](pb-integration.txt),
[Zwei-PB-Abnahme](next-pb-isolation.txt), [Bildabschirmung](image-security.txt),
[SMTP/BZSt](smtp-bzst.txt), [BZSt-TLS](bzst-egress.txt),
[Restore/Rollback](restore-rollback.txt). Die erste zusätzliche Container-Gesamtsuite
scheiterte an nicht eingebundenen PB-/Generator-Testfixtures; mit den lesenden
Mounts `/pocketbase` und `/scripts` besteht sie vollständig.

Der Caddy-Test liest die Pilotdatei und ersetzt ausschließlich in einer
temporären Kopie die Domains durch Testhosts mit lokalem TLS. Die Image-Regel
selbst wird unverändert geprüft. Das ist weder eine Prüfung des laufenden VPS
noch von öffentlichem ACME/TLS. Die App/PB-Netze des Zwei-PB- und Bildtests sind
intern; nur der eigene Testproxy erhält einen Loopbackeingang.

Der Release-Starter akzeptiert jetzt `RELEASE_BASE_REF` und optional
`RELEASE_ROLLBACK_NEXT_IMAGE`. Seine bisherigen Standardwerte bleiben erhalten.
Er legt eigene zufällige Volumes an und entfernt ausschließlich diese.

## Images, Quellcodeangebot und Wiederholung

Die maschinenlesbaren Image-/Config-Digests und Quellcode-/Archivhashes stehen
im [Kandidatenmanifest](candidate-manifest.json). Das lokale Angebot liegt unter
`artifacts/sec001-20260914/`, einschließlich `index.html`, AGPL-Quellarchiv und
`candidate-images.tar`. Der Ordner ist absichtlich vom Git-Index ausgeschlossen.
Das alte Imagepaar liegt zusätzlich in `rollback-images.tar`, sein Kernquellcode
in `pilot-source.tar`; beide Archivhashes stehen ebenfalls im Manifest.
Alle OCI-Manifest-, Config- und Layer-Digests der exportierten Archive wurden
gegen die enthaltenen Bytes geprüft. Die Image-ID ist der SHA-256 der OCI-Imagekonfiguration;
ein lokal gebautes Image besitzt ohne Push keinen Registry-RepoDigest.
OCI-Archive erlauben die unveränderte Weitergabe genau dieses Kandidaten.
Keine Kandidaten wurden in eine Registry gepusht.

`python3 scripts/security/prepare-sec001-source.py /absoluter/neuer/ordner`
erzeugt einen bereinigten Quellbaum, Datei-SHA-256, ein deterministisches
AGPL-Quellarchiv, SHA256SUMS und ein lokales `index.html`-Quellcodeangebot.
Agentenkonfiguration, echte ENV-Dateien, Daten und das Cloud-Repository werden
nicht aufgenommen. Die mitgelieferten separaten Dockerfiles binden Node und
Alpine per Digest. Baukommandos stehen in [reproduce.sh](reproduce.sh). Das Skript verlangt neue
Tags und verweigert das Überschreiben bestehender Images. Das PB-Dockerfile
lädt weiterhin APK-Pakete aus der Registry; die konkrete Paketliste und das
geprüfte OCI-Archiv sind deshalb Teil des Nachweises.

Ein frischer Next-Build erzeugt u.a. eigene Build-/Server-Action-Werte; gleiche
Quellen sind daher keine Zusage bitidentischer Image-Digests. Für eine spätere
Freigabe genau das geprüfte OCI-Archiv bzw. dessen Digest übernehmen oder einen
neu gebauten Kandidaten neu prüfen. Keine geheimen Schlüssel aus öffentlichen
Source-Hashes ableiten, um künstliche Bitgleichheit herzustellen.

## Offene Freigaben und Grenzen

SEC-001 ist eine lokale Kernprüfung. Separater Cloud-/VPS-Auftrag erforderlich:

1. Bei einer Cloud-Übernahme den Kern-Diff einschließlich des bereits vorher
   vorhandenen Abstands vom Pilotcommit prüfen und den übernommenen Commit
   mit dem passenden Quellangebot und den Image-Digests verknüpfen.
2. Erst dann Cloud-`core.lock.json` samt passenden Image-/Source-Digests in einem
   eigenen Cloud-Auftrag ändern. Proxyumleitung bis eigener Entscheidung erhalten.
3. Vor einem Deployment Backup/Restore des konkreten Zielbestands, öffentliche
   TLS-/Setup-/Session-/Datei-/PDF-/Proxy-Abnahme und Rückfallplan erneut freigeben.
4. Reale SMTP-Provider mit Auth/STARTTLS sowie echte berechtigte BZSt-Abfragen
   bleiben Betriebsabnahmen. Lokale Senke und TLS-Erreichbarkeit ersetzen sie nicht.
5. Kein vollständiger OS-CVE-Scan, kein RCE-Exploitversuch und keine Last-/DoS-
   Belastungsabnahme. Der AVIF-Test prüft Abschirmung, Dateitypvarianten und die
   korrigierte Decoderbindung. TP-003-Backupserie und Ersatzhost-RTO bleiben getrennt.

Es gab kein Deployment, keinen Zugriff auf VPS-Systeme, keine Änderung laufender
Images. Commit und Push des Kernstands sind separat beauftragt.


## Repositoryabschluss, 2026-09-14

Der vollständige Arbeitsbaum-Diff und die neuen SEC-001-Dateien wurden vor dem
Commit erneut geprüft. Ausschließlich SEC-001 wird aufgenommen; die fremde
Änderung in `.codex/config.toml` und ignorierte lokale Artefakte bleiben erhalten.
Die CI-Datei enthält ausschließlich Checks, keinen Deployment-Schritt.

Schnelle Abschlussprüfungen unter macOS ARM64, Node 25.9.0 und npm 11.12.1:

- `git diff --check` und Prüfung des vorgemerkten Diffs ohne Whitespacefehler.
  Zuvor gefundene Schlussleerzeichen und leere Schlusszeilen in sechs neuen
  Textprotokollen entfernt; Prüfaussagen und Zeitangaben bleiben erhalten.
- `npm test`: 763 bestanden, 163 Integrationsfälle ohne isolierten Starter
  übersprungen. Vite meldet nur den vorhandenen experimentellen Native-Config-Loader.
- `npm run typecheck` und `npm run lint -- --max-warnings=0`: bestanden.
- Beide Hook-Generatoren mit `--check`: bestanden.
- `node --check` für Bildtest und Release-Smoke, `sh -n` für `reproduce.sh`
  sowie Python-AST-Prüfung des Quellarchivskripts: bestanden.
- Beide Lockfile-Audits erneut ausgeführt: jeweils null Befunde.
- JSON-/JSONL-Nachweise syntaktisch geprüft. Die archivierten Quellhashes
  stimmen für App, PocketBase und Skripte mit dem Abschlussstand überein.
  Abweichungen betreffen ausschließlich `.gitignore`, `docs/90-status.md`,
  `docs/betrieb.md` und `docs/entwicklung.md`. Der Sicherheitsbericht selbst
  ist gemäß Archivskript vom Quellarchiv ausgeschlossen. Das Kandidatenmanifest
  und seine historischen Hashes bleiben unverändert.

Die vorherige Linux-/Node-22-Abnahme bleibt oben datiert erhalten. Beim
Repositoryabschluss wurden weder Container neu gebaut noch Systeme gestartet.
Commit-Hash, Push-Ergebnis und der CI-Lauf sind über die Git-Historie und GitHub
nachvollziehbar; dieser Bericht behauptet keine erfolgreiche CI vor deren Ende.
