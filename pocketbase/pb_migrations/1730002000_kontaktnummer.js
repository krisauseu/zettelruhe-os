/// <reference path="../pb_data/types.d.ts" />

/**
 * Kontaktnummer am Kontakt (Stammdaten).
 * PocketBase-ID bleibt die Verknüpfung; ein Nummernkreis je Firma (Default KT-).
 * Backfill bestehender Kontakte nach created; Zähler an der Firma nachziehen.
 */
migrate(
  (app) => {
    const kontakte = app.findCollectionByNameOrId("kontakte");

    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(kontakte, "kontaktnummer")) {
      kontakte.fields.push(
        new Field({
          type: "text",
          name: "kontaktnummer",
          required: false,
          max: 32,
        }),
      );
    }

    const idx =
      "CREATE UNIQUE INDEX idx_kontakte_firma_nummer ON kontakte (firma, kontaktnummer) WHERE kontaktnummer != ''";
    const indexes = Array.isArray(kontakte.indexes)
      ? [...kontakte.indexes]
      : [];
    if (!indexes.includes(idx)) {
      indexes.push(idx);
    }
    kontakte.indexes = indexes;
    app.save(kontakte);

    const defaultKontaktNk = { prefix: "KT-", digits: 4, next: 1 };

    const firmen = app.findAllRecords("firmen");
    const alleKontakte = app.findAllRecords("kontakte");
    const byFirma = {};
    for (const k of alleKontakte) {
      const fid = k.get("firma");
      if (!byFirma[fid]) byFirma[fid] = [];
      byFirma[fid].push(k);
    }

    for (const firma of firmen) {
      let nk;
      try {
        nk = JSON.parse(JSON.stringify(firma.get("nummernkreise") || {}));
      } catch {
        nk = {};
      }
      const stored =
        nk.kontakt && typeof nk.kontakt === "object" ? nk.kontakt : {};
      const prefix =
        typeof stored.prefix === "string" && stored.prefix
          ? stored.prefix
          : defaultKontaktNk.prefix;
      const digits = Math.max(
        1,
        Number(stored.digits) || defaultKontaktNk.digits,
      );
      let next = Number(stored.next) || defaultKontaktNk.next;

      const liste = byFirma[firma.id] || [];
      liste.sort((a, b) => {
        const ca = String(a.get("created") || "");
        const cb = String(b.get("created") || "");
        if (ca < cb) return -1;
        if (ca > cb) return 1;
        return String(a.id).localeCompare(String(b.id));
      });

      for (const k of liste) {
        const existing = String(k.get("kontaktnummer") || "").trim();
        if (existing) continue;
        const nummer = prefix + String(next).padStart(digits, "0");
        k.set("kontaktnummer", nummer);
        app.save(k);
        next += 1;
      }

      nk.kontakt = { prefix, digits, next };
      firma.set("nummernkreise", nk);
      app.save(firma);
    }
  },
  (app) => {
    try {
      const kontakte = app.findCollectionByNameOrId("kontakte");
      const idx =
        "CREATE UNIQUE INDEX idx_kontakte_firma_nummer ON kontakte (firma, kontaktnummer) WHERE kontaktnummer != ''";
      const indexes = Array.isArray(kontakte.indexes)
        ? [...kontakte.indexes]
        : [];
      const i = indexes.indexOf(idx);
      if (i >= 0) indexes.splice(i, 1);
      kontakte.indexes = indexes;
      if (typeof kontakte.fields.removeByName === "function") {
        kontakte.fields.removeByName("kontaktnummer");
      }
      app.save(kontakte);
    } catch {
      /* ignore */
    }
  },
);
