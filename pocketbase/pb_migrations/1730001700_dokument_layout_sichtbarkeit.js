/// <reference path="../pb_data/types.d.ts" />

/**
 * Dokumenten-Layout: Sichtbarkeit Header / Fuß / Zahlblock an der Firma.
 * Default an = bisheriges Verhalten. Bestehende Firmen nachziehen.
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");
    const hasField = (name) =>
      (firmen.fields || []).some((f) => f.name === name);

    if (!hasField("dokument_header_drucken")) {
      firmen.fields.push(
        new Field({
          type: "bool",
          name: "dokument_header_drucken",
          required: false,
        }),
      );
    }
    if (!hasField("dokument_fuss_drucken")) {
      firmen.fields.push(
        new Field({
          type: "bool",
          name: "dokument_fuss_drucken",
          required: false,
        }),
      );
    }
    if (!hasField("dokument_zahlblock")) {
      firmen.fields.push(
        new Field({
          type: "bool",
          name: "dokument_zahlblock",
          required: false,
        }),
      );
    }

    app.save(firmen);

    const records = app.findAllRecords("firmen");
    for (const rec of records) {
      rec.set("dokument_header_drucken", true);
      rec.set("dokument_fuss_drucken", true);
      rec.set("dokument_zahlblock", true);
      app.save(rec);
    }
  },
  (app) => {
    // Felder belassen (kein destruktives Downgrade)
  },
);
