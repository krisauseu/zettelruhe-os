/// <reference path="../pb_data/types.d.ts" />

/**
 * Multi-User / grobe Rechte (ADR-0025).
 * Mitgliedschaft User↔Firma mit Rolle; users.role um "nutzer" ergänzen.
 * Backfill: bestehende Instanz-Eigentümer:innen werden Eigentümer:in
 * aller vorhandenen Firmen (bisheriger Alltag).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const firmen = app.findCollectionByNameOrId("firmen");

    const roleField = users.fields.getByName("role");
    if (roleField) {
      const values = Array.isArray(roleField.values)
        ? [...roleField.values]
        : [];
      if (!values.includes("nutzer")) {
        values.push("nutzer");
      }
      if (!values.includes("eigentuemer")) {
        values.unshift("eigentuemer");
      }
      roleField.values = values;
    }
    app.save(users);

    let mitgliedschaften;
    try {
      mitgliedschaften = app.findCollectionByNameOrId("mitgliedschaften");
    } catch {
      mitgliedschaften = new Collection({
        type: "base",
        name: "mitgliedschaften",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "user",
            required: true,
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
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
            name: "rolle",
            required: true,
            maxSelect: 1,
            values: ["eigentuemer", "bearbeiten", "lesen"],
          },
        ],
        indexes: [
          "CREATE INDEX idx_mitgliedschaften_user ON mitgliedschaften (user)",
          "CREATE INDEX idx_mitgliedschaften_firma ON mitgliedschaften (firma)",
          "CREATE UNIQUE INDEX idx_mitgliedschaften_user_firma ON mitgliedschaften (user, firma)",
        ],
      });
      app.save(mitgliedschaften);
    }

    const vorhandene = app.findAllRecords("mitgliedschaften");
    const schon = {};
    for (const rec of vorhandene) {
      schon[`${rec.get("user")}|${rec.get("firma")}`] = true;
    }

    const alleFirmen = app.findAllRecords("firmen");
    const alleUsers = app.findAllRecords("users");

    for (const user of alleUsers) {
      const instanzRolle = user.get("role");
      if (instanzRolle === "eigentuemer") {
        for (const firma of alleFirmen) {
          const key = `${user.id}|${firma.id}`;
          if (schon[key]) continue;
          const rec = new Record(mitgliedschaften);
          rec.set("user", user.id);
          rec.set("firma", firma.id);
          rec.set("rolle", "eigentuemer");
          app.save(rec);
          schon[key] = true;
        }
        continue;
      }

      const letzteFirma = user.get("firma");
      if (!letzteFirma) continue;
      const key = `${user.id}|${letzteFirma}`;
      if (schon[key]) continue;
      const rec = new Record(mitgliedschaften);
      rec.set("user", user.id);
      rec.set("firma", letzteFirma);
      rec.set("rolle", "bearbeiten");
      app.save(rec);
      schon[key] = true;
    }
  },
  (app) => {
    try {
      const mitgliedschaften = app.findCollectionByNameOrId("mitgliedschaften");
      app.delete(mitgliedschaften);
    } catch {
      /* ignore */
    }
  },
);
