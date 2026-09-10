/// <reference path="../pb_data/types.d.ts" />

/**
 * Ist-Versteuerung: Journal-Quelle „zahlung“.
 * Bestehende Werte bleiben; nur erweitern (ADR-0024).
 */
migrate(
  (app) => {
    const journal = app.findCollectionByNameOrId("buchungsjournal");
    const quelle = journal.fields.getByName("quelle_typ");
    if (!quelle) {
      throw new Error("buchungsjournal.quelle_typ field not found");
    }

    const values = Array.isArray(quelle.values) ? [...quelle.values] : [];
    if (!values.includes("zahlung")) {
      values.push("zahlung");
    }
    quelle.values = values;
    if (typeof quelle.maxSelect === "number") {
      quelle.maxSelect = 1;
    }

    app.save(journal);
  },
  (app) => {
    // Nicht zurücksetzen: Datensätze könnten quelle_typ=zahlung haben
  },
);
