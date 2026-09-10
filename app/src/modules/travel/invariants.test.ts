import { describe, expect, it } from "vitest";
import {
  ABGERECHNET_FAHRT_ERROR,
  assertCanChangeFahrtStatus,
  assertFahrtEditable,
  buildRechnungspositionFromFahrt,
  normalizeKm,
  validateFahrtInput,
} from "./invariants";

describe("normalizeKm", () => {
  it("normalisiert de-DE und Punkt", () => {
    expect(normalizeKm("12,5")).toBe("12.50");
    expect(normalizeKm("42")).toBe("42.00");
  });

  it("lehnt 0 und negativ ab", () => {
    expect(() => normalizeKm("0")).toThrow(/größer als 0/);
    expect(() => normalizeKm("-1")).toThrow(/negativ/);
    expect(() => normalizeKm("")).toThrow(/erforderlich/);
  });
});

describe("validateFahrtInput", () => {
  it("Default-Status abrechenbar", () => {
    const v = validateFahrtInput({
      kunde: "k1",
      datum: "2026-08-12",
      km: "10,5",
      strecke: "Büro → Kunde",
      km_satz: "0,30",
    });
    expect(v.km).toBe("10.50");
    expect(v.status).toBe("abrechenbar");
    expect(v.km_satz).toBe("0.30");
    expect(v.steuerlich_relevant).toBe(false);
  });

  it("fordert Kund:in", () => {
    expect(() =>
      validateFahrtInput({
        kunde: "",
        datum: "2026-08-12",
        km: "5",
      }),
    ).toThrow(/Kund:in/);
  });
});

describe("Status / Abgerechnet", () => {
  it("blockiert bei abgerechnet+Rechnung", () => {
    const locked = { status: "abgerechnet" as const, rechnung: "r1" };
    expect(() => assertFahrtEditable(locked)).toThrow(ABGERECHNET_FAHRT_ERROR);
    expect(() => assertCanChangeFahrtStatus(locked, "abrechenbar")).toThrow(
      /verknüpfter Rechnung/,
    );
  });
});

describe("buildRechnungspositionFromFahrt", () => {
  it("baut km-Position", () => {
    const p = buildRechnungspositionFromFahrt({
      datum: "2026-08-12",
      strecke: "Hin und zurück",
      km: "80.00",
      km_satz: "0.30",
    });
    expect(p.menge).toBe("80.00");
    expect(p.einheit).toBe("km");
    expect(p.einzelpreis).toBe("0.30");
  });
});
