# Gemeinsame Kategorie-Stammdaten für Belege und Kassenbuch

Beleg und Kassenbuch teilen eine firma-gebundene Auswahlliste (`kategorien`). Am Beleg und am Kassenbuch-Eintrag bleibt `kategorie` ein Text-Schnappschuss. Umbenennen ändert die Liste, nicht bereits gespeicherte Zeilen. Löschen nur, wenn der Name nirgends verwendet wird. Begründung: Freitext war im Alltag leer und uneinheitlich; eine Relation würde Umbenennen still auf festgeschriebene Belege durchschlagen.

## Alternatives considered

- Zwei getrennte Listen (Beleg vs. Kasse) — doppelte Pflege, widerspricht dem vereinbarten Alltag.
- Relation statt Text — Umbenennen würde Historie still ändern (GoBD-unfreundlich).
- Freitext belassen — im Funktionstest als Mangel aufgefallen.
