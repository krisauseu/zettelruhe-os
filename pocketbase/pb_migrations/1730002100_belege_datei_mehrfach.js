/// <reference path="../pb_data/types.d.ts" />

/**
 * Belegdatei: mehrere Fotos/Seiten je Beleg (Smartphone ohne Scanner).
 * Bestehende einzelne Dateien bleiben; PB liefert sie danach als Array.
 */
migrate(
  (app) => {
    const belege = app.findCollectionByNameOrId("belege");
    const datei = belege.fields.getByName("datei");
    if (!datei) {
      throw new Error("belege.datei field not found");
    }
    datei.maxSelect = 10;
    app.save(belege);
  },
  (app) => {
    // Nicht zurück auf 1: Datensätze können mehrere Dateien haben.
  },
);
