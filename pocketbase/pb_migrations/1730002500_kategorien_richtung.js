/// <reference path="../pb_data/types.d.ts" />

/**
 * Kategorie-Stammdaten: Buchungsrichtung (einnahme | ausgabe).
 * Gleiche Werte wie Beleg/Kassenbuch. Bestehende Kategorien: nur dann
 * einnahme, wenn sie ausschließlich an Einnahmen hängen; sonst ausgabe.
 */
migrate(
  (app) => {
    const kategorien = app.findCollectionByNameOrId("kategorien");
    const hasField = (col, name) =>
      (col.fields || []).some((f) => f.name === name);

    if (!hasField(kategorien, "richtung")) {
      kategorien.fields.push(
        new Field({
          type: "select",
          name: "richtung",
          required: false,
          maxSelect: 1,
          values: ["einnahme", "ausgabe"],
        }),
      );
      app.save(kategorien);
    }

    const inferred = inferRichtungByKategorieId(app);
    const records = app.findAllRecords("kategorien");
    for (const r of records) {
      const current = asRichtung(r.get("richtung"));
      if (current) continue;
      r.set("richtung", inferred[r.id] || "ausgabe");
      app.save(r);
    }

    const col = app.findCollectionByNameOrId("kategorien");
    const field = col.fields.getByName("richtung");
    if (field && !field.required) {
      field.required = true;
      app.save(col);
    }
  },
  (app) => {
    try {
      const kategorien = app.findCollectionByNameOrId("kategorien");
      if (typeof kategorien.fields.removeByName === "function") {
        kategorien.fields.removeByName("richtung");
        app.save(kategorien);
      }
    } catch {
      /* ignore */
    }
  },
);

function asRichtung(raw) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = String(v || "").trim();
  if (s === "einnahme" || s === "ausgabe") return s;
  return "";
}

function addUsage(map, firma, name, richtung) {
  const n = String(name || "").trim();
  const r = asRichtung(richtung);
  if (!n || !r) return;
  const key = `${firma}\0${n}`;
  if (!map[key]) map[key] = new Set();
  map[key].add(r);
}

function collectUsage(app) {
  const map = {};
  try {
    for (const b of app.findAllRecords("belege")) {
      addUsage(map, b.get("firma"), b.get("kategorie"), b.get("richtung"));
    }
  } catch {
    /* Collection fehlt in älteren Ständen */
  }
  try {
    for (const e of app.findAllRecords("kassenbuch_eintraege")) {
      addUsage(map, e.get("firma"), e.get("kategorie"), e.get("richtung"));
    }
  } catch {
    /* ignore */
  }
  return map;
}

/** Nur eindeutig belegte Einnahmen → einnahme; sonst ausgabe. */
function inferRichtungByKategorieId(app) {
  const usage = collectUsage(app);
  const out = {};
  for (const k of app.findAllRecords("kategorien")) {
    const key = `${k.get("firma")}\0${String(k.get("name") || "").trim()}`;
    const set = usage[key];
    out[k.id] =
      set && set.size === 1 && set.has("einnahme") ? "einnahme" : "ausgabe";
  }
  return out;
}
