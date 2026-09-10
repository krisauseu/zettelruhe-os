import { describe, expect, it } from "vitest";
import { validateProjektInput } from "./invariants";

describe("validateProjektInput", () => {
  it("akzeptiert gültige Eingabe und setzt aktiv default", () => {
    const v = validateProjektInput({
      kunde: "k1",
      name: " Website Relaunch ",
      notiz: "  Phase 1 ",
    });
    expect(v.kunde).toBe("k1");
    expect(v.name).toBe("Website Relaunch");
    expect(v.notiz).toBe("Phase 1");
    expect(v.aktiv).toBe(true);
  });

  it("respektiert aktiv=false", () => {
    const v = validateProjektInput({
      kunde: "k1",
      name: "Alt",
      aktiv: false,
    });
    expect(v.aktiv).toBe(false);
  });

  it("fordert Kund:in", () => {
    expect(() =>
      validateProjektInput({ kunde: "", name: "X" }),
    ).toThrow(/Kund:in/);
  });

  it("fordert Name", () => {
    expect(() =>
      validateProjektInput({ kunde: "k1", name: "   " }),
    ).toThrow(/Name/);
  });
});
