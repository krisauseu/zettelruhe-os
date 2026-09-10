/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 5 — Sales light: Rechnungen (+ Positionen)
 * - rechnungen / rechnungspositionen: firma-gebunden
 * - Entwurf editierbar; nach Festschreibung immutable inkl. PDF (ADR-0012)
 * - Client create/update/delete gesperrt (ADR-0006)
 * - Festschreibung: Rechnungsnummer + PDF + Journal (quelle_typ=rechnung) über Next
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
      /* optional */
    }

    let katalogId = null;
    try {
      katalogId = app.findCollectionByNameOrId("katalog_positionen").id;
    } catch (_) {
      /* optional */
    }

    // --- rechnungen ---
    let rechnungenExists = false;
    try {
      app.findCollectionByNameOrId("rechnungen");
      rechnungenExists = true;
    } catch {
      /* create below */
    }

    if (!rechnungenExists) {
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
          name: "rechnungsdatum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "leistungszeitraum_von",
          required: false,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "leistungszeitraum_bis",
          required: false,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "faellig_am",
          required: false,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "notiz",
          required: false,
          max: 2000,
        },
        {
          // entwurf | offen (nach Festschreibung); weitere Status später (Teilbezahlt …)
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["entwurf", "offen"],
        },
        {
          // Erst bei Festschreibung (Nummernkreis Firma)
          type: "text",
          name: "rechnungsnummer",
          required: false,
          max: 40,
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
          type: "text",
          name: "betrag_brutto",
          required: true,
          min: 1,
          max: 32,
        },
        {
          // Snapshot Steuer-Modus bei Anlage/Speichern (historisch korrekt im PDF)
          type: "select",
          name: "steuermodus",
          required: true,
          maxSelect: 1,
          values: ["kleinunternehmer", "regelbesteuerung_ist"],
        },
        {
          // ISO-8601 UTC Festschreibungszeitpunkt
          type: "text",
          name: "festgeschrieben_am",
          required: false,
          max: 40,
        },
        {
          // Generiertes PDF (immutable nach Festschreibung — Repository)
          type: "file",
          name: "pdf",
          required: false,
          maxSelect: 1,
          maxSize: 15728640, // 15 MiB
          mimeTypes: ["application/pdf"],
        },
      ];

      if (kontakteId) {
        fields.push({
          type: "relation",
          name: "kunde",
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

      const rechnungen = new Collection({
        type: "base",
        name: "rechnungen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_rechnungen_firma ON rechnungen (firma)",
          "CREATE INDEX idx_rechnungen_firma_status ON rechnungen (firma, status)",
          "CREATE INDEX idx_rechnungen_firma_datum ON rechnungen (firma, rechnungsdatum)",
          "CREATE UNIQUE INDEX idx_rechnungen_firma_nummer ON rechnungen (firma, rechnungsnummer) WHERE rechnungsnummer != ''",
        ],
      });
      app.save(rechnungen);
    }

    // --- rechnungspositionen ---
    let posExists = false;
    try {
      app.findCollectionByNameOrId("rechnungspositionen");
      posExists = true;
    } catch {
      /* create below */
    }

    if (!posExists) {
      const rechnungenCol = app.findCollectionByNameOrId("rechnungen");

      const posFields = [
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
          name: "rechnung",
          required: true,
          collectionId: rechnungenCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: "number",
          name: "sortierung",
          required: true,
          min: 0,
        },
        {
          type: "text",
          name: "bezeichnung",
          required: true,
          min: 1,
          max: 500,
        },
        {
          // Menge als Text (decimal.js)
          type: "text",
          name: "menge",
          required: true,
          min: 1,
          max: 32,
        },
        {
          type: "text",
          name: "einheit",
          required: false,
          max: 40,
        },
        {
          // Einzelpreis netto
          type: "text",
          name: "einzelpreis",
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
          type: "text",
          name: "betrag_brutto",
          required: true,
          min: 1,
          max: 32,
        },
      ];

      if (katalogId) {
        posFields.push({
          type: "relation",
          name: "katalog_position",
          required: false,
          collectionId: katalogId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const positionen = new Collection({
        type: "base",
        name: "rechnungspositionen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: posFields,
        indexes: [
          "CREATE INDEX idx_rpos_firma ON rechnungspositionen (firma)",
          "CREATE INDEX idx_rpos_rechnung ON rechnungspositionen (rechnung)",
          "CREATE INDEX idx_rpos_rechnung_sort ON rechnungspositionen (rechnung, sortierung)",
        ],
      });
      app.save(positionen);
    }
  },
  (app) => {
    try {
      const pos = app.findCollectionByNameOrId("rechnungspositionen");
      app.delete(pos);
    } catch (_) {
      /* ignore */
    }
    try {
      const col = app.findCollectionByNameOrId("rechnungen");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
