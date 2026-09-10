/// <reference path="../pb_data/types.d.ts" />

/**
 * E-Rechnungs-Versand (ADR-0022).
 * - firmen.email / firmen.telefon: elektronische Adresse + Kontakt (XRechnung)
 * - kontakte.leitweg_id: Leitweg-ID oder Käuferreferenz (BT-10)
 * - e_rechnungen_versand: XML-Original je Rechnung+Profil; nie das Rechnungs-PDF
 * Client create/update/delete gesperrt (ADR-0006).
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");
    const kontakte = app.findCollectionByNameOrId("kontakte");
    const rechnungen = app.findCollectionByNameOrId("rechnungen");

    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(firmen, "email")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "email",
          required: false,
          max: 200,
        }),
      );
    }
    if (!hasField(firmen, "telefon")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "telefon",
          required: false,
          max: 40,
        }),
      );
    }
    app.save(firmen);

    if (!hasField(kontakte, "leitweg_id")) {
      kontakte.fields.push(
        new Field({
          type: "text",
          name: "leitweg_id",
          required: false,
          max: 120,
        }),
      );
      app.save(kontakte);
    }

    try {
      app.findCollectionByNameOrId("e_rechnungen_versand");
      return;
    } catch {
      /* create below */
    }

    const fields = [
      {
        type: "relation",
        name: "firma",
        required: true,
        collectionId: firmen.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        type: "relation",
        name: "rechnung",
        required: true,
        collectionId: rechnungen.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        type: "select",
        name: "profil",
        required: true,
        maxSelect: 1,
        values: ["xrechnung_ubl", "zugferd_cii"],
      },
      {
        type: "file",
        name: "original_datei",
        required: true,
        maxSelect: 1,
        maxSize: 15728640,
        mimeTypes: [
          "application/xml",
          "text/xml",
          "application/octet-stream",
        ],
      },
      {
        type: "text",
        name: "original_dateiname",
        required: false,
        max: 255,
      },
      {
        type: "text",
        name: "iban",
        required: false,
        max: 34,
      },
      {
        type: "text",
        name: "erzeugt_am",
        required: true,
        min: 1,
        max: 40,
      },
      {
        type: "text",
        name: "notiz",
        required: false,
        max: 2000,
      },
    ];

    const col = new Collection({
      type: "base",
      name: "e_rechnungen_versand",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields,
      indexes: [
        "CREATE INDEX idx_e_re_versand_firma ON e_rechnungen_versand (firma)",
        "CREATE INDEX idx_e_re_versand_rechnung ON e_rechnungen_versand (firma, rechnung)",
        "CREATE UNIQUE INDEX idx_e_re_versand_rechnung_profil ON e_rechnungen_versand (firma, rechnung, profil)",
      ],
    });
    app.save(col);
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("e_rechnungen_versand");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
