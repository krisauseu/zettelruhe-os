/// <reference path="../pb_data/types.d.ts" />

/**
 * Bauabschnitt 10 — Wiederkehrende Rechnungen + Job-Locks/Runs
 * - wiederkehrende_rechnungen / wiederkehrende_rechnungspositionen: firma-gebunden
 * - Vorlage/Rhythmus; Job erzeugt Rechnungs-Entwurf (Nummernkreis erst bei Festschreibung)
 * - job_locks: globaler DB-Lock gegen Doppelausführung (ADR-0010)
 * - job_runs: light Laufprotokoll (optional UI)
 * - Client create/update/delete gesperrt (ADR-0006)
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

    // --- wiederkehrende_rechnungen ---
    let wrExists = false;
    try {
      app.findCollectionByNameOrId("wiederkehrende_rechnungen");
      wrExists = true;
    } catch {
      /* create below */
    }

    if (!wrExists) {
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
          // Anzeigename der Vorlage (z. B. „Hosting monatlich“)
          type: "text",
          name: "bezeichnung",
          required: true,
          min: 1,
          max: 200,
          presentable: true,
        },
        {
          // YYYY-MM-DD nächstes Ausstellungsdatum (Europe/Berlin-Auswertung in Next)
          type: "text",
          name: "naechstes_datum",
          required: true,
          min: 10,
          max: 10,
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        {
          // Rhythmus light (ADR/Session: eine klare Modellierung)
          // monatlich | quartalsweise | jaehrlich | tage (+ intervall_tage)
          type: "select",
          name: "rhythmus",
          required: true,
          maxSelect: 1,
          values: ["monatlich", "quartalsweise", "jaehrlich", "tage"],
        },
        {
          // Nur bei rhythmus=tage relevant; PB required number: 0 = blank → min 1, nicht required
          type: "number",
          name: "intervall_tage",
          required: false,
          min: 1,
          max: 3650,
        },
        {
          // Tage bis Fälligkeit ab Rechnungsdatum (Default 14 in Domain)
          type: "number",
          name: "zahlungsziel_tage",
          required: false,
          min: 0,
          max: 365,
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
          // Snapshot Steuer-Modus bei Speichern (Positionen/Summen)
          type: "select",
          name: "steuermodus",
          required: true,
          maxSelect: 1,
          values: ["kleinunternehmer", "regelbesteuerung_ist"],
        },
        {
          // ISO-8601 UTC letzter erfolgreicher Erzeugungslauf
          type: "text",
          name: "zuletzt_erzeugt_am",
          required: false,
          max: 40,
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
          type: "relation",
          name: "letzte_rechnung",
          required: false,
          collectionId: rechnungenId,
          maxSelect: 1,
          cascadeDelete: false,
        });
      }

      const wr = new Collection({
        type: "base",
        name: "wiederkehrende_rechnungen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields,
        indexes: [
          "CREATE INDEX idx_wr_firma ON wiederkehrende_rechnungen (firma)",
          "CREATE INDEX idx_wr_firma_aktiv ON wiederkehrende_rechnungen (firma, aktiv)",
          "CREATE INDEX idx_wr_firma_naechstes ON wiederkehrende_rechnungen (firma, naechstes_datum)",
        ],
      });
      app.save(wr);
    }

    // --- wiederkehrende_rechnungspositionen ---
    let wrPosExists = false;
    try {
      app.findCollectionByNameOrId("wiederkehrende_rechnungspositionen");
      wrPosExists = true;
    } catch {
      /* create below */
    }

    if (!wrPosExists) {
      const wrCol = app.findCollectionByNameOrId("wiederkehrende_rechnungen");

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
          name: "wiederkehrende_rechnung",
          required: true,
          collectionId: wrCol.id,
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

      const pos = new Collection({
        type: "base",
        name: "wiederkehrende_rechnungspositionen",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: posFields,
        indexes: [
          "CREATE INDEX idx_wrpos_firma ON wiederkehrende_rechnungspositionen (firma)",
          "CREATE INDEX idx_wrpos_wr ON wiederkehrende_rechnungspositionen (wiederkehrende_rechnung)",
          "CREATE INDEX idx_wrpos_wr_sort ON wiederkehrende_rechnungspositionen (wiederkehrende_rechnung, sortierung)",
        ],
      });
      app.save(pos);
    }

    // --- job_locks (global, nicht firma-gebunden) ---
    let locksExists = false;
    try {
      app.findCollectionByNameOrId("job_locks");
      locksExists = true;
    } catch {
      /* create below */
    }

    if (!locksExists) {
      const locks = new Collection({
        type: "base",
        name: "job_locks",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            // z. B. „wiederkehrende_rechnungen“
            type: "text",
            name: "key",
            required: true,
            min: 1,
            max: 80,
            presentable: true,
          },
          {
            // Instanz-ID des Holders (Process/Container)
            type: "text",
            name: "holder",
            required: true,
            min: 1,
            max: 120,
          },
          {
            // ISO-8601 UTC — Lock gilt bis hier (TTL)
            type: "text",
            name: "expires_at",
            required: true,
            min: 1,
            max: 40,
          },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_job_locks_key ON job_locks (key)",
        ],
      });
      app.save(locks);
    }

    // --- job_runs (light Protokoll) ---
    let runsExists = false;
    try {
      app.findCollectionByNameOrId("job_runs");
      runsExists = true;
    } catch {
      /* create below */
    }

    if (!runsExists) {
      const runs = new Collection({
        type: "base",
        name: "job_runs",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "text",
            name: "job_key",
            required: true,
            min: 1,
            max: 80,
          },
          {
            // gestartet | ok | fehler | uebersprungen
            type: "select",
            name: "status",
            required: true,
            maxSelect: 1,
            values: ["gestartet", "ok", "fehler", "uebersprungen"],
          },
          {
            type: "text",
            name: "gestartet_am",
            required: true,
            min: 1,
            max: 40,
          },
          {
            type: "text",
            name: "beendet_am",
            required: false,
            max: 40,
          },
          {
            // Kurzbericht (Anzahl erzeugt, Fehler)
            type: "text",
            name: "ergebnis",
            required: false,
            max: 2000,
          },
          {
            // optional firma-bezogen (leer = globaler Lauf über alle Firmen)
            type: "relation",
            name: "firma",
            required: false,
            collectionId: firmen.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
        ],
        indexes: [
          "CREATE INDEX idx_job_runs_key ON job_runs (job_key)",
          "CREATE INDEX idx_job_runs_gestartet ON job_runs (gestartet_am)",
        ],
      });
      app.save(runs);
    }
  },
  (app) => {
    try {
      const pos = app.findCollectionByNameOrId(
        "wiederkehrende_rechnungspositionen",
      );
      app.delete(pos);
    } catch (_) {
      /* ignore */
    }
    try {
      const wr = app.findCollectionByNameOrId("wiederkehrende_rechnungen");
      app.delete(wr);
    } catch (_) {
      /* ignore */
    }
    try {
      const locks = app.findCollectionByNameOrId("job_locks");
      app.delete(locks);
    } catch (_) {
      /* ignore */
    }
    try {
      const runs = app.findCollectionByNameOrId("job_runs");
      app.delete(runs);
    } catch (_) {
      /* ignore */
    }
  },
);
