# Beleg- und Rechnungsdateien immutable nach Festschreibung

Nach **Festschreibung** sind zugehörige Dateien (PDF, E-Rechnungs-Original) über die Anwendungs-API weder ersetz- noch löschbar; Korrekturen laufen über Domänenpfade (z. B. Storno/neuer Beleg), nicht über stille Datei-Edits. Beim E-Rechnungs-Empfang bleibt die **Rohdatei (Original)** unberührt archiviert; geparste Felder liegen separat in Collections. Begründung: GoBD-Mindeststandard (ADR-0004) und Empfang-vor-Versand (ADR-0003); Speicher bleibt PocketBase-Files/`pb_data` ohne separates Objektsystem in v1.
