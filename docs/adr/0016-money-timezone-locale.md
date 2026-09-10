# Geld mit Decimal-Bibliothek, Fachzeit Europe/Berlin, UI nur Deutsch

Geldbeträge und Steuerberechnungen nutzen **`decimal.js` oder `big.js`** — keine nativen JS-Floats. Zeitstempel in PocketBase als UTC/ISO; steuerliche Tagesgrenzen, Fälligkeiten und EÜR-Perioden werden in **`Europe/Berlin`** ausgewertet. UI-Sprache v1 ist ausschließlich **de-DE**. Begründung: Rundungsfehler sind in Buchhaltung inakzeptabel; deutsches Steuerrecht ist kalendertag- und zeitzonengebunden; DACH/i18n ist bewusst nicht v1 (ADR-0001).
