/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 4 — Belege manuell + Dateien
 * - belege: firma-gebunden; Entwurf editierbar, nach Festschreibung immutable (ADR-0012)
 * - Datei als PocketBase-File-Feld (pb_data); Client create/update/delete gesperrt (ADR-0006)
 * - Festschreibung schreibt Journal-Eintrag (quelle_typ=beleg) über Next Domain-Service
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
      /* optional; Relation wird ohne Journal weggelassen */
    }

    try {
      app.findCollectionByNameOrId("belege");
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
        // YYYY-MM-DD Belegdatum (Nachweis)
        type: "text",
        name: "belegdatum",
        required: true,
        min: 10,
        max: 10,
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      {
        // YYYY-MM-DD Buchungstag (bei Festschreibung; Draft optional → Default Belegdatum)
        type: "text",
        name: "buchungsdatum",
        required: false,
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
        // Kategorie / Kostenart light (Freitext v1)
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
        type: "text",
        name: "konto",
        required: false,
        max: 20,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["entwurf", "festgeschrieben"],
      },
      {
        // Belegnummer erst bei Festschreibung (Nummernkreis Firma)
        type: "text",
        name: "belegnummer",
        required: false,
        max: 40,
      },
      {
        // ISO-8601 UTC Festschreibungszeitpunkt
        type: "text",
        name: "festgeschrieben_am",
        required: false,
        max: 40,
      },
      {
        // PDF/Bild am Beleg (immutable nach Festschreibung — Repository-Enforcement)
        type: "file",
        name: "datei",
        required: false,
        maxSelect: 1,
        maxSize: 15728640, // 15 MiB
        mimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ],
        thumbs: ["200x200"],
      },
    ];

    if (kontakteId) {
      fields.push({
        type: "relation",
        name: "lieferant",
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

    const belege = new Collection({
      type: "base",
      name: "belege",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields,
      indexes: [
        "CREATE INDEX idx_belege_firma ON belege (firma)",
        "CREATE INDEX idx_belege_firma_status ON belege (firma, status)",
        "CREATE INDEX idx_belege_firma_datum ON belege (firma, belegdatum)",
        "CREATE UNIQUE INDEX idx_belege_firma_nummer ON belege (firma, belegnummer) WHERE belegnummer != ''",
      ],
    });
    app.save(belege);
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("belege");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
