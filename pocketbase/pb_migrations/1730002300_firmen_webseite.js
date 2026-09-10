/// <reference path="../pb_data/types.d.ts" />

/**
 * Firmen-Webseite für Stammdaten und PDF-Fußzeile (Angebot/Rechnung).
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");
    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(firmen, "webseite")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "webseite",
          required: false,
          max: 200,
        }),
      );
    }
    app.save(firmen);
  },
  (app) => {
    try {
      const firmen = app.findCollectionByNameOrId("firmen");
      if (typeof firmen.fields.removeByName === "function") {
        firmen.fields.removeByName("webseite");
        app.save(firmen);
      }
    } catch (_) {
      /* ignore */
    }
  },
);
