/// <reference path="../pb_data/types.d.ts" />

/**
 * created/updated explizit — PB 0.23+ ergänzt Autodate nicht still,
 * sort=-created auf ust_id_pruefungen lieferte sonst 400.
 */
migrate(
  (app) => {
    let pruefungen;
    try {
      pruefungen = app.findCollectionByNameOrId("ust_id_pruefungen");
    } catch {
      return;
    }

    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(pruefungen, "created")) {
      pruefungen.fields.push(
        new Field({
          type: "autodate",
          name: "created",
          onCreate: true,
          onUpdate: false,
        }),
      );
    }
    if (!hasField(pruefungen, "updated")) {
      pruefungen.fields.push(
        new Field({
          type: "autodate",
          name: "updated",
          onCreate: true,
          onUpdate: true,
        }),
      );
    }
    app.save(pruefungen);
  },
  () => {
    /* Felder behalten — kein stilles Schema-Zurück */
  },
);
