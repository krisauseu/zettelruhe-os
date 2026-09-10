/// <reference path="../pb_data/types.d.ts" />

/**
 * Setup-verified: Login der Eigentümer:in hängt nicht an users.verified.
 * Eine Eigentümer:in, self-hosted — kein SMTP-Pflichtpfad.
 * Bestehende Instanz: unverifizierte User nachziehen; bereits verifizierte bleiben es.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // Leerstring = jede Auth-Record darf authentifizieren.
    // null würde Auth ganz sperren — nicht setzen.
    users.authRule = "";
    app.save(users);

    const records = app.findAllRecords("users");
    for (const rec of records) {
      if (rec.verified()) continue;
      rec.setVerified(true);
      app.save(rec);
    }
  },
  () => {
    // verified nicht zurücksetzen — niemand aussperren
  },
);
