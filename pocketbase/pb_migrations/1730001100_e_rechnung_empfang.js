/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 12 — E-Rechnung Empfang (Inbox)
 * - e_rechnungen_empfang: firma-gebunden; Originaldatei (PB-Files) + geparste Felder separat (ADR-0012)
 * - Client create/update/delete gesperrt (ADR-0006); Next schreibt mit Superuser
 * - Optional Relation zu Beleg (expenses); Empfang allein festschreibt nicht
 * - Geldbeträge als Text (decimal.js / ADR-0016)
 * - Kein Versand / kein Mustang-Sidecar (ADR-0003/0015)
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let belegeId = null;
    try {
      belegeId = app.findCollectionByNameOrId("belege").id;
    } catch (_) {
      /* optional relation */
    }

    try {
      app.findCollectionByNameOrId("e_rechnungen_empfang");
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
        // Originaldatei unverändert archiviert (ADR-0012); nie still überschreiben
        type: "file",
        name: "original_datei",
        required: true,
        maxSelect: 1,
        maxSize: 15728640, // 15 MiB
        mimeTypes: [
          "application/xml",
          "text/xml",
          "application/pdf",
          "application/octet-stream",
        ],
      },
      {
        // Anzeige-Dateiname (Original-Uploadname)
        type: "text",
        name: "original_dateiname",
        required: false,
        max: 255,
      },
      {
        // Erkanntes Format light
        type: "select",
        name: "format",
        required: true,
        maxSelect: 1,
        values: ["xrechnung_ubl", "zugferd_cii", "unbekannt"],
      },
      {
        // Parse-Ergebnis: ok | fehler
        type: "select",
        name: "parse_status",
        required: true,
        maxSelect: 1,
        values: ["ok", "fehler"],
      },
      {
        type: "text",
        name: "parse_fehler",
        required: false,
        max: 2000,
      },
      {
        // Serialisiertes ParsedEInvoice-DTO (JSON-Text); getrennt vom Original
        type: "text",
        name: "geparst_json",
        required: false,
        max: 100000,
      },
      {
        // Denormalisiert für Liste/Filter (aus DTO)
        type: "text",
        name: "rechnungsnummer",
        required: false,
        max: 80,
      },
      {
        // YYYY-MM-DD
        type: "text",
        name: "rechnungsdatum",
        required: false,
        max: 10,
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      {
        type: "text",
        name: "lieferant_name",
        required: false,
        max: 200,
      },
      {
        // Brutto als Text
        type: "text",
        name: "betrag_brutto",
        required: false,
        max: 32,
      },
      {
        // neu | beleg_erstellt | archiviert
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["neu", "beleg_erstellt", "archiviert"],
      },
      {
        // ISO-8601 UTC Empfangszeitpunkt
        type: "text",
        name: "empfangen_am",
        required: true,
        min: 1,
        max: 40,
      },
      {
        type: "text",
        name: "notiz",
        required: false,
        max: 2000,
      },
    ];

    if (belegeId) {
      fields.push({
        type: "relation",
        name: "beleg",
        required: false,
        collectionId: belegeId,
        maxSelect: 1,
        cascadeDelete: false,
      });
    }

    const col = new Collection({
      type: "base",
      name: "e_rechnungen_empfang",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields,
      indexes: [
        "CREATE INDEX idx_e_re_empfang_firma ON e_rechnungen_empfang (firma)",
        "CREATE INDEX idx_e_re_empfang_status ON e_rechnungen_empfang (firma, status)",
        "CREATE INDEX idx_e_re_empfang_parse ON e_rechnungen_empfang (firma, parse_status)",
        "CREATE INDEX idx_e_re_empfang_datum ON e_rechnungen_empfang (firma, rechnungsdatum)",
      ],
    });
    app.save(col);
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("e_rechnungen_empfang");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
