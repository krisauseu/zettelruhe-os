import { describe, expect, it } from "vitest";
import { normalizePreisInput } from "./repository";

describe("normalizePreisInput", () => {
  it("parst Punkt-Dezimal", () => {
    expect(normalizePreisInput("19.99")).toBe("19.99");
  });

  it("parst de-DE Komma", () => {
    expect(normalizePreisInput("19,99")).toBe("19.99");
  });

  it("parst Tausenderpunkt + Komma", () => {
    expect(normalizePreisInput("1.234,50")).toBe("1234.50");
  });

  it("rundet auf 2 Stellen", () => {
    expect(normalizePreisInput("1.005")).toBe("1.01");
  });

  it("lehnt negativ ab", () => {
    expect(() => normalizePreisInput("-1")).toThrow(/negativ/i);
  });

  it("lehnt leer ab", () => {
    expect(() => normalizePreisInput("")).toThrow(/erforderlich/i);
  });

  it("lehnt Müll ab", () => {
    expect(() => normalizePreisInput("abc")).toThrow();
  });
});
