/// <reference path="../pb_data/types.d.ts" />

/**
 * Gemeinsame Kategorie-Stammdaten für Belege und Kassenbuch (ADR-0017).
 * Am Beleg/Kassenbuch bleibt `kategorie` Text-Schnappschuss.
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let kategorien;
    try {
      kategorien = app.findCollectionByNameOrId("kategorien");
    } catch {
      kategorien = new Collection({
        type: "base",
        name: "kategorien",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "firma",
            required: true,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "text",
            name: "name",
            required: true,
            min: 1,
            max: 120,
            presentable: true,
          },
          {
            type: "bool",
            name: "aktiv",
            required: false,
          },
          {
            type: "text",
            name: "notiz",
            required: false,
            max: 2000,
          },
        ],
        indexes: [
          "CREATE INDEX idx_kategorien_firma ON kategorien (firma)",
          "CREATE UNIQUE INDEX idx_kategorien_firma_name ON kategorien (firma, name)",
        ],
      });
      app.save(kategorien);
    }
  },
  (app) => {
    try {
      const kategorien = app.findCollectionByNameOrId("kategorien");
      app.delete(kategorien);
    } catch {
      /* ignore */
    }
  },
);
