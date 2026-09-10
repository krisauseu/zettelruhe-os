/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 8 — Zahlungen manuell (inkl. Teilzahlung)
 * - zahlungen: firma-gebunden, Relation zu rechnungen
 * - Rechnungsstatus erweitern: offen → teilbezahlt → bezahlt (+ ueberfaellig, storniert light)
 * - Client create/update/delete gesperrt (ADR-0006); Next schreibt mit Superuser
 * - Geldbeträge als Text (decimal.js / ADR-0016)
 * - Kein Journal bei Zahlung in Abschn. 8 (Ist-Versteuerung Follow-up); kein Bank-Match
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let rechnungenId = null;
    try {
      rechnungenId = app.findCollectionByNameOrId("rechnungen").id;
    } catch (_) {
      /* required for relation */
    }

    // --- rechnungen.status erweitern (bestehende „offen“ bleiben gültig) ---
    // Hinweis: robuste Nachzug-Migration 1730000701 falls Save hier scheitert
    try {
      const rechnungen = app.findCollectionByNameOrId("rechnungen");
      const statusField = rechnungen.fields.getByName("status");
      if (statusField) {
        statusField.values = [
          "entwurf",
          "offen",
          "teilbezahlt",
          "bezahlt",
          "ueberfaellig",
          "storniert",
        ];
        app.save(rechnungen);
      }
    } catch (_) {
      /* rechnungen ggf. noch nicht da — 0701 holt nach */
    }

    // --- zahlungen ---
    let zahlungenExists = false;
    try {
      app.findCollectionByNameOrId("zahlungen");
      zahlungenExists = true;
    } catch {
      /* create below */
    }

    if (!zahlungenExists) {
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
          // Geldbetrag als Text (decimal.js)
          type: "text",
          name: "betrag",
          required: true,
          min: 1,
          max: 32,
        },
        {
          // light: Bar | Überweisung | Sonstiges
          type: "select",
          name: "zahlungsweg",
          required: false,
          maxSelect: 1,
          values: ["bar", "ueberweisung", "sonstiges"],
        },
        {
          type: "text",
          name: "notiz",
          required: false,
          max: 2000,
        },
      ];

      if (rechnungenId) {
        fields.push({
          type: "relation",
          name: "rechnung",
          required: true,
          collectionId: rechnungenId,
          maxSelect: 1,
          cascadeDelete: true,
        });
      }

      const zahlungen = new Collection({
        type: "base",
        name: "zahlungen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_zahlungen_firma ON zahlungen (firma)",
          "CREATE INDEX idx_zahlungen_firma_rechnung ON zahlungen (firma, rechnung)",
          "CREATE INDEX idx_zahlungen_firma_datum ON zahlungen (firma, datum)",
        ],
      });
      app.save(zahlungen);
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("zahlungen");
      app.delete(col);
    } catch (_) {
      /* ignore */
    }
    // Status-Enum nicht zurücksetzen (Daten könnten neue Werte haben)
  },
);
