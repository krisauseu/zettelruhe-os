/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 1 — Fundament
 * - Auth-Collection "users" (Eigentümer:in; multi-user-fähig)
 * - Collection "firmen" inkl. Steuer-Modus, SKR-Wahl, Nummernkreise-Config
 * Client-Writes auf firmen/users sind gesperrt (ADR-0006 Vorbereitung).
 */
migrate(
  (app) => {
    // --- Firma zuerst (Relation-Ziel für users) ---
    let firmen;
    try {
      firmen = app.findCollectionByNameOrId("firmen");
    } catch {
      firmen = new Collection({
        type: "base",
        name: "firmen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "text",
            name: "name",
            required: true,
            min: 1,
            max: 200,
            presentable: true,
          },
          {
            type: "select",
            name: "steuermodus",
            required: true,
            maxSelect: 1,
            values: ["kleinunternehmer", "regelbesteuerung_ist"],
          },
          {
            type: "select",
            name: "skr",
            required: true,
            maxSelect: 1,
            values: ["skr03", "skr04"],
          },
          {
            type: "json",
            name: "nummernkreise",
            required: true,
          },
          {
            type: "text",
            name: "strasse",
            required: false,
            max: 200,
          },
          {
            type: "text",
            name: "plz",
            required: false,
            max: 20,
          },
          {
            type: "text",
            name: "ort",
            required: false,
            max: 120,
          },
          {
            type: "text",
            name: "land",
            required: false,
            max: 2,
          },
          {
            type: "text",
            name: "steuernummer",
            required: false,
            max: 64,
          },
          {
            type: "text",
            name: "ust_id",
            required: false,
            max: 32,
          },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_firmen_name ON firmen (name)",
        ],
      });
      app.save(firmen);
    }

    // --- Auth: App-Nutzer:innen ---
    // PocketBase legt "users" oft schon an → immer Felder role/firma nachziehen.
    let users;
    try {
      users = app.findCollectionByNameOrId("users");
    } catch {
      users = new Collection({
        type: "auth",
        name: "users",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "text",
            name: "name",
            required: true,
            min: 1,
            max: 200,
          },
          {
            type: "select",
            name: "role",
            required: true,
            maxSelect: 1,
            values: ["eigentuemer"],
          },
          {
            type: "relation",
            name: "firma",
            required: false,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
        ],
        passwordAuth: {
          enabled: true,
          identityFields: ["email"],
        },
        oauth2: {
          enabled: false,
        },
        otp: {
          enabled: false,
        },
        mfa: {
          enabled: false,
        },
      });
      app.save(users);
    }

    // Felder auf bestehender Default-users-Collection ergänzen
    const hasField = (name) =>
      (users.fields || []).some((f) => f.name === name);
    let usersDirty = false;
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
      usersDirty = true;
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
      usersDirty = true;
    }
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;
    if (usersDirty) {
      app.save(users);
    } else {
      // Rules immer setzen
      app.save(users);
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      app.delete(users);
    } catch (_) {
      /* ignore */
    }
    try {
      const firmen = app.findCollectionByNameOrId("firmen");
      app.delete(firmen);
    } catch (_) {
      /* ignore */
    }
  },
);
