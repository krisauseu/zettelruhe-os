import { describe, expect, it } from "vitest";
import {
  ABGERECHNET_ERROR,
  assertCanChangeStatus,
  assertEditable,
  buildRechnungspositionFromZeit,
  dauerMinutenToDezimalStunden,
  formatDauerDe,
  normalizeDauerMinuten,
  splitDauerMinuten,
  validateZeiteintragInput,
} from "./invariants";
import type { Zeiteintrag } from "./types";

describe("normalizeDauerMinuten", () => {
  it("rechnet Stunden + Minuten", () => {
    expect(normalizeDauerMinuten({ stunden: 1, minuten: 30 })).toBe(90);
    expect(normalizeDauerMinuten({ stunden: "2", minuten: "0" })).toBe(120);
    expect(normalizeDauerMinuten({ stunden: 0, minuten: 45 })).toBe(45);
  });

  it("akzeptiert Dezimalstunden mit Komma", () => {
    expect(normalizeDauerMinuten({ dezimal_stunden: "1,5" })).toBe(90);
    expect(normalizeDauerMinuten({ dezimal_stunden: "0,25" })).toBe(15);
  });

  it("Stunden/Minuten haben Vorrang vor Dezimal", () => {
    expect(
      normalizeDauerMinuten({
        stunden: 1,
        minuten: 0,
        dezimal_stunden: "9",
      }),
    ).toBe(60);
  });

  it("lehnt 0 und ungültige Minuten ab", () => {
    expect(() => normalizeDauerMinuten({ stunden: 0, minuten: 0 })).toThrow(
      /mindestens 1 Minute/,
    );
    expect(() => normalizeDauerMinuten({ minuten: 60 })).toThrow(/0 und 59/);
    expect(() => normalizeDauerMinuten({})).toThrow(/erforderlich/);
  });
});

describe("formatDauerDe / split / dezimal", () => {
  it("formatiert und splittet", () => {
    expect(formatDauerDe(90)).toBe("1:30 h");
    expect(formatDauerDe(45)).toBe("45 min");
    expect(formatDauerDe(120)).toBe("2:00 h");
    expect(splitDauerMinuten(95)).toEqual({ stunden: 1, minuten: 35 });
    expect(dauerMinutenToDezimalStunden(90)).toBe("1.50");
  });
});

describe("validateZeiteintragInput", () => {
  it("validiert Pflichtfelder und normalisiert", () => {
    const v = validateZeiteintragInput({
      kunde: "k1",
      datum: "2026-08-12",
      stunden: 1,
      minuten: 15,
      beschreibung: " Workshop ",
      stundensatz: "85,00",
    });
    expect(v.dauer_minuten).toBe(75);
    expect(v.beschreibung).toBe("Workshop");
    expect(v.stundensatz).toBe("85.00");
    expect(v.status).toBe("abrechenbar");
  });

  it("fordert Kund:in und gültiges Datum", () => {
    expect(() =>
      validateZeiteintragInput({
        kunde: "",
        datum: "2026-08-12",
        stunden: 1,
      }),
    ).toThrow(/Kund:in/);
    expect(() =>
      validateZeiteintragInput({
        kunde: "k1",
        datum: "12.08.2026",
        stunden: 1,
      }),
    ).toThrow(/YYYY-MM-DD/);
  });
});

describe("Status / Abgerechnet", () => {
  const base: Pick<Zeiteintrag, "status" | "rechnung"> = {
    status: "abrechenbar",
    rechnung: null,
  };

  it("erlaubt Statuswechsel light ohne Rechnung", () => {
    expect(() =>
      assertCanChangeStatus(base, "nicht_abrechenbar"),
    ).not.toThrow();
    expect(() => assertCanChangeStatus(base, "abgerechnet")).not.toThrow();
    expect(() =>
      assertCanChangeStatus(
        { status: "abgerechnet", rechnung: null },
        "abrechenbar",
      ),
    ).not.toThrow();
  });

  it("blockiert Edit und Status bei abgerechnet+Rechnung", () => {
    const locked = { status: "abgerechnet" as const, rechnung: "r1" };
    expect(() => assertEditable(locked)).toThrow(ABGERECHNET_ERROR);
    expect(() => assertCanChangeStatus(locked, "abrechenbar")).toThrow(
      /verknüpfter Rechnung/,
    );
  });
});

describe("buildRechnungspositionFromZeit", () => {
  it("baut Position mit Dezimalstunden", () => {
    const p = buildRechnungspositionFromZeit({
      datum: "2026-08-12",
      beschreibung: "Beratung",
      dauer_minuten: 90,
      stundensatz: "100.00",
    });
    expect(p.menge).toBe("1.50");
    expect(p.einheit).toBe("Std.");
    expect(p.einzelpreis).toBe("100.00");
    expect(p.bezeichnung).toContain("Beratung");
  });
});
