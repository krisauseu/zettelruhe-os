import { describe, expect, it } from "vitest";
import { normalizeSearchQuery } from "./search";

describe("normalizeSearchQuery", () => {
  it("trimmt und verdichtet Whitespace", () => {
    expect(normalizeSearchQuery("  foo   bar  ")).toBe("foo bar");
  });

  it("schneidet sehr lange Eingaben ab", () => {
    const long = "a".repeat(200);
    expect(normalizeSearchQuery(long).length).toBe(120);
  });
});
