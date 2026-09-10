import { describe, expect, it } from "vitest";
import { KATALOG_EINHEITEN, einheitOptionen } from "./einheiten";
import { katalogCsvTemplate } from "./csv";

describe("KATALOG_EINHEITEN", () => {
  it("führt Stunden als Abkürzung Std.", () => {
    expect(KATALOG_EINHEITEN).toContain("Std.");
    expect(KATALOG_EINHEITEN).not.toContain("Stunde");
  });
});

describe("einheitOptionen", () => {
  it("hängt eine gespeicherte Einheit an, die nicht in der Liste steht", () => {
    expect(einheitOptionen("Stunde")).toEqual([
      "Stück",
      "Std.",
      "Artikel",
      "Karton",
      "Pauschal",
      "Stunde",
    ]);
  });

  it("dupliziert Std. nicht", () => {
    expect(einheitOptionen("Std.")).toEqual([...KATALOG_EINHEITEN]);
  });
});

describe("katalogCsvTemplate", () => {
  it("nutzt Std. als Stunden-Einheit", () => {
    expect(katalogCsvTemplate()).toContain("Std.");
    expect(katalogCsvTemplate()).not.toMatch(/Stunde/);
  });
});
