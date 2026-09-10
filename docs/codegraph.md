# Codegraph mit CRG

Zettelruhe verwendet `code-review-graph` (CRG) als lokalen Strukturgraphen für
Codex. CRG parst die versionierten Dateien mit Tree-sitter und speichert den
Graphen als SQLite-Daten unter `.code-review-graph/`. Weder Quellcode noch
Embeddings verlassen dafür den Rechner. Die projektlokale Codex-Konfiguration
in `.codex/config.toml` startet nur die lesenden Analysewerkzeuge und nicht die
CRG-Refactoring-Werkzeuge.

## Warum CRG

CRG beantwortet genau die wiederkehrenden Fragen dieses Repositories:
Aufruf- und Importpfade, Auswirkungsradius und zugeordnete Tests. Graphify kann
ebenfalls einen lokalen Graphen aufbauen, setzt unter Codex aber auf einen
AGENTS-Anhang und einen dokumentiert wirkungslosen PreToolUse-Hook. Zwei Graphen
wären doppelte lokale Daten und zwei Aktualisierungswege. Daher ist nur CRG
eingerichtet.

## Nutzung in Codex

Bei Struktur- oder Änderungsfragen zuerst den MCP-Server
`code-review-graph` verwenden. Geeignete Reihenfolge:

1. `get_minimal_context_tool` oder `query_graph_tool` nach Modul, Route oder
   Funktion fragen.
2. Bei einer geplanten Änderung `get_impact_radius_tool` oder
   `get_review_context_tool` verwenden.
3. Nur die dort genannten Dateien und die vorgeschriebenen Fachunterlagen
   öffnen. Für eine einzelne Textstelle bleibt `rg` sinnvoll.

Die Regeln in `AGENTS.md` machen diesen Ablauf für künftige Codex-Sitzungen
verbindlich. Codex lädt die projektlokale `.codex/config.toml` nur in einem als
vertrauenswürdig markierten Checkout.

Mehrdeutige Namen wie `calculateRc` gibt es sowohl in Next als auch in den
PocketBase-Hooks. Deshalb nach einer Suche immer den qualifizierten Namen oder
Dateipfad aus dem Treffer verwenden. Der Graph beschleunigt die Vorauswahl; er
ersetzt nicht die kurze Prüfung der danach geöffneten Fachlogik.

## Aktualisierung und frischer Checkout

Der Graph wird nicht dauerhaft überwacht und es gibt keine Git-Hooks. Nach
einer eigenen Änderung, einem Merge oder Branchwechsel genügt
`code-review-graph update`; vor einer Analyse kann Codex dasselbe über
`build_or_update_graph_tool` erledigen. Der erste Aufbau erfolgt mit
`code-review-graph build`. Das ist für die kleine, aktive Codebasis robuster als
ein Hintergrundprozess und hält den Graphen trotzdem inkrementell aktuell.

Die lokale Laufzeit wird nicht committed. In einem frischen Checkout einmal
aus dem Projektwurzelverzeichnis ausführen:

```sh
uv venv --python python3 .code-review-graph/venv
uv pip install --python .code-review-graph/venv/bin/python "code-review-graph==2.3.6"
.code-review-graph/venv/bin/code-review-graph build
```

`.code-review-graphignore` ergänzt die Git-Ausschlüsse für nicht versionierte
oder generierte Daten. Es schließt Abhängigkeiten, Builds, Caches, lokale
Umgebungen, Secrets, Logs, PocketBase-Daten und Backups aus.

## Quellen

Die Gegenüberstellung mit Quellen steht in
[`recherche/2026-09-09-graphify-und-crg.md`](./recherche/2026-09-09-graphify-und-crg.md).
Die projektlokale MCP-Konfiguration folgt der offiziellen
[Codex-MCP-Dokumentation](https://learn.chatgpt.com/docs/extend/mcp).
