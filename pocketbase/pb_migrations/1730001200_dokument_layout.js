/// <reference path="../pb_data/types.d.ts" />

/**
 * M1-10 — Dokumenten-Layout light an der Firma:
 * Logo, Akzentfarbe, Textbausteine Kopf/Fuß für Angebot/Rechnung.
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");
    const hasField = (name) =>
      (firmen.fields || []).some((f) => f.name === name);

    if (!hasField("logo")) {
      firmen.fields.push(
        new Field({
          type: "file",
          name: "logo",
          required: false,
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
        }),
      );
    }

    if (!hasField("dokument_akzentfarbe")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "dokument_akzentfarbe",
          required: false,
          max: 7,
        }),
      );
    }

    if (!hasField("dokument_kopftext")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "dokument_kopftext",
          required: false,
          max: 500,
        }),
      );
    }

    if (!hasField("dokument_fusstext")) {
      firmen.fields.push(
        new Field({
          type: "text",
          name: "dokument_fusstext",
          required: false,
          max: 1000,
        }),
      );
    }

    app.save(firmen);
  },
  (app) => {
    // Felder belassen (kein destruktives Downgrade)
  },
);
