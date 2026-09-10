/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 3 — Journal-Kern (Buchungsjournal)
 * - buchungsjournal: unveränderbare, firma-gebundene Buchungseinträge
 * - Anlegen = Festschreibung; Client create/update/delete gesperrt (ADR-0004, ADR-0006)
 * - Korrekturen später nur über Storno/Gegenbuchung (storno_von)
 * Geldbeträge als Text (decimal.js / ADR-0016).
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let kontakteId = null;
    try {
      kontakteId = app.findCollectionByNameOrId("kontakte").id;
    } catch (_) {
      /* Kontakte optional für Relation; ohne Feld bleibt leer */
    }

    let journal;
    try {
      journal = app.findCollectionByNameOrId("buchungsjournal");
    } catch {
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
          // Fortlaufende Nr. je Firma (bei Festschreibung vergeben)
          type: "number",
          name: "laufende_nr",
          required: true,
          min: 1,
          onlyInt: true,
        },
        {
          // Steuerlicher Buchungstag YYYY-MM-DD (Europe/Berlin-Auswertung in Next)
          type: "text",
          name: "buchungsdatum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "belegdatum",
          required: false,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          type: "text",
          name: "buchungstext",
          required: true,
          min: 1,
          max: 500,
          presentable: true,
        },
        {
          // EÜR-Richtung (kein volles Soll/Haben-Hauptbuch in v1)
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
          // SKR-Konto (optional, Text)
          type: "text",
          name: "konto",
          required: false,
          max: 20,
        },
        {
          // Quelle der Buchung — vorbereitet für Beleg/Rechnung/Kasse
          type: "select",
          name: "quelle_typ",
          required: true,
          maxSelect: 1,
          values: ["manuell", "beleg", "rechnung", "kasse", "storno", "system"],
        },
        {
          // ID des Quell-Records (wenn Collection existiert)
          type: "text",
          name: "quelle_id",
          required: false,
          max: 64,
        },
        {
          // ISO-8601 UTC: Zeitpunkt der Festschreibung (= Anlegen)
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

      // Self-Relation storno_von: Collection muss zuerst ohne, dann mit Feld
      journal = new Collection({
        type: "base",
        name: "buchungsjournal",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_journal_firma ON buchungsjournal (firma)",
          "CREATE UNIQUE INDEX idx_journal_firma_nr ON buchungsjournal (firma, laufende_nr)",
          "CREATE INDEX idx_journal_firma_datum ON buchungsjournal (firma, buchungsdatum)",
          "CREATE INDEX idx_journal_quelle ON buchungsjournal (firma, quelle_typ, quelle_id)",
        ],
      });
      app.save(journal);

      // storno_von nach dem ersten Save (Self-Relation)
      journal.fields.push(
        new Field({
          type: "relation",
          name: "storno_von",
          required: false,
          collectionId: journal.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      );
      app.save(journal);
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("buchungsjournal");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
  },
);
