/// <reference path="../pb_data/types.d.ts" />

/**
 * Kontoinhaber am Bankkonto (PDF-Fußzeile, E-Rechnung AccountName).
 */
migrate(
  (app) => {
    const bankkonten = app.findCollectionByNameOrId("bankkonten");
    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(bankkonten, "kontoinhaber")) {
      bankkonten.fields.push(
        new Field({
          type: "text",
          name: "kontoinhaber",
          required: false,
          max: 120,
        }),
      );
    }
    app.save(bankkonten);
  },
  (app) => {
    try {
      const bankkonten = app.findCollectionByNameOrId("bankkonten");
      if (typeof bankkonten.fields.removeByName === "function") {
        bankkonten.fields.removeByName("kontoinhaber");
        app.save(bankkonten);
      }
    } catch (_) {
      /* ignore */
    }
  },
);
