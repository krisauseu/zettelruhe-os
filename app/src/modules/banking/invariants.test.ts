import { describe, expect, it } from "vitest";
import {
  isPlausibleIban,
  normalizeIban,
  validateBankkontoInput,
} from "./invariants";

describe("validateBankkontoInput", () => {
  it("normalisiert Name und IBAN", () => {
    const v = validateBankkontoInput({
      name: "  Geschäftskonto  ",
      iban: "de89 3704 0044 0532 0130 00",
      bic: "coba deff xxx",
      aktiv: true,
    });
    expect(v.name).toBe("Geschäftskonto");
    expect(v.iban).toBe("DE89370400440532013000");
    expect(v.bic).toBe("COBADEFFXXX");
    expect(v.kontoinhaber).toBe("");
    expect(v.aktiv).toBe(true);
  });

  it("trimmt den Kontoinhaber", () => {
    const v = validateBankkontoInput({
      name: "Geschäftskonto",
      kontoinhaber: "  Werkstatt Beispiel GmbH  ",
    });
    expect(v.kontoinhaber).toBe("Werkstatt Beispiel GmbH");
  });

  it("lehnt zu langen Kontoinhaber ab", () => {
    expect(() =>
      validateBankkontoInput({
        name: "X",
        kontoinhaber: "A".repeat(121),
      }),
    ).toThrow(/Kontoinhaber/);
  });

  it("lehnt leeren Namen ab", () => {
    expect(() => validateBankkontoInput({ name: "  " })).toThrow(/Name/);
  });

  it("lehnt unplausible IBAN ab", () => {
    expect(() =>
      validateBankkontoInput({ name: "X", iban: "1234" }),
    ).toThrow(/IBAN/);
  });

  it("aktiv default true", () => {
    expect(validateBankkontoInput({ name: "A" }).aktiv).toBe(true);
  });
});

describe("IBAN light", () => {
  it("normalizeIban", () => {
    expect(normalizeIban(" de 89 ")).toBe("DE89");
  });

  it("isPlausibleIban", () => {
    expect(isPlausibleIban("DE89370400440532013000")).toBe(true);
    expect(isPlausibleIban("DE89")).toBe(false);
  });
});
