# Zu Zettelruhe beitragen

Bitte zuerst [CONTEXT.md](CONTEXT.md), [AGENTS.md](AGENTS.md) und
[Entwicklung](docs/entwicklung.md) lesen. Fehler und kleine Korrekturen am
vorhandenen Self-hosting-Umfang sind willkommen. Neue Komfortfunktionen und
Managed Hosting gehören zum späteren separaten Cloud-Projekt.

Fehlerberichte gehören in die [GitHub-Issues](https://github.com/krisauseu/zettelruhe/issues).
Version beziehungsweise Commit, reproduzierbare Schritte, erwartetes und
beobachtetes Verhalten sowie die Umgebung nennen. Nur synthetische Daten und
bereinigte Screenshots verwenden. Sicherheitsbefunde nach [SECURITY.md](SECURITY.md)
behandeln.

Für eine Änderung einen Branch erstellen und den Umfang klein halten. Fachregeln
und Geldberechnungen brauchen passende Regressionstests; Geldbeträge mit Decimal
berechnen. Schemaänderungen erhalten eine neue Migration. Bestehende Migrationen
und festgeschriebene Finanzdaten nicht still umschreiben.

Vor einem Pull Request in `app/` ausführen:

```sh
npm ci
npm test
npm run typecheck
npm run lint -- --max-warnings=0
```

Bei Finanz- oder Hookänderungen zusätzlich vom Repository-Root:

```sh
node scripts/build-rc-hook.mjs --check
node scripts/build-finanz-domain-hook.mjs --check
docker build -t zettelruhe-release-pb:20260910 pocketbase
TP022_PB_IMAGE=zettelruhe-release-pb:20260910 node scripts/test-festschreibung-isolated.mjs
```

Der isolierte Starter braucht Docker und das lokale PB-Image. Einrichtung und
Prüfgrenzen stehen in [Entwicklung](docs/entwicklung.md). Tests nie auf einen
Produktivbestand richten. Verhalten und Grenzen im selben Pull Request gemäß
[Pflegematrix](docs/README.md#pflege-bei-änderungen) dokumentieren. Die Beschreibung
nennt Problem, Änderung, ausgeführte Prüfungen und offene Grenzen.

Beiträge werden unter der bestehenden [AGPL-3.0](LICENSE) veröffentlicht. Keine
fremden Inhalte oder Daten beisteuern, für die die nötigen Rechte fehlen.
