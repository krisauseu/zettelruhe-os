import { describe, expect, it } from "vitest";
import { belegFreitextFilter } from "./repository";

describe("belegFreitextFilter", () => {
  it("sucht in Kategorie, Bezeichnung, Nummer, Konto, Lieferant:in und Kund:in", () => {
    const clause = belegFreitextFilter("Müller");
    expect(clause).toContain("kategorie~");
    expect(clause).toContain("notiz~");
    expect(clause).toContain("belegnummer~");
    expect(clause).toContain("konto~");
    expect(clause).toContain("lieferant.name~");
    expect(clause).toContain("kunde.name~");
    expect(clause).toContain("Müller");
  });
});
