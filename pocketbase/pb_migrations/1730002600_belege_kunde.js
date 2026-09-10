/// <reference path="../pb_data/types.d.ts" />

/**
 * Beleg-Geschäftspartner je Buchungsrichtung:
 * Ausgabe → relation lieferant (unverändert), Einnahme → relation kunde.
 * Einnahme-Belege, die bisher eine Lieferant:in trugen, werden nur dann
 * auf kunde umgehängt, wenn der Kontakt Kund:in ist; sonst geleert.
 */
migrate(
  (app) => {
    const belege = app.findCollectionByNameOrId("belege");
    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    let kontakteId = null;
    try {
      kontakteId = app.findCollectionByNameOrId("kontakte").id;
    } catch {
      return;
    }

    if (!hasField(belege, "kunde")) {
      belege.fields.push(
        new Field({
          type: "relation",
          name: "kunde",
          required: false,
          collectionId: kontakteId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      );
      app.save(belege);
    }

    const asId = (raw) => {
      if (raw == null || raw === "") return "";
      if (Array.isArray(raw)) return String(raw[0] || "").trim();
      return String(raw).trim();
    };

    const records = app.findAllRecords("belege");
    for (const r of records) {
      const richtung = String(r.get("richtung") || "");
      if (richtung !== "einnahme") continue;
      const lieferant = asId(r.get("lieferant"));
      const kunde = asId(r.get("kunde"));
      if (!lieferant || kunde) continue;

      let move = false;
      try {
        const k = app.findRecordById("kontakte", lieferant);
        move = Boolean(k.get("ist_kunde"));
      } catch {
        move = false;
      }
      if (move) {
        r.set("kunde", lieferant);
      }
      r.set("lieferant", "");
      app.save(r);
    }
  },
  (app) => {
    try {
      const belege = app.findCollectionByNameOrId("belege");
      if (typeof belege.fields.removeByName === "function") {
        belege.fields.removeByName("kunde");
        app.save(belege);
      }
    } catch {
      /* ignore */
    }
  },
);
