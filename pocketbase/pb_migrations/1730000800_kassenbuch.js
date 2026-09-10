/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 9 — Kassenbuch
 * - kassenbuch_eintraege: firma-gebunden; Bareinnahmen/-ausgaben mit Belegnummer
 * - Anlegen = Festschreibung; Client create/update/delete gesperrt (ADR-0004, ADR-0006)
 * - Fließt ins Buchungsjournal (quelle_typ=kasse) über Next Domain-Service
 * - Korrektur nur über Storno/Gegenbuchung (storno_von)
 * - Eine Kasse pro Firma in v1 light (kein Multi-Kassen-Feld)
 * Geldbeträge als Text (decimal.js / ADR-0016).
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let kontakteId = null;
    try {
      kontakteId = app.findCollectionByNameOrId("kontakte").id;
    } catch (_) {
      /* optional */
    }

    let journalId = null;
    try {
      journalId = app.findCollectionByNameOrId("buchungsjournal").id;
    } catch (_) {
      /* optional; Relation ohne Journal weglassen */
    }

    try {
      app.findCollectionByNameOrId("kassenbuch_eintraege");
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
        // YYYY-MM-DD Kassenbuch-Tag (Europe/Berlin-Auswertung in Next)
        type: "text",
        name: "datum",
        required: true,
        min: 10,
        max: 10,
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      {
        type: "select",
        name: "richtung",
        required: true,
        maxSelect: 1,
        values: ["einnahme", "ausgabe"],
      },
      {
        type: "text",
        name: "betrag_netto",
        required: true,
        min: 1,
        max: 32,
      },
      {
        type: "text",
        name: "betrag_ust",
        required: true,
        min: 1,
        max: 32,
      },
      {
        // Kassenwirksamer Betrag (Brutto) — Saldo basiert darauf
        type: "text",
        name: "betrag_brutto",
        required: true,
        min: 1,
        max: 32,
      },
      {
        type: "select",
        name: "steuersatz",
        required: false,
        maxSelect: 1,
        values: ["0", "7", "19"],
      },
      {
        type: "text",
        name: "text",
        required: true,
        min: 1,
        max: 500,
        presentable: true,
      },
      {
        type: "text",
        name: "kategorie",
        required: false,
        max: 120,
      },
      {
        type: "text",
        name: "notiz",
        required: false,
        max: 2000,
      },
      {
        // Belegnummer aus Nummernkreis Firma (bei Festschreibung = Anlegen)
        type: "text",
        name: "belegnummer",
        required: true,
        min: 1,
        max: 40,
      },
      {
        // ISO-8601 UTC Festschreibungszeitpunkt
        type: "text",
        name: "festgeschrieben_am",
        required: true,
        min: 1,
        max: 40,
      },
    ];

    if (kontakteId) {
      fields.push({
        type: "relation",
        name: "kontakt",
        required: false,
        collectionId: kontakteId,
        maxSelect: 1,
        cascadeDelete: false,
      });
    }

    if (journalId) {
      fields.push({
        type: "relation",
        name: "journal_eintrag",
        required: false,
        collectionId: journalId,
        maxSelect: 1,
        cascadeDelete: false,
      });
    }

    const kasse = new Collection({
      type: "base",
      name: "kassenbuch_eintraege",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields,
      indexes: [
        "CREATE INDEX idx_kasse_firma ON kassenbuch_eintraege (firma)",
        "CREATE INDEX idx_kasse_firma_datum ON kassenbuch_eintraege (firma, datum)",
        "CREATE UNIQUE INDEX idx_kasse_firma_nummer ON kassenbuch_eintraege (firma, belegnummer)",
      ],
    });
    app.save(kasse);

    // Self-Relation storno_von nach erstem Save
    kasse.fields.push(
      new Field({
        type: "relation",
        name: "storno_von",
        required: false,
        collectionId: kasse.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    app.save(kasse);
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("kassenbuch_eintraege");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
