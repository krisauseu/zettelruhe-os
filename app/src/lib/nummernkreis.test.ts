import { describe, expect, it } from "vitest";
import {
  DEFAULT_NUMMERNKREISE,
  formatNummernkreis,
  mergeNummernkreise,
  nextFreieNummer,
} from "./pb";

describe("formatNummernkreis", () => {
  it("setzt Prefix und füllt Stellen mit Nullen", () => {
    expect(
      formatNummernkreis({ prefix: "KT-", digits: 4, next: 1 }, "KT-"),
    ).toBe("KT-0001");
    expect(
      formatNummernkreis({ prefix: "KD-", digits: 4, next: 42 }, "KT-"),
    ).toBe("KD-0042");
  });

  it("nutzt den Fallback-Prefix wenn prefix fehlt", () => {
    expect(
      formatNummernkreis(
        { prefix: undefined as unknown as string, digits: 3, next: 7 },
        "KT-",
      ),
    ).toBe("KT-007");
  });
});

describe("nextFreieNummer", () => {
  const formatA = (n: number) =>
    formatNummernkreis({ prefix: "A-", digits: 4, next: n }, "A-");
  const formatR = (n: number) =>
    formatNummernkreis({ prefix: "R-", digits: 4, next: n }, "R-");

  it("nimmt start, wenn frei", async () => {
    const r = await nextFreieNummer({
      start: 2,
      format: formatA,
      istVergeben: () => false,
    });
    expect(r).toEqual({ nummer: "A-0002", naechste: 3 });
  });

  it("überspringt bereits vergebene Angebotsnummern", async () => {
    const vergeben = new Set(["A-0002", "A-0003", "A-0004"]);
    const r = await nextFreieNummer({
      start: 2,
      format: formatA,
      istVergeben: (nr) => vergeben.has(nr),
    });
    expect(r).toEqual({ nummer: "A-0005", naechste: 6 });
  });

  it("überspringt bereits vergebene Rechnungsnummern", async () => {
    const vergeben = new Set(["R-0001", "R-0002", "R-0003", "R-0004", "R-0005"]);
    const r = await nextFreieNummer({
      start: 4,
      format: formatR,
      istVergeben: (nr) => vergeben.has(nr),
    });
    expect(r).toEqual({ nummer: "R-0006", naechste: 7 });
  });

  it("bricht ab, wenn nichts frei ist", async () => {
    await expect(
      nextFreieNummer({
        start: 1,
        format: formatA,
        istVergeben: () => true,
        maxVersuche: 3,
      }),
    ).rejects.toThrow(/Keine freie Nummer/);
  });
});

describe("mergeNummernkreise", () => {
  it("füllt fehlenden Kontakt-Kreis aus dem Default", () => {
    const merged = mergeNummernkreise({
      angebot: { prefix: "A-", digits: 4, next: 1 },
      rechnung: { prefix: "R-", digits: 4, next: 3 },
      gutschrift: { prefix: "G-", digits: 4, next: 1 },
      beleg: { prefix: "B-", digits: 4, next: 1 },
      kasse: { prefix: "K-", digits: 4, next: 1 },
    });
    expect(merged.kontakt).toEqual(DEFAULT_NUMMERNKREISE.kontakt);
    expect(merged.rechnung.next).toBe(3);
  });

  it("behält ein vorhandenes Kontakt-Prefix", () => {
    const merged = mergeNummernkreise({
      ...DEFAULT_NUMMERNKREISE,
      kontakt: { prefix: "KD-", digits: 5, next: 12 },
    });
    expect(merged.kontakt).toEqual({ prefix: "KD-", digits: 5, next: 12 });
  });

  it("liefert die Defaults bei leerem Stand", () => {
    expect(mergeNummernkreise(null)).toEqual(DEFAULT_NUMMERNKREISE);
    expect(mergeNummernkreise(undefined)).toEqual(DEFAULT_NUMMERNKREISE);
  });
});
