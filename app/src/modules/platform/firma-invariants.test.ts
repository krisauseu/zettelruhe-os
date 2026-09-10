import { describe, expect, it } from "vitest";
import {
  FIRMA_NAME_DOPPELT_ERROR,
  isDuplicateFirmaNameError,
  normalizeFirmaName,
  validateFirmaWechselZiel,
  validateNeueFirmaInput,
} from "./firma-invariants";

describe("normalizeFirmaName", () => {
  it("trimmt und zieht Whitespace zusammen", () => {
    expect(normalizeFirmaName("  Beispiel   GmbH ")).toBe("Beispiel GmbH");
  });
});

describe("validateNeueFirmaInput", () => {
  it("lehnt leeren Namen ab", () => {
    expect(() =>
      validateNeueFirmaInput({
        name: "   ",
        steuermodus: "kleinunternehmer",
        skr: "skr03",
      }),
    ).toThrow(/erforderlich/);
  });

  it("lehnt unbekannten Steuer-Modus ab", () => {
    expect(() =>
      validateNeueFirmaInput({
        name: "Zweite Firma",
        steuermodus: "soll",
        skr: "skr03",
      }),
    ).toThrow(/Steuer-Modus/);
  });

  it("lehnt unbekannte SKR-Wahl ab", () => {
    expect(() =>
      validateNeueFirmaInput({
        name: "Zweite Firma",
        steuermodus: "regelbesteuerung_ist",
        skr: "skr49",
      }),
    ).toThrow(/SKR/);
  });

  it("setzt Land auf DE und normalisiert den Namen", () => {
    const v = validateNeueFirmaInput({
      name: "  Regel  UG  ",
      steuermodus: "regelbesteuerung_ist",
      skr: "skr04",
    });
    expect(v.name).toBe("Regel UG");
    expect(v.steuermodus).toBe("regelbesteuerung_ist");
    expect(v.skr).toBe("skr04");
    expect(v.land).toBe("DE");
  });
});

describe("isDuplicateFirmaNameError", () => {
  it("erkennt den PocketBase-Unique-Index", () => {
    expect(
      isDuplicateFirmaNameError(
        new Error(
          "PocketBase 400: Failed to create record. (name: Value must be unique.)",
        ),
      ),
    ).toBe(true);
    expect(isDuplicateFirmaNameError(new Error("Netzwerkfehler"))).toBe(false);
    expect(FIRMA_NAME_DOPPELT_ERROR).toMatch(/bereits/);
  });
});

describe("validateFirmaWechselZiel", () => {
  it("lehnt leere Wahl ab", () => {
    expect(() => validateFirmaWechselZiel("  ")).toThrow(/wählen/);
  });

  it("gibt die getrimmte ID zurück", () => {
    expect(validateFirmaWechselZiel(" firma_abc ")).toBe("firma_abc");
  });
});
