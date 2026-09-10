# Dokumentation pflegen

Stand: 2026-09-10, Releasevorbereitung ab `f48be21`; der frühere Abgleich auf `0842832` bleibt unten datiert. Diese Übersicht ordnet die
Dateien im Dokumentationsordner ein und legt ihre Pflege fest. Der laufende
Projektstand steht in [90-status.md](90-status.md).

## Pflege bei Änderungen

Wer eine Änderung umsetzt, aktualisiert vor dem Abschluss die betroffenen
Dokumente. Die Zuordnung gilt für Codex und grok-build; `AGENTS.md` verweist auf
sie. Ein reiner Commit ist kein Anlass, jede Datei zu verändern.

| Anlass | Verbindlich prüfen und bei Auswirkung aktualisieren |
|---|---|
| Neue nutzbare Funktion oder wesentliche Verhaltensänderung | [Root-README](../README.md) für Nutzen und Grenzen, [Status](90-status.md) für Fortschritt/Abnahme, [Roadmap](feature-roadmap.md) für vorhandenen oder offenen Umfang. Kleine Testphase-Änderungen außerdem im [Testphase-Log](testphase.md). |
| Kleiner Bug oder UI-/Bedienungsnachzug | Testphase-Eintrag mit Owner-Datei und Prüfung. Weitere Dateien nur, wenn ihre Beschreibung dadurch veraltet. |
| Modul, Persistenz, Migration, Code-Einstieg, Testverfahren oder bekannte technische Grenze verändert | [Entwicklung](entwicklung.md). Betriebsabläufe zusätzlich in [Betrieb](betrieb.md), Buchungs-/Archiv-/Exportprozesse in der [Verfahrensvorlage](verfahrensdokumentation.md). |
| Bestehender dokumentierter Fachausbau verändert | Zugehörige Fachreferenz, derzeit [Reverse Charge](reverse-charge-umsetzung.md), am Anfang auf den aktuellen Stand bringen. Alte Abschnittsberichte datiert erhalten. |
| Fachbegriff oder Produktgrenze verändert | [CONTEXT.md](../CONTEXT.md) und Roadmap. Architekturentscheidung nur bei einer tatsächlichen Entscheidung als ADR festhalten; abgelöste Aussagen mit Nachfolger verknüpfen. |
| Neue Prüfung, Test-VPS-Abnahme oder Produktionsübernahme | Ergebnis mit Datum, geprüftem Commit, Umgebung, ausgeführtem Kommando/Browserfall und Einschränkungen erfassen; Status auf den Nachweis verweisen lassen. Fehlende Bestätigung ausdrücklich offen lassen. |
| Größerer Diagnose- oder Implementierungsschritt | Bei Bedarf Detailbericht in `issues/` oder `sessions/`; aus Status, Testphase oder Fachreferenz darauf verlinken. Kleine Änderungen benötigen keinen zusätzlichen Bericht. |
| Nur Dokumentation korrigiert | Betroffene Texte, Links und Widersprüche prüfen. Tests nur soweit sie eine konkrete unklare Codeaussage belegen; daraus keine neue Gesamtabnahme ableiten. |

Vor Abschluss prüfen: Stimmen Verhalten, Grenzen und Datierung überein? Ist jede
neue Funktion auffindbar? Sind lokale Abnahme, Test-VPS und Produktion getrennt?
Enthält der Abschlussbericht geänderte Dokumente und verbleibende Lücken?
Unbetroffene Dateien bleiben unverändert. Die Pflege ist Teil des Arbeitsauftrags;
es gibt dafür keinen Scheduler, Git-Hook oder automatischen Commit.

## Einordnung aller Dokumente

| Datei oder Gruppe | Künftige Rolle | Pflegeentscheidung |
|---|---|---|
| `entwicklung.md` | Aktiver technischer Einstieg, einschließlich ursprünglicher Codex-Bestandsaufnahme | Behalten. Bei technischen Änderungen pflegen; historische Abnahmen datiert erhalten. Kein allgemeines Commit-Tagebuch. |
| `testphase.md` | Aktives Änderungslog für einzelne Funde | Weiterführen, nächste freie TP-ID verwenden. Die RC-Funktion selbst hat eine Fachreferenz; ihre kleineren Nachzüge stehen hier. |
| `90-status.md` | Aktueller Fortschritt, offene Abnahmen, Meilensteinhistorie | Nach größeren Funktionen und Abnahmen pflegen. Aktueller Stand oben, Historie darunter. |
| `feature-roadmap.md` | Vorhandener Umfang, offene ursprüngliche Ziele, späterer Ausbau, Nicht-Ziele | Bei Umfangsänderungen pflegen. Keine Kopie aller Testzahlen und Betriebsnachweise. |
| `betrieb.md` | Laufende Anleitung für Installation, Update, Backup, Restore und Health | Bei Betriebsänderungen pflegen; keine Behauptung, ein beschriebenes Verfahren sei dadurch ausgeführt. |
| `verfahrensdokumentation.md` | Aktuelle Prozessvorlage für Betreiber:innen | Bei Buchungs-, Korrektur-, Rechte-, Archiv- und Exportänderungen pflegen. Individuelle Betriebsangaben bleiben auszufüllen. |
| `reverse-charge-umsetzung.md` | Aktuelle RC-Referenz mit historischem Auftrag und drei Abnahmeberichten | Weiterführen, aktuellen Abschluss und Bedienung voranstellen. Bei RC-Änderungen pflegen; nicht als offene Aufgabenwarteschlange lesen. |
| `release-und-cloud-plan.md` | Releasevorbereitung, mögliche Issues und Übergang zu Cloud | Bei Releaseentscheidungen und Projektübergabe fortschreiben. Nach Anlage von `zettelruhe-cloud` dessen eigenes Backlog führen; hier nur Kernrelease und Projektgrenze pflegen. |
| `codegraph.md` | Technische Werkzeuganleitung | Bei CRG-/Konfigurationsänderungen pflegen; kein laufender Produktstatus. |
| `funktionstest-m1.md`, `funktionstest-m2.md` | Historische Abnahmeprotokolle und Ausgangspunkt für Regressionen | Ergebnisse erhalten. Aktuelle Prüferwartungen separat halten; Nachtest nach M2 ergänzt Zahlungen, Rollen, RC und Exporte. Neue Läufe mit eigenem Datum/Commit belegen. |
| `adr/0001` bis `adr/0030` | Entscheidungsregister | Bei Entscheidungen konsultieren; kein regelmäßiges Reporting. Ergänzungen/Nachfolger kennzeichnen. Insbesondere 0002 → 0018 → 0025, 0020 → 0021, 0026 → 0029 für PDF-Empfang; RC ergänzt 0019/0024. |
| `issues/ergebnis-funktionstest-m1.md`, `issues/ergebnis-funktionstest-m2.md` | Historische Rohberichte | Erhalten, keine nachträgliche Umschreibung zu heutigen Testergebnissen. |
| `issues/pocketbase-firmenisolation-2026-09-05.md`, `issues/belege-kunde-migration-2026-09-05.md` | TP-020-/TP-021-Befunde und Nachweise | Als Belege erhalten, spätere relevante Audits gesondert datieren. Aktueller Status gehört ins Testphase-Log. |
| `issues/festschreibung-atomaritaet-2026-09-05.md`, `issues/tp-022-transaktionsentwurf-2026-09-05.md` | Historische Diagnose und Entwurf zu TP-022 | Kein offener Implementierungsauftrag; Abnahmen der drei Stufen sind die Nachfolger. |
| `issues/tp-022-belegstufe-2026-09-06.md`, `issues/tp-022-rechnungsstufe-2026-09-06.md`, `issues/tp-022-kassenstufe-2026-09-07.md` | Abnahmebelege für TP-022 | Erhalten und bei Änderungen an diesen Garantien konsultieren; keine laufenden Statusdateien. |
| `sessions/*.md`, einschließlich `*-prompt.md` | Historische Übergaben, Entscheidungen und damalige Arbeitsaufträge | Erhalten. Neue Session-Dateien nur bei größeren Schnitten mit zusätzlichem Erklärungswert. Alte Prompts nicht wieder ausführen oder regelmäßig aktualisieren. |
| `recherche/2026-09-09-graphify-und-crg.md` | Datierte Werkzeugrecherche | Als Entscheidungsgrundlage erhalten. Bei neuer Recherche ergänzen; die aktuelle Anleitung steht in `codegraph.md`. |
| `logo-512x512-transparent.png` und verbliebene Logos | Marken-/Layoutreferenzen | Erhalten. Historische Layoutbilder und Muster-PDF wurden bei der Release-Materialprüfung entfernt; [Befund](issues/release-materialpruefung-2026-09-10.md). |
| Frühere Screenshots und `.sta` unter `issues/` | Aus dem aktuellen Arbeitsbaum entfernt | Vertrauliche Kontodaten bestätigt. Synthetische MT940-Fixture in `app/src/modules/banking/fixtures/`; Historienbereinigung gesondert entscheiden. |
| `issues/release-materialpruefung-2026-09-10.md`, `issues/release-abnahme-2026-09-10.md` | Befund und lokale Releaseabnahme | Datiert erhalten; offene Veröffentlichungsschritte nicht als erledigt markieren. |
| `Bericht_Test_VPS_06092026` | Bereits vor diesem Audit im Arbeitsbaum gelöscht | Löschung unverändert gelassen. Nicht als geprüfter oder verfügbarer aktueller VPS-Nachweis verwendet. |

Außerhalb von `docs/` bleiben Root-README und `CONTEXT.md` aktive Einstiege.
`app/README.md` ist der kurze App-Einstieg mit Prüfkommandos;
`CHANGELOG.md`, `CONTRIBUTING.md` und `SECURITY.md` im Root ergänzen Release, Beiträge und Sicherheitsmeldungen;
`PROJEKT-AKTIVITAETEN.md` ist eine historische Aufwandsschätzung und der ursprüngliche
Papierkram-Entwurf eine Rohidee. Keines davon ersetzt das laufende Statusreporting.

## Historisches Ergebnis des ersten Abgleichs vom 10. September 2026

`entwicklung.md` wurde mehrfach gepflegt, unter anderem für TP-020–024 und zuletzt
im Commit `0842832` für den RC-Verweis. Die wiederholte Erwähnung „nicht im Commit“
in den RC-Übergaben beschreibt die damalige Dateiauswahl. Sie bedeutet nicht,
dass die Datei entbehrlich ist. Ihr technischer Haupttext hinkte dem RC-Ausbau
allerdings hinterher. Migrationen, Einstiegspunkte und Prüfhinweise sind nachgezogen.

README fehlte Reverse Charge. Roadmap und Verfahrensvorlage nannten noch eine
geschlossene Freigabe, während der Code und der letzte RC-Abschlussbericht sie
bereits geöffnet hatten. Status und RC-Referenz begannen mit älteren Zwischenständen.
Diese Einstiege sind berichtigt; die Formularvereinfachung `961d06d` ist als
TP-026 nachgetragen. Die Roadmap trennt bislang fehlende v1-Ziele von vorhandenem
Umfang. Alte M1-/M2-Erwartungen zu Zahlungen und Rollen sind als historisch markiert.

Der Abgleich stützt sich auf Git-Historie, Dokumentenbestand, Codegraph und
gezielte Quellprüfung. Die 26 bestehenden RC-Formulartests bestanden am
2026-09-10. Markdown-Dateiverweise und `git diff --check` wurden geprüft.
Keine vollständige Funktions-, Browser-, Rechts-, Server- oder Deploymentprüfung;
keine Migration, kein App-Start und keine Datenänderung. Historische Testzahlen
werden nicht als neue Ergebnisse ausgegeben.

Nachträgliche Betreiberbestätigung am selben Tag: Reverse Charge ist auf dem
Produktions-VPS getestet und live. Die ELSTER-Prüfsperre ist verworfen; Zettelruhe
exportiert XML und betreibt keine Finanzamtsschnittstelle. TP-009 wird dem
Cloud-Ausbau zugeordnet. Technische Kandidaten und nächste Schritte stehen im
[Release- und Cloud-Plan](release-und-cloud-plan.md).
