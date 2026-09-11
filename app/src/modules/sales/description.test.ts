import { describe, expect, it } from "vitest";
import { validatePositionInput, validateAngebotspositionInput } from "./invariants";

const position = { bezeichnung: "Hosting", menge: "1", einzelpreis: "25" };

describe.each([validatePositionInput, validateAngebotspositionInput])("Positionsbeschreibung", (validate) => {
  it("bleibt optional und erhält innere Zeilenumbrüche", () => {
    expect(validate(position, "kleinunternehmer", 1).description).toBe("");
    expect(validate({ ...position, description: "  example.test\nSeptember 2026  " }, "kleinunternehmer", 1).description)
      .toBe("example.test\nSeptember 2026");
    expect(validate({ ...position, description: " \n " }, "kleinunternehmer", 1).description).toBe("");
  });
  it("begrenzt Details auf das Datenbanklimit und verlangt weiterhin eine Bezeichnung", () => {
    expect(() => validate({ ...position, description: "x".repeat(2001) }, "kleinunternehmer", 1)).toThrow("max. 2000");
    expect(() => validate({ ...position, bezeichnung: "", description: "Details" }, "kleinunternehmer", 1)).toThrow("Positionsbezeichnung");
  });
});
