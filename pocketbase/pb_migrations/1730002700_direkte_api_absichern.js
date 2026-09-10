/// <reference path="../pb_data/types.d.ts" />

/**
 * TP-020: Fachzugriffe laufen über Next mit Session-, Firmen- und Rollenprüfung
 * (ADR-0006, ADR-0009, ADR-0025). Es gibt keine öffentliche Fach-REST-API.
 * Auth bleibt möglich; users darf weiterhin nur den eigenen Record lesen.
 * Dateischutz gilt auch für bekannte URLs, Thumbnails und Relation-Expansions.
 */
migrate(
  (app) => {
    const collections = [
      "firmen", "kontakte", "ansprechpartner", "katalog_positionen",
      "buchungsjournal", "belege", "rechnungen", "rechnungspositionen",
      "angebote", "angebotspositionen", "projekte", "zeiteintraege", "fahrten",
      "zahlungen", "kassenbuch_eintraege", "wiederkehrende_rechnungen",
      "wiederkehrende_rechnungspositionen", "job_locks", "job_runs",
      "bankkonten", "bank_import_laeufe", "bank_bewegungen",
      "e_rechnungen_empfang", "kategorien", "ust_id_pruefungen",
      "e_rechnungen_versand", "mitgliedschaften",
    ];
    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);
      collection.listRule = null;
      collection.viewRule = null;
      collection.createRule = null;
      collection.updateRule = null;
      collection.deleteRule = null;
      app.save(collection);
    }
    // Expliziter Umfang: keine PocketBase-Systemcollections oder lokale Erweiterungen.
    for (const [name, field] of [
      ["users", "avatar"], ["firmen", "logo"], ["belege", "datei"],
      ["rechnungen", "pdf"], ["angebote", "pdf"],
      ["e_rechnungen_empfang", "original_datei"],
      ["e_rechnungen_versand", "original_datei"],
    ]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.getByName(field).protected = true;
      app.save(collection);
    }
  },
  () => {
    // Kein stilles Wiederöffnen einer bestätigten Sicherheitslücke beim Downgrade.
    // Rückkehr zum alten Schema nur durch bewussten Restore des Betriebsbackups.
  },
);
