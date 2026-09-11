/// <reference path="../pb_data/types.d.ts" />

// Individuelle Details am Dokument; Artikelstammdaten bleiben unverändert.
migrate(
  (app) => {
    for (const name of ["rechnungspositionen", "angebotspositionen"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.add(new TextField({
        name: "description",
        required: false,
        max: 2000,
      }));
      app.save(collection);
    }
  },
  (app) => {
    for (const name of ["rechnungspositionen", "angebotspositionen"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.removeByName("description");
      app.save(collection);
    }
  },
);
