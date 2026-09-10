# Recherche: Graphify und code-review-graph (CRG)

Stand: 9. September 2026. Diese Notiz stützt sich ausschließlich auf die
jeweiligen offiziellen Projektquellen.

## Graphify

- Herkunft: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify),
  das offizielle Open-Source-Repository. Das PyPI-Paket heißt ausdrücklich
  `graphifyy`, der CLI-Befehl dagegen `graphify`.
- Installation: Python 3.10+ sowie vorzugsweise `uv tool install graphifyy`
  (alternativ `pipx install graphifyy`). Für diese Aufgabe ist die dokumentierte
  Projekt- und Codex-Variante `graphify install --project --platform codex`.
- Konfiguration und Daten: Der Graph liegt standardmäßig unter
  `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, Visualisierung). Eine
  projektlokale `.graphifyignore` verwendet `.gitignore`-Syntax inklusive
  Negation; vorhandene `.gitignore`-Dateien werden ebenfalls berücksichtigt.
- Nutzung und Aktualisierung: Aufbau mit `graphify .`, gezielte Abfrage mit
  `graphify query "…"` bzw. `graphify path A B`; `graphify update .` verarbeitet
  Änderungen. Optional gibt es Watch-Modus und Commit-/Checkout-Hooks.
  Nach `git pull` oder Merge empfiehlt das Projekt ausdrücklich ein Update.
- Codex: Wird offiziell unterstützt. Der Codex-Installer ergänzt
  projektlokale `AGENTS.md`-Anweisungen; diese sind laut Projekt die wirksame
  Graph-first-Integration. Ein zusätzlich registrierter Codex-PreToolUse-Hook
  ist unter Codex Desktop bewusst ein No-op. Für parallele Extraktion nennt
  Graphify `multi_agent = true` in der globalen Codex-Konfiguration.

Quellen: [README – Installation und Codex](https://github.com/Graphify-Labs/graphify#install),
[README – Ignore-Regeln](https://github.com/Graphify-Labs/graphify#ignoring-files),
[README – Build, Query und Update](https://github.com/Graphify-Labs/graphify#usage),
[README – Codex-Integration](https://github.com/Graphify-Labs/graphify#make-your-assistant-always-use-the-graph).

## code-review-graph (CRG)

- Herkunft: [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph),
  die offizielle Projektquelle. CRG erstellt lokal per Tree-sitter einen
  Strukturgraphen (Funktionen, Klassen, Imports und Aufrufe) und speichert ihn
  als SQLite-Daten unter `.code-review-graph/`.
- Installation: Python 3.10+ sowie `pip install code-review-graph` oder
  `pipx install code-review-graph`; danach `code-review-graph build`. Der
  offizielle, ausschließlich auf Codex zielende Installer lautet
  `code-review-graph install --platform codex`.
- Konfiguration und Daten: `.code-review-graphignore` im Repository schließt
  Pfade aus; in Git-Repositories werden laut Projekt ohnehin nur getrackte
  Dateien erfasst. MCP liefert u. a. Impact-/Blast-Radius- und
  Review-Kontext-Abfragen. Die Kernanalyse ist lokal; Cloud-Embeddings sind
  optional.
- Aktualisierung: `code-review-graph update` reindiziert geänderte Dateien,
  `code-review-graph watch` hält den Graphen per Dateiwächter aktuell. Das
  Projekt beschreibt hash-basiertes Reparse nur tatsächlich veränderter Dateien
  samt Auflösung von Abhängigen über Graphkanten.
- Codex: Codex ist ein offizielles Installationsziel. Die dokumentierte
  Codex-MCP-Installation verwendet jedoch globale Dateien unter
  `~/.codex/`; das steht im Spannungsverhältnis zur Anforderung, diese
  Einrichtung projektbezogen zu halten. Der allgemeine Installer sollte nicht
  verwendet werden, weil er weitere erkannte Agenten konfigurieren kann.

Quellen: [README – Quick Start und Codex-Installer](https://github.com/tirth8205/code-review-graph#quick-start),
[README – inkrementelle Updates und Speicherort](https://github.com/tirth8205/code-review-graph#how-it-works),
[README – CLI-Befehle](https://github.com/tirth8205/code-review-graph#usage),
[README – unterstützte Funktionen](https://github.com/tirth8205/code-review-graph#features),
[Dokumentation – Codex-Nutzung](https://github.com/tirth8205/code-review-graph/blob/main/docs/USAGE.md).

## Entscheidung für Zettelruhe

Installiert ist nur CRG. Die Fragen für Zettelruhe betreffen vor allem
Aufrufe, Imports, Auswirkungsradius und Tests. Dafür liefert CRG die passendere
MCP-Schnittstelle. Graphify kann zusätzlich Dokumentation in denselben Graphen
aufnehmen, würde hier aber einen zweiten Graphen, eine zweite Aktualisierung
und lange Codex-Anweisungen einführen.

Der offizielle CRG-Installer würde die Codex-Einrichtung global schreiben und
wird deshalb nicht verwendet. Stattdessen startet die versionierte,
projektlokale `.codex/config.toml` den CRG-Server. Das ist eine unterstützte
Codex-Konfigurationsform: Die [offizielle Codex-MCP-Dokumentation](https://learn.chatgpt.com/docs/extend/mcp)
erlaubt MCP-Server ausdrücklich in `.codex/config.toml` eines vertrauenswürdigen
Projekts. Die Konfiguration wurde mit `codex mcp list` und einem vollständigen
MCP-Handshake geprüft.
