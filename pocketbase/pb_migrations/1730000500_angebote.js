/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 6 — Angebote (+ Positionen)
 * - angebote / angebotspositionen: firma-gebunden
 * - Entwurf editierbar; nach Senden: Inhalt/PDF immutable light (Statuswechsel erlaubt)
 * - Client create/update/delete gesperrt (ADR-0006)
 * - Senden: Angebotsnummer + PDF (kein Journal — erst bei Rechnung)
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

    let katalogId = null;
    try {
      katalogId = app.findCollectionByNameOrId("katalog_positionen").id;
    } catch (_) {
      /* optional */
    }

    let rechnungenId = null;
    try {
      rechnungenId = app.findCollectionByNameOrId("rechnungen").id;
    } catch (_) {
      /* optional */
    }

    // --- angebote ---
    let angeboteExists = false;
    try {
      app.findCollectionByNameOrId("angebote");
      angeboteExists = true;
    } catch {
      /* create below */
    }

    if (!angeboteExists) {
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
          name: "angebotsdatum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "gueltig_bis",
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
          // Entwurf → Gesendet → Angenommen / Abgelehnt / Abgelaufen → Abgerechnet
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: [
            "entwurf",
            "gesendet",
            "angenommen",
            "abgelehnt",
            "abgelaufen",
            "abgerechnet",
          ],
        },
        {
          // Erst bei Senden (Nummernkreis Firma)
          type: "text",
          name: "angebotsnummer",
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
          // Snapshot Steuer-Modus bei Anlage/Speichern
          type: "select",
          name: "steuermodus",
          required: true,
          maxSelect: 1,
          values: ["kleinunternehmer", "regelbesteuerung_ist"],
        },
        {
          // ISO-8601 UTC Zeitpunkt des Sendens
          type: "text",
          name: "gesendet_am",
          required: false,
          max: 40,
        },
        {
          // Generiertes PDF (immutable nach Senden — Repository)
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

      const angebote = new Collection({
        type: "base",
        name: "angebote",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_angebote_firma ON angebote (firma)",
          "CREATE INDEX idx_angebote_firma_status ON angebote (firma, status)",
          "CREATE INDEX idx_angebote_firma_datum ON angebote (firma, angebotsdatum)",
          "CREATE UNIQUE INDEX idx_angebote_firma_nummer ON angebote (firma, angebotsnummer) WHERE angebotsnummer != ''",
        ],
      });
      app.save(angebote);
    }

    // --- angebotspositionen ---
    let posExists = false;
    try {
      app.findCollectionByNameOrId("angebotspositionen");
      posExists = true;
    } catch {
      /* create below */
    }

    if (!posExists) {
      const angeboteCol = app.findCollectionByNameOrId("angebote");

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
          name: "angebot",
          required: true,
          collectionId: angeboteCol.id,
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
        name: "angebotspositionen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: posFields,
        indexes: [
          "CREATE INDEX idx_apos_firma ON angebotspositionen (firma)",
          "CREATE INDEX idx_apos_angebot ON angebotspositionen (angebot)",
          "CREATE INDEX idx_apos_angebot_sort ON angebotspositionen (angebot, sortierung)",
        ],
      });
      app.save(positionen);
    }
  },
  (app) => {
    try {
      const pos = app.findCollectionByNameOrId("angebotspositionen");
      app.delete(pos);
    } catch (_) {
      /* ignore */
    }
    try {
      const col = app.findCollectionByNameOrId("angebote");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
