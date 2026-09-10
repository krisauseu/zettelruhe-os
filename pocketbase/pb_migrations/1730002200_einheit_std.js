/// <reference path="../pb_data/types.d.ts" />

/**
 * Katalog-Einheit „Stunde“ → Abkürzung „Std.“ (kein Plural auf der Rechnung).
 * Stammdaten und Entwürfe; festgeschriebene Rechnungen und gesendete Angebote
 * bleiben unverändert (ADR-0004, ADR-0012).
 */
migrate(
  (app) => {
    renameEinheit(app, "katalog_positionen", "Stunde", "Std.", null);
    renameEinheit(
      app,
      "wiederkehrende_rechnungspositionen",
      "Stunde",
      "Std.",
      null,
    );

    const draftRechnungen = {};
    const rechnungen = app.findAllRecords("rechnungen");
    for (const r of rechnungen) {
      const status = String(r.get("status") || "");
      const fest = String(r.get("festgeschrieben_am") || "").trim();
      if (status === "entwurf" && !fest) {
        draftRechnungen[r.id] = true;
      }
    }
    renameEinheit(
      app,
      "rechnungspositionen",
      "Stunde",
      "Std.",
      (p) => Boolean(draftRechnungen[String(p.get("rechnung") || "")]),
    );

    const draftAngebote = {};
    const angebote = app.findAllRecords("angebote");
    for (const a of angebote) {
      if (String(a.get("status") || "") === "entwurf") {
        draftAngebote[a.id] = true;
      }
    }
    renameEinheit(
      app,
      "angebotspositionen",
      "Stunde",
      "Std.",
      (p) => Boolean(draftAngebote[String(p.get("angebot") || "")]),
    );
  },
  () => {
    // Nicht zurück auf „Stunde“: neue Datensätze können „Std.“ von Anfang an haben.
  },
);

function renameEinheit(app, collection, from, to, pred) {
  const rows = app.findAllRecords(collection);
  for (const r of rows) {
    if (String(r.get("einheit") || "") !== from) continue;
    if (pred && !pred(r)) continue;
    r.set("einheit", to);
    app.save(r);
  }
}
