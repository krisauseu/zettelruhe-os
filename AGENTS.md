# Arbeiten an Zettelruhe

## Einstieg

1. Lies [CONTEXT.md](CONTEXT.md) für Fachsprache und Scope sowie
   [docs/entwicklung.md](docs/entwicklung.md) für Code-Einstiege, Prüfkommandos
   und bekannte Abweichungen.
2. Lies [docs/testphase.md](docs/testphase.md) für die jüngsten Änderungen.
   [docs/90-status.md](docs/90-status.md) hält den Meilensteinstand;
   [docs/feature-roadmap.md](docs/feature-roadmap.md) die Produktgrenzen.
3. Prüfe den Arbeitsbaum. Erhalte vorhandene Änderungen, lokale Skills und
   unversionierte Arbeitsmaterialien. Bearbeite nur den beauftragten Umfang.
4. Vor Änderungen lies die betroffenen Moduldateien und einschlägigen
   [ADRs](docs/adr/). Unter `app/` gilt zusätzlich
   [app/AGENTS.md](app/AGENTS.md), einschließlich der installierten Next-Dokumentation.

Bei Widersprüchen beschreibt der aktuelle Code die technische Realität.
Dokumentiere die Abweichung; leite daraus keinen eigenständigen Umbau ab.
Historische Session-Kickoffs sind keine aktuellen Arbeitsaufträge.

## Vorhandene Arbeitsabläufe

- Kleine Testphase-Funde: Lies den vorhandenen
  [.grok/skills/testphase-fix/SKILL.md](.grok/skills/testphase-fix/SKILL.md)
  und nutze sein Verfahren samt Tracking in `docs/testphase.md` auch mit Codex.
  Der Skill ist in diesem lokalen Checkout vorhanden; fehlt er in einem anderen
  Checkout, melde das und nutze die gemeinsamen Dokumente als Orientierung.
- Explizite Skill-Aufträge: Die Einstiegsskills stehen unter
  [.agents/skills/](.agents/skills/). Lies den benannten `SKILL.md` samt
  referenzierten Skills. Abhängigkeiten und unterschiedliche Commit-Vorgaben
  sind in `docs/entwicklung.md` erläutert.
- Betrieb, Start, Migration oder Restore: Lies zuerst
  [docs/betrieb.md](docs/betrieb.md) und den Abschnitt „Sicher prüfen“ in
  `docs/entwicklung.md`. Auch App-Aufrufe können Daten nachtragen.

Gemeinsames Projektwissen bleibt in `CONTEXT.md` und `docs/`. Bestehende
grok-build-Dateien und Skills bleiben nutzbar; verweise auf sie, statt sie für
Codex zu kopieren. Ein Codex-Onboarding allein erfordert keine neue Architektur,
Abhängigkeit, Datenmigration oder Deployment-Konfiguration.

Commit und Push erfolgen nur auf ausdrücklichen Auftrag. Wähle dabei Dateien
gezielt aus; lokale Belege und Kontoauszüge sind keine automatischen Commit-Kandidaten.

## Dokumentation bei Abschluss

Nach neuen Funktionen, geändertem Verhalten oder technischen Änderungen prüfe
vor der Abschlussmeldung die [Pflegematrix](docs/README.md#pflege-bei-änderungen)
und aktualisiere alle betroffenen Dokumente im selben Arbeitsauftrag.
Neue Funktionen gehören in README, Status und Roadmap; kleine Testphase-Funde
zusätzlich ins Testphase-Log. Technische Änderungen an Einstiegspunkten,
Persistenz, Prüfverfahren oder bekannten Grenzen gehören in `docs/entwicklung.md`.
Diese Pflege ergänzt das Tracking des lokalen Testphase-Skills.

Fertig ist die Dokumentation, wenn Verhalten und Grenzen dem Code entsprechen,
Prüfungen mit Datum und Umgebung belegt und offene Abnahmen benannt sind.
Historische Testergebnisse bleiben datiert erhalten. Ein lokaler Erfolg belegt
kein Deployment. Nenne im Abschluss die geänderten Dokumente und verbleibende
Lücken; unveränderte Dateien brauchen keine pauschale Aufzählung.

## Codegraph für Codex

Für Fragen zur Struktur, zu Abhängigkeiten, Änderungen mit größerer Wirkung oder
zu den passenden Tests zuerst den projektlokalen MCP-Server
`code-review-graph` verwenden. Beginne mit `get_minimal_context_tool` oder
`query_graph_tool`; bei geänderten Dateien verwende
`build_or_update_graph_tool` und danach `get_impact_radius_tool` oder
`get_review_context_tool`. Lies anschließend nur die vom Graph genannten
Dateien und die fachlich vorgeschriebenen Dokumente. `rg` bleibt passend für
eine konkrete Textsuche, nicht als Ersatz für eine bereichsübergreifende
Auswirkungsanalyse.

Bei mehrfach vorkommenden Namen immer die vom Graphen zurückgegebene
qualifizierte Funktion oder den Dateipfad verwenden und das Ergebnis an den
wenigen betroffenen Quelldateien prüfen.

Die lokale Umgebung und die SQLite-Daten unter `.code-review-graph/` sind
absichtlich nicht versioniert. Falls der MCP-Server in einem frischen Checkout
fehlt, siehe `docs/codegraph.md`.
