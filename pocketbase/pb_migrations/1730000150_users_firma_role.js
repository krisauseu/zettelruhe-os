/// <reference path="../pb_data/types.d.ts" />

/**
 * Nachzug Bauabschnitt 1: Standard-Auth-Collection "users" um
 * Rolle und Firma-Relation ergänzen (falls PB users schon existierte
 * und die Foundation-Migration die Felder übersprungen hat).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const firmen = app.findCollectionByNameOrId("firmen");

    const hasField = (name) =>
      (users.fields || []).some((f) => f.name === name);

    if (!hasField("role")) {
      users.fields.push(
        new Field({
          type: "select",
          name: "role",
          required: false,
          maxSelect: 1,
          values: ["eigentuemer"],
        }),
      );
    }

    if (!hasField("firma")) {
      users.fields.push(
        new Field({
          type: "relation",
          name: "firma",
          required: false,
          collectionId: firmen.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      );
    }

    // API-Rules: Client darf nicht schreiben (ADR-0006/0009)
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;

    app.save(users);
  },
  (app) => {
    // Felder belassen (kein destruktives Downgrade auf Auth-Collection)
    try {
      const users = app.findCollectionByNameOrId("users");
      users.createRule = "";
      users.updateRule = "id = @request.auth.id";
      app.save(users);
    } catch (_) {
      /* ignore */
    }
  },
);
