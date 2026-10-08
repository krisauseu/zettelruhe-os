/// <reference path="../pb_data/types.d.ts" />

// Optional instance initialization. An absent record preserves existing setups.
// The provisioning service alone creates the pending singleton for new instances.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const firmen = app.findCollectionByNameOrId("firmen");
    app.save(new Collection({
      type: "base",
      name: "instanz_einrichtung",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "eigentuemer", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
        { type: "relation", name: "firma", required: true, collectionId: firmen.id, maxSelect: 1, cascadeDelete: false },
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "complete"] },
      ],
    }));
    // No records or user changes: historic instances remain untouched.
  },
  () => {
    // Preserve a committed setup decision during a downgrade.
  },
);
