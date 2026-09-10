import { describe, expect, it } from "vitest";
import {
  PAR19_AMPEL_ACHTUNG,
  PAR19_AMPEL_NAHE,
  buildPar19Waechter,
  par19Ampel,
  par19GrenzeAm,
} from "./par19";

describe("par19GrenzeAm", () => {
  it("nimmt ab 2025 die geltenden Grenzen 25.000 / 100.000", () => {
    const g = par19GrenzeAm("2025-01-01");
    expect(g.vorjahr_euro).toBe("25000.00");
    expect(g.laufend_euro).toBe("100000.00");
    expect(g.geltung_ab).toBe("2025-01-01");
    expect(g.quelle).toMatch(/§ 19/);
  });

  it("bleibt 2026 bei derselben Staffel", () => {
    const g = par19GrenzeAm("2026-08-17");
    expect(g.vorjahr_euro).toBe("25000.00");
    expect(g.laufend_euro).toBe("100000.00");
  });

  it("verwendet bis 2024 die alte Staffel 22.000 / 50.000", () => {
    const g = par19GrenzeAm("2024-12-31");
    expect(g.vorjahr_euro).toBe("22000.00");
    expect(g.laufend_euro).toBe("50000.00");
  });

  it("lehnt ungültige Daten ab", () => {
    expect(() => par19GrenzeAm("2026-13-01")).toThrow(/Ungültig/);
  });
});

describe("par19Ampel", () => {
  it("ist entspannt unter 70 % der Vorjahresgrenze", () => {
    expect(par19Ampel("10000.00", "25000.00", "100000.00")).toBe("entspannt");
    const knappUnter = (25000 * PAR19_AMPEL_ACHTUNG - 0.01).toFixed(2);
    expect(par19Ampel(knappUnter, "25000.00", "100000.00")).toBe("entspannt");
  });

  it("wird Achtung ab 70 %", () => {
    expect(par19Ampel("17500.00", "25000.00", "100000.00")).toBe("achtung");
  });

  it("wird nahe der Grenze ab 90 % oder bei Überschreiten", () => {
    expect(par19Ampel("22500.00", "25000.00", "100000.00")).toBe(
      "nahe_der_grenze",
    );
    expect(par19Ampel("25000.00", "25000.00", "100000.00")).toBe(
      "nahe_der_grenze",
    );
    expect(par19Ampel("100000.00", "25000.00", "100000.00")).toBe(
      "nahe_der_grenze",
    );
    expect(PAR19_AMPEL_NAHE).toBe(0.9);
  });
});

describe("buildPar19Waechter", () => {
  it("entfällt unter Regelbesteuerung", () => {
    expect(
      buildPar19Waechter({
        steuermodus: "regelbesteuerung_ist",
        umsatz_brutto: "10000.00",
        kalenderjahr: 2026,
        refYmd: "2026-08-17",
      }),
    ).toBeNull();
  });

  it("setzt Jahresumsatz und Grenzen unter Kleinunternehmerregelung", () => {
    const w = buildPar19Waechter({
      steuermodus: "kleinunternehmer",
      umsatz_brutto: "4000.00",
      kalenderjahr: 2026,
      refYmd: "2026-08-17",
    });
    expect(w).not.toBeNull();
    expect(w!.grenze_vorjahr).toBe("25000.00");
    expect(w!.grenze_laufend).toBe("100000.00");
    expect(w!.umsatz_brutto).toBe("4000.00");
    expect(w!.ampel).toBe("entspannt");
    expect(w!.anteil_vorjahr).toBeCloseTo(4000 / 25000);
    expect(w!.hinweis).toMatch(/kein amtlicher Gesamtumsatz/i);
  });
});
