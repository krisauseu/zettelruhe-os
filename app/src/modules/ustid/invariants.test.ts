import { describe, expect, it } from "vitest";
import {
  EIGENE_DE_NICHT_ISOLIERT,
  EIGENE_UST_ID_FEHLT,
  FREMDE_UST_ID_DE,
  SCHNAPPSCHUSS_NICHT_LESBAR,
  eigeneLageHinweis,
  kannBzstAbfrage,
} from "./invariants";

describe("kannBzstAbfrage", () => {
  it("erlaubt DE-Anfragende gegen EU-Nummer", () => {
    const g = kannBzstAbfrage("DE 123 456 789", "atu12345678");
    expect(g).toEqual({
      ok: true,
      anfragende: "DE123456789",
      angefragte: "ATU12345678",
    });
  });

  it("blockt fehlende eigene Nummer", () => {
    const g = kannBzstAbfrage("", "ATU12345678");
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.grund).toBe(EIGENE_UST_ID_FEHLT);
  });

  it("blockt DE als angefragte Nummer", () => {
    const g = kannBzstAbfrage("DE123456789", "DE987654321");
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.grund).toBe(FREMDE_UST_ID_DE);
  });

  it("blockt Drittland", () => {
    const g = kannBzstAbfrage("DE123456789", "US123456789");
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.grund).toMatch(/übrigen EU/);
  });
});

describe("eigeneLageHinweis", () => {
  it("erfindet keine isolierte BZSt-Bestätigung", () => {
    const text = eigeneLageHinweis({
      art: "de_syntax_ok",
      normalisiert: "DE123456789",
    });
    expect(text).toContain(EIGENE_DE_NICHT_ISOLIERT);
    expect(text).not.toMatch(/gültig$/);
  });
});

describe("SCHNAPPSCHUSS_NICHT_LESBAR", () => {
  it("trennt Lesefehler von den Stammdaten", () => {
    expect(SCHNAPPSCHUSS_NICHT_LESBAR).toMatch(/nicht lesbar/);
    expect(SCHNAPPSCHUSS_NICHT_LESBAR).toMatch(/unberührt/);
    expect(SCHNAPPSCHUSS_NICHT_LESBAR).not.toMatch(/gültig$/);
  });
});
