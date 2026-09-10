/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 2 — Kontakte + Produkt- & Leistungskatalog
 * - kontakte (multi-firma, Rollen Kund:in/Lieferant:in)
 * - ansprechpartner (an Kontakt gebunden)
 * - katalog_positionen (Preise als Text; USt-Satz optional)
 * Client-Writes gesperrt (ADR-0006); Next schreibt mit Superuser.
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    // --- Kontakte ---
    let kontakte;
    try {
      kontakte = app.findCollectionByNameOrId("kontakte");
    } catch {
      kontakte = new Collection({
        type: "base",
        name: "kontakte",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "firma",
            required: true,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "text",
            name: "name",
            required: true,
            min: 1,
            max: 200,
            presentable: true,
          },
          {
            type: "bool",
            name: "ist_kunde",
            required: false,
          },
          {
            type: "bool",
            name: "ist_lieferant",
            required: false,
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
            type: "email",
            name: "email",
            required: false,
          },
          {
            type: "text",
            name: "telefon",
            required: false,
            max: 64,
          },
          {
            type: "text",
            name: "iban",
            required: false,
            max: 34,
          },
          {
            type: "text",
            name: "bic",
            required: false,
            max: 11,
          },
          {
            type: "text",
            name: "notiz",
            required: false,
            max: 2000,
          },
        ],
        indexes: [
          "CREATE INDEX idx_kontakte_firma ON kontakte (firma)",
          "CREATE INDEX idx_kontakte_firma_name ON kontakte (firma, name)",
        ],
      });
      app.save(kontakte);
    }

    // --- Ansprechpartner (an Kontakt) ---
    let ansprechpartner;
    try {
      ansprechpartner = app.findCollectionByNameOrId("ansprechpartner");
    } catch {
      ansprechpartner = new Collection({
        type: "base",
        name: "ansprechpartner",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "firma",
            required: true,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "relation",
            name: "kontakt",
            required: true,
            collectionId: kontakte.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "text",
            name: "name",
            required: true,
            min: 1,
            max: 200,
            presentable: true,
          },
          {
            type: "email",
            name: "email",
            required: false,
          },
          {
            type: "text",
            name: "telefon",
            required: false,
            max: 64,
          },
          {
            type: "text",
            name: "position",
            required: false,
            max: 120,
          },
        ],
        indexes: [
          "CREATE INDEX idx_ansprechpartner_kontakt ON ansprechpartner (kontakt)",
          "CREATE INDEX idx_ansprechpartner_firma ON ansprechpartner (firma)",
        ],
      });
      app.save(ansprechpartner);
    }

    // --- Katalog-Positionen (Produkte/Leistungen) ---
    let katalog;
    try {
      katalog = app.findCollectionByNameOrId("katalog_positionen");
    } catch {
      katalog = new Collection({
        type: "base",
        name: "katalog_positionen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "firma",
            required: true,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "text",
            name: "bezeichnung",
            required: true,
            min: 1,
            max: 300,
            presentable: true,
          },
          {
            type: "text",
            name: "einheit",
            required: true,
            min: 1,
            max: 40,
          },
          {
            // Geldbetrag als Text (decimal.js / ADR-0016) — keine Floats
            type: "text",
            name: "preis",
            required: true,
            min: 1,
            max: 32,
          },
          {
            // Relevant nur unter Regelbesteuerung; unter Kleinunternehmerregelung oft leer/0
            type: "select",
            name: "steuersatz",
            required: false,
            maxSelect: 1,
            values: ["0", "7", "19"],
          },
          {
            type: "text",
            name: "notiz",
            required: false,
            max: 2000,
          },
          {
            type: "bool",
            name: "aktiv",
            required: false,
          },
        ],
        indexes: [
          "CREATE INDEX idx_katalog_firma ON katalog_positionen (firma)",
          "CREATE INDEX idx_katalog_firma_bezeichnung ON katalog_positionen (firma, bezeichnung)",
        ],
      });
      app.save(katalog);
    }
  },
  (app) => {
    for (const name of [
      "katalog_positionen",
      "ansprechpartner",
      "kontakte",
    ]) {
      try {
        const col = app.findCollectionByNameOrId(name);
        app.delete(col);
      } catch (_) {
        /* ignore */
      }
    }
  },
);
