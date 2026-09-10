/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 11 — Bankkonten + Kontoauszugs-Import + Matching light
 * - bankkonten: Stammdaten Zahlweg (mehrere pro Firma; getrennt vom Kassenbuch)
 * - bank_import_laeufe: Import-Lauf light (Format, Dateiname, Zähler)
 * - bank_bewegungen: Auszugszeilen; Status offen|gematcht|ignoriert; Idempotenz-Schlüssel
 * - Client create/update/delete gesperrt (ADR-0006); Next schreibt mit Superuser
 * - Geldbeträge als Text (decimal.js / ADR-0016)
 * - Matching erzeugt Zahlung über payments (kein Journal bei Zahlung)
 * - Kein PSD2 / FinTS; CSV first (MT940 Follow-up möglich)
 */
migrate(
  (app) => {
    const firmen = app.findCollectionByNameOrId("firmen");

    let rechnungenId = null;
    try {
      rechnungenId = app.findCollectionByNameOrId("rechnungen").id;
    } catch (_) {
      /* optional relation */
    }

    let zahlungenId = null;
    try {
      zahlungenId = app.findCollectionByNameOrId("zahlungen").id;
    } catch (_) {
      /* optional relation */
    }

    // --- bankkonten ---
    let bankkontenExists = false;
    try {
      app.findCollectionByNameOrId("bankkonten");
      bankkontenExists = true;
    } catch {
      /* create below */
    }

    if (!bankkontenExists) {
      const bankkonten = new Collection({
        type: "base",
        name: "bankkonten",
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
            max: 120,
            presentable: true,
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
            type: "bool",
            name: "aktiv",
            required: false,
          },
          {
            type: "text",
            name: "notiz",
            required: false,
            max: 2000,
          },
        ],
        indexes: [
          "CREATE INDEX idx_bankkonten_firma ON bankkonten (firma)",
          "CREATE INDEX idx_bankkonten_firma_aktiv ON bankkonten (firma, aktiv)",
        ],
      });
      app.save(bankkonten);
    }

    const bankkontenCol = app.findCollectionByNameOrId("bankkonten");

    // --- bank_import_laeufe ---
    let laeufeExists = false;
    try {
      app.findCollectionByNameOrId("bank_import_laeufe");
      laeufeExists = true;
    } catch {
      /* create below */
    }

    if (!laeufeExists) {
      const laeufe = new Collection({
        type: "base",
        name: "bank_import_laeufe",
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
            name: "bankkonto",
            required: true,
            collectionId: bankkontenCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            // csv | mt940 (mt940 Follow-up; Enum vorbereitet)
            type: "select",
            name: "format",
            required: true,
            maxSelect: 1,
            values: ["csv", "mt940"],
          },
          {
            type: "text",
            name: "dateiname",
            required: false,
            max: 255,
          },
          {
            // ISO-8601 UTC
            type: "text",
            name: "importiert_am",
            required: true,
            min: 1,
            max: 40,
          },
          {
            // Zähler als Text (PB required number 0 = blank)
            type: "text",
            name: "zeilen_gesamt",
            required: true,
            min: 1,
            max: 16,
          },
          {
            type: "text",
            name: "zeilen_neu",
            required: true,
            min: 1,
            max: 16,
          },
          {
            type: "text",
            name: "zeilen_duplikat",
            required: true,
            min: 1,
            max: 16,
          },
          {
            type: "text",
            name: "notiz",
            required: false,
            max: 2000,
          },
        ],
        indexes: [
          "CREATE INDEX idx_bank_import_firma ON bank_import_laeufe (firma)",
          "CREATE INDEX idx_bank_import_konto ON bank_import_laeufe (firma, bankkonto)",
        ],
      });
      app.save(laeufe);
    }

    const laeufeCol = app.findCollectionByNameOrId("bank_import_laeufe");

    // --- bank_bewegungen ---
    let bewegungenExists = false;
    try {
      app.findCollectionByNameOrId("bank_bewegungen");
      bewegungenExists = true;
    } catch {
      /* create below */
    }

    if (!bewegungenExists) {
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
          type: "relation",
          name: "bankkonto",
          required: true,
          collectionId: bankkontenCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: "relation",
          name: "import_lauf",
          required: false,
          collectionId: laeufeCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          // YYYY-MM-DD Buchungstag (Europe/Berlin-Auswertung in Next)
          type: "text",
          name: "datum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          // eingang = Gutschrift / Zahlungseingang; ausgang = Belastung
          type: "select",
          name: "richtung",
          required: true,
          maxSelect: 1,
          values: ["eingang", "ausgang"],
        },
        {
          // Absoluter Betrag als Text (decimal.js); Richtung separat
          type: "text",
          name: "betrag",
          required: true,
          min: 1,
          max: 32,
        },
        {
          type: "text",
          name: "verwendungszweck",
          required: false,
          max: 2000,
        },
        {
          type: "text",
          name: "gegenkonto_name",
          required: false,
          max: 200,
        },
        {
          type: "text",
          name: "gegenkonto_iban",
          required: false,
          max: 34,
        },
        {
          type: "text",
          name: "referenz",
          required: false,
          max: 200,
        },
        {
          // offen | gematcht | ignoriert
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["offen", "gematcht", "ignoriert"],
        },
        {
          // Hash-Schlüssel für Idempotenz (firma+bankkonto unique)
          type: "text",
          name: "idempotenz_schluessel",
          required: true,
          min: 8,
          max: 64,
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
          required: false,
          collectionId: rechnungenId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      if (zahlungenId) {
        fields.push({
          type: "relation",
          name: "zahlung",
          required: false,
          collectionId: zahlungenId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const bewegungen = new Collection({
        type: "base",
        name: "bank_bewegungen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_bank_bew_firma ON bank_bewegungen (firma)",
          "CREATE INDEX idx_bank_bew_konto ON bank_bewegungen (firma, bankkonto)",
          "CREATE INDEX idx_bank_bew_status ON bank_bewegungen (firma, status)",
          "CREATE INDEX idx_bank_bew_datum ON bank_bewegungen (firma, datum)",
          "CREATE UNIQUE INDEX idx_bank_bew_idem ON bank_bewegungen (firma, bankkonto, idempotenz_schluessel)",
        ],
      });
      app.save(bewegungen);
    }
  },
  (app) => {
    try {
      const b = app.findCollectionByNameOrId("bank_bewegungen");
      app.delete(b);
    } catch (_) {
      /* ignore */
    }
    try {
      const l = app.findCollectionByNameOrId("bank_import_laeufe");
      app.delete(l);
    } catch (_) {
      /* ignore */
    }
    try {
      const k = app.findCollectionByNameOrId("bankkonten");
      app.delete(k);
    } catch (_) {
      /* ignore */
    }
  },
);
