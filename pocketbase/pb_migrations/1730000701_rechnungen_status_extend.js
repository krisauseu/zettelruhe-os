/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 8 Nachzug — Rechnungsstatus-Enum erweitern.
 * (1730000700 hat zahlungen angelegt; Select-values ggf. still fehlgeschlagen.)
 * Bestehende „offen“-Rechnungen bleiben gültig.
 */
migrate(
  (app) => {
    const rechnungen = app.findCollectionByNameOrId("rechnungen");
    const statusField = rechnungen.fields.getByName("status");
    if (!statusField) {
      throw new Error("rechnungen.status field not found");
    }

    // SelectField.values — direkte Mutation (PB JSVM pointer)
    statusField.values = [
      "entwurf",
      "offen",
      "teilbezahlt",
      "bezahlt",
      "ueberfaellig",
      "storniert",
    ];
    // maxSelect bleibt 1 (Single-Select)
    if (typeof statusField.maxSelect === "number") {
      statusField.maxSelect = 1;
    }

    app.save(rechnungen);
  },
  (app) => {
    // Nicht zurücksetzen: Datensätze könnten neue Statuswerte haben
  },
);
