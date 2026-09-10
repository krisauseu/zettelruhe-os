import { describe, expect, it } from "vitest";
import {
  KATEGORIE_RICHTUNG_MISMATCH_ERROR,
  assertKategoriePasstZurRichtung,
  kategorieNameKey,
  kategorieNamenFuerSelect,
  kategorieSelectItemsFromStammdaten,
  kategorieSelectItemsMitSchnappschuss,
  kategorienFuerRichtung,
  normalizeKategorieName,
  parseKategorieRichtung,
  validateKategorieInput,
} from "./invariants";

describe("normalizeKategorieName", () => {
  it("trimmt und zieht Whitespace zusammen", () => {
    expect(normalizeKategorieName("  Büro   material ")).toBe("Büro material");
  });
});

describe("validateKategorieInput", () => {
  it("lehnt leeren Namen ab", () => {
    expect(() => validateKategorieInput({ name: "   " })).toThrow(
      /erforderlich/,
    );
  });

  it("lehnt zu lange Namen ab", () => {
    expect(() => validateKategorieInput({ name: "x".repeat(121) })).toThrow(
      /zu lang/,
    );
  });

  it("normalisiert und setzt aktiv default true", () => {
    const v = validateKategorieInput({ name: "  Porto  " });
    expect(v.name).toBe("Porto");
    expect(v.aktiv).toBe(true);
    expect(v.notiz).toBe("");
    expect(v.richtung).toBe("ausgabe");
  });

  it("respektiert aktiv=false", () => {
    const v = validateKategorieInput({ name: "Alt", aktiv: false });
    expect(v.aktiv).toBe(false);
  });

  it("legt eine Ausgabekategorie an", () => {
    const v = validateKategorieInput({
      name: "Material & Verbrauchsmittel",
      richtung: "ausgabe",
    });
    expect(v.richtung).toBe("ausgabe");
    expect(v.name).toBe("Material & Verbrauchsmittel");
  });

  it("legt eine Einnahmekategorie an", () => {
    const v = validateKategorieInput({
      name: "Gartenpflege",
      richtung: "einnahme",
    });
    expect(v.richtung).toBe("einnahme");
    expect(v.name).toBe("Gartenpflege");
  });

  it("lehnt unbekannte Richtung ab", () => {
    expect(() =>
      validateKategorieInput({ name: "Porto", richtung: "income" }),
    ).toThrow(/Einnahme oder Ausgabe/);
  });
});

describe("kategorieNameKey", () => {
  it("vergleicht case-insensitive de-DE", () => {
    expect(kategorieNameKey("Büro")).toBe(kategorieNameKey("büro"));
  });
});

describe("kategorieNamenFuerSelect", () => {
  it("sortiert, dedupliziert und hängt historischen Wert an", () => {
    expect(kategorieNamenFuerSelect(["Porto", "Büro", "porto"], "Alt")).toEqual(
      ["Alt", "Büro", "Porto"],
    );
  });

  it("hängt aktuellen Wert nicht doppelt an", () => {
    expect(kategorieNamenFuerSelect(["Büro"], "Büro")).toEqual(["Büro"]);
  });
});

describe("parseKategorieRichtung", () => {
  it("fällt ohne Wert auf ausgabe zurück", () => {
    expect(parseKategorieRichtung(undefined)).toBe("ausgabe");
    expect(parseKategorieRichtung("")).toBe("ausgabe");
    expect(parseKategorieRichtung("income")).toBe("ausgabe");
  });
});

const SELECT_ITEMS = [
  { name: "Material & Verbrauchsmittel", richtung: "ausgabe" as const },
  { name: "Fahrzeug & Fahrtkosten", richtung: "ausgabe" as const },
  { name: "Gartenpflege", richtung: "einnahme" as const },
  { name: "Hausmeisterservice", richtung: "einnahme" as const },
];

describe("kategorienFuerRichtung", () => {
  it("bietet bei Ausgabe nur Ausgabekategorien", () => {
    const { namen, selected } = kategorienFuerRichtung(
      SELECT_ITEMS,
      "ausgabe",
    );
    expect(namen).toEqual(["Fahrzeug & Fahrtkosten", "Material & Verbrauchsmittel"]);
    expect(selected).toBe("");
  });

  it("bietet bei Einnahme nur Einnahmekategorien", () => {
    const { namen } = kategorienFuerRichtung(SELECT_ITEMS, "einnahme");
    expect(namen).toEqual(["Gartenpflege", "Hausmeisterservice"]);
  });

  it("setzt inkompatible Kategorie beim Richtungswechsel zurück", () => {
    const vor = kategorienFuerRichtung(
      SELECT_ITEMS,
      "ausgabe",
      "Material & Verbrauchsmittel",
    );
    expect(vor.selected).toBe("Material & Verbrauchsmittel");

    const nach = kategorienFuerRichtung(
      SELECT_ITEMS,
      "einnahme",
      vor.selected,
    );
    expect(nach.selected).toBe("");
    expect(nach.namen).not.toContain("Material & Verbrauchsmittel");
  });

  it("behält passende Kategorie", () => {
    const { selected } = kategorienFuerRichtung(
      SELECT_ITEMS,
      "einnahme",
      "Gartenpflege",
    );
    expect(selected).toBe("Gartenpflege");
  });
});

describe("kategorieSelectItemsFromStammdaten", () => {
  it("nimmt aktive und den inaktiven aktuellen Schnappschuss", () => {
    const items = kategorieSelectItemsFromStammdaten(
      [
        { name: "Büro", richtung: "ausgabe", aktiv: true },
        { name: "Alt", richtung: "einnahme", aktiv: false },
        { name: "Versteckt", richtung: "ausgabe", aktiv: false },
      ],
      "Alt",
    );
    expect(items).toEqual([
      { name: "Büro", richtung: "ausgabe" },
      { name: "Alt", richtung: "einnahme" },
    ]);
  });
});

describe("kategorieSelectItemsMitSchnappschuss", () => {
  it("hängt unbekannten aktuellen Namen mit Ursprungsrichtung an", () => {
    expect(
      kategorieSelectItemsMitSchnappschuss(
        SELECT_ITEMS,
        "Historisch",
        "ausgabe",
      ),
    ).toContainEqual({ name: "Historisch", richtung: "ausgabe" });
  });
});

describe("assertKategoriePasstZurRichtung", () => {
  it("erlaubt leere Kategorie", () => {
    expect(() =>
      assertKategoriePasstZurRichtung("", "ausgabe", "einnahme"),
    ).not.toThrow();
  });

  it("erlaubt unbekannten Schnappschuss", () => {
    expect(() =>
      assertKategoriePasstZurRichtung("Historisch", "einnahme", null),
    ).not.toThrow();
  });

  it("lehnt Einnahmekategorie bei Ausgabe ab", () => {
    expect(() =>
      assertKategoriePasstZurRichtung("Gartenpflege", "ausgabe", "einnahme"),
    ).toThrow(KATEGORIE_RICHTUNG_MISMATCH_ERROR);
  });

  it("lehnt Ausgabekategorie bei Einnahme ab", () => {
    expect(() =>
      assertKategoriePasstZurRichtung("Büro", "einnahme", "ausgabe"),
    ).toThrow(KATEGORIE_RICHTUNG_MISMATCH_ERROR);
  });

  it("akzeptiert passende Kombination", () => {
    expect(() =>
      assertKategoriePasstZurRichtung("Büro", "ausgabe", "ausgabe"),
    ).not.toThrow();
  });
});
