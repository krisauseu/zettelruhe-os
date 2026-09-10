/// <reference path="../pb_data/types.d.ts" />

/**
 * USt-IdNr. am Kontakt + BZSt-Bestätigungsschnappschüsse (ADR-0021).
 * Firma.ust_id existiert bereits. Schnappschüsse sind Nachweis, kein Stamm-Stempel.
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");
    const kontakte = app.findCollectionByNameOrId("kontakte");

    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(kontakte, "ust_id")) {
      kontakte.fields.push(
        new Field({
          type: "text",
          name: "ust_id",
          required: false,
          max: 16,
        }),
      );
      app.save(kontakte);
    }

    let pruefungen;
    try {
      pruefungen = app.findCollectionByNameOrId("ust_id_pruefungen");
    } catch {
      pruefungen = new Collection({
        type: "base",
        name: "ust_id_pruefungen",
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
            type: "select",
            name: "ziel_typ",
            required: true,
            maxSelect: 1,
            values: ["firma", "kontakt"],
          },
          {
            type: "text",
            name: "ziel_id",
            required: true,
            min: 1,
            max: 32,
          },
          {
            type: "select",
            name: "art",
            required: true,
            maxSelect: 1,
            values: ["einfach", "qualifiziert"],
          },
          {
            type: "text",
            name: "anfragende_ust_id",
            required: true,
            min: 4,
            max: 16,
          },
          {
            type: "text",
            name: "abgefragte_ust_id",
            required: true,
            min: 4,
            max: 16,
          },
          {
            type: "text",
            name: "bzst_id",
            required: false,
            max: 80,
          },
          {
            type: "text",
            name: "anfrage_zeitpunkt",
            required: false,
            max: 40,
          },
          {
            type: "text",
            name: "status",
            required: true,
            min: 1,
            max: 32,
          },
          {
            type: "text",
            name: "status_meldung",
            required: false,
            max: 500,
          },
          {
            type: "bool",
            name: "gueltig_zum_anfragezeitpunkt",
            required: false,
          },
          {
            type: "text",
            name: "gueltig_ab",
            required: false,
            max: 32,
          },
          {
            type: "text",
            name: "gueltig_bis",
            required: false,
            max: 32,
          },
          {
            type: "text",
            name: "erg_firmenname",
            required: false,
            max: 4,
          },
          {
            type: "text",
            name: "erg_strasse",
            required: false,
            max: 4,
          },
          {
            type: "text",
            name: "erg_plz",
            required: false,
            max: 4,
          },
          {
            type: "text",
            name: "erg_ort",
            required: false,
            max: 4,
          },
          {
            type: "text",
            name: "anfrage_name",
            required: false,
            max: 200,
          },
          {
            type: "text",
            name: "anfrage_strasse",
            required: false,
            max: 200,
          },
          {
            type: "text",
            name: "anfrage_plz",
            required: false,
            max: 20,
          },
          {
            type: "text",
            name: "anfrage_ort",
            required: false,
            max: 120,
          },
          {
            type: "text",
            name: "roh",
            required: false,
            max: 8000,
          },
          {
            type: "autodate",
            name: "created",
            onCreate: true,
            onUpdate: false,
          },
          {
            type: "autodate",
            name: "updated",
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          "CREATE INDEX idx_ust_id_pruefungen_firma ON ust_id_pruefungen (firma)",
          "CREATE INDEX idx_ust_id_pruefungen_ziel ON ust_id_pruefungen (firma, ziel_typ, ziel_id)",
        ],
      });
      app.save(pruefungen);
    }
  },
  (app) => {
    try {
      const pruefungen = app.findCollectionByNameOrId("ust_id_pruefungen");
      app.delete(pruefungen);
    } catch {
      /* ignore */
    }
  },
);
