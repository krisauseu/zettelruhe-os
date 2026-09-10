/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 7 — Projekte light + Zeiteinträge + Fahrten
 * - projekte: optional je Kund:in (Stammdaten light)
 * - zeiteintraege: Kund:in Pflicht, Projekt optional; Dauer in Minuten; Status
 * - fahrten: Kund:in Pflicht, Projekt optional; km; Default abrechenbar
 * - Client create/update/delete gesperrt (ADR-0006); Next schreibt mit Superuser
 * - Kein Journal bei Zeit/Fahrt (erst über Rechnung)
 * - Geldbeträge/Sätze als Text (decimal.js / ADR-0016)
 * - required number: min ≥ 1 (PB behandelt 0 bei required number als blank)
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

    let rechnungenId = null;
    try {
      rechnungenId = app.findCollectionByNameOrId("rechnungen").id;
    } catch (_) {
      /* optional */
    }

    // --- projekte ---
    let projekteExists = false;
    try {
      app.findCollectionByNameOrId("projekte");
      projekteExists = true;
    } catch {
      /* create below */
    }

    if (!projekteExists) {
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
          type: "text",
          name: "name",
          required: true,
          min: 1,
          max: 200,
          presentable: true,
        },
        {
          type: "text",
          name: "notiz",
          required: false,
          max: 2000,
        },
        {
          // Default aktiv — UI filtert inaktiv light
          type: "bool",
          name: "aktiv",
          required: false,
        },
      ];

      if (kontakteId) {
        fields.push({
          type: "relation",
          name: "kunde",
          required: true,
          collectionId: kontakteId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const projekte = new Collection({
        type: "base",
        name: "projekte",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_projekte_firma ON projekte (firma)",
          "CREATE INDEX idx_projekte_firma_kunde ON projekte (firma, kunde)",
          "CREATE INDEX idx_projekte_firma_aktiv ON projekte (firma, aktiv)",
        ],
      });
      app.save(projekte);
    }

    let projekteId = null;
    try {
      projekteId = app.findCollectionByNameOrId("projekte").id;
    } catch (_) {
      /* optional */
    }

    // --- zeiteintraege ---
    let zeitExists = false;
    try {
      app.findCollectionByNameOrId("zeiteintraege");
      zeitExists = true;
    } catch {
      /* create below */
    }

    if (!zeitExists) {
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
          // YYYY-MM-DD
          type: "text",
          name: "datum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          // Dauer in Minuten (min 1 — PB required number: 0 = blank)
          type: "number",
          name: "dauer_minuten",
          required: true,
          min: 1,
          max: 100000,
        },
        {
          type: "text",
          name: "beschreibung",
          required: false,
          max: 2000,
        },
        {
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["abrechenbar", "nicht_abrechenbar", "abgerechnet"],
        },
        {
          // Optionaler Stundensatz (EUR, Text) für spätere Rechnungsübernahme
          type: "text",
          name: "stundensatz",
          required: false,
          max: 32,
        },
      ];

      if (kontakteId) {
        fields.push({
          type: "relation",
          name: "kunde",
          required: true,
          collectionId: kontakteId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      if (projekteId) {
        fields.push({
          type: "relation",
          name: "projekt",
          required: false,
          collectionId: projekteId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      if (rechnungenId) {
        fields.push({
          // Nach Übernahme in Rechnung (light Referenz)
          type: "relation",
          name: "rechnung",
          required: false,
          collectionId: rechnungenId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const zeiteintraege = new Collection({
        type: "base",
        name: "zeiteintraege",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_zeit_firma ON zeiteintraege (firma)",
          "CREATE INDEX idx_zeit_firma_status ON zeiteintraege (firma, status)",
          "CREATE INDEX idx_zeit_firma_datum ON zeiteintraege (firma, datum)",
          "CREATE INDEX idx_zeit_firma_kunde ON zeiteintraege (firma, kunde)",
        ],
      });
      app.save(zeiteintraege);
    }

    // --- fahrten ---
    let fahrtenExists = false;
    try {
      app.findCollectionByNameOrId("fahrten");
      fahrtenExists = true;
    } catch {
      /* create below */
    }

    if (!fahrtenExists) {
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
          // YYYY-MM-DD
          type: "text",
          name: "datum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          // Kilometer als Text (de-DE-Eingabe → normalisiert; ADR-0016 light)
          type: "text",
          name: "km",
          required: true,
          min: 1,
          max: 32,
        },
        {
          // Strecke / Zweck light
          type: "text",
          name: "strecke",
          required: false,
          max: 500,
        },
        {
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["abrechenbar", "nicht_abrechenbar", "abgerechnet"],
        },
        {
          // Optional steuerlich relevant (light Flag, keine AfA/Pauschalen)
          type: "bool",
          name: "steuerlich_relevant",
          required: false,
        },
        {
          type: "text",
          name: "steuer_notiz",
          required: false,
          max: 500,
        },
        {
          // Optionaler km-Satz (EUR) für Rechnungsübernahme
          type: "text",
          name: "km_satz",
          required: false,
          max: 32,
        },
      ];

      if (kontakteId) {
        fields.push({
          type: "relation",
          name: "kunde",
          required: true,
          collectionId: kontakteId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      if (projekteId) {
        fields.push({
          type: "relation",
          name: "projekt",
          required: false,
          collectionId: projekteId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      if (rechnungenId) {
        fields.push({
          type: "relation",
          name: "rechnung",
          required: false,
          collectionId: rechnungenId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const fahrten = new Collection({
        type: "base",
        name: "fahrten",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_fahrten_firma ON fahrten (firma)",
          "CREATE INDEX idx_fahrten_firma_status ON fahrten (firma, status)",
          "CREATE INDEX idx_fahrten_firma_datum ON fahrten (firma, datum)",
          "CREATE INDEX idx_fahrten_firma_kunde ON fahrten (firma, kunde)",
        ],
      });
      app.save(fahrten);
    }
  },
  (app) => {
    try {
      const fahrten = app.findCollectionByNameOrId("fahrten");
      app.delete(fahrten);
    } catch (_) {
      /* ignore */
    }
    try {
      const zeit = app.findCollectionByNameOrId("zeiteintraege");
      app.delete(zeit);
    } catch (_) {
      /* ignore */
    }
    try {
      const projekte = app.findCollectionByNameOrId("projekte");
      app.delete(projekte);
    } catch (_) {
      /* ignore */
    }
  },
);
