import { describe, expect, it } from "vitest";
import { parseBankCsv, parseCsvRows } from "./csv";
import {
  buildIdempotenzSchluessel,
  extractRechnungsnummernCandidates,
  parseBankDatum,
  parseSignedBetrag,
  scoreMatch,
} from "./invariants";

describe("parseSignedBetrag", () => {
  it("de-DE positiv → Eingang", () => {
    expect(parseSignedBetrag("1.234,56")).toEqual({
      betrag: "1234.56",
      richtung: "eingang",
    });
  });

  it("negativ → Ausgang", () => {
    expect(parseSignedBetrag("-25,50")).toEqual({
      betrag: "25.50",
      richtung: "ausgang",
    });
  });

  it("Punkt-Dezimal", () => {
    expect(parseSignedBetrag("119.00")).toEqual({
      betrag: "119.00",
      richtung: "eingang",
    });
  });

  it("Richtungshinweis überschreibt Vorzeichen", () => {
    expect(parseSignedBetrag("50,00", "ausgang")).toEqual({
      betrag: "50.00",
      richtung: "ausgang",
    });
  });

  it("lehnt 0 ab", () => {
    expect(() => parseSignedBetrag("0")).toThrow(/ungleich 0/);
  });
});

describe("parseBankDatum", () => {
  it("ISO unverändert", () => {
    expect(parseBankDatum("2026-08-12")).toBe("2026-08-12");
  });

  it("de-DE", () => {
    expect(parseBankDatum("12.08.2026")).toBe("2026-08-12");
  });

  it("zweistelliges Jahr", () => {
    expect(parseBankDatum("1.2.26")).toBe("2026-02-01");
  });
});

describe("parseBankCsv", () => {
  it("parst Default-Vorlage (Semikolon, de-DE)", () => {
    const csv = [
      "Datum;Betrag;Verwendungszweck;Gegenkonto;IBAN;Referenz",
      "12.08.2026;119,00;Rechnung R-0001;Muster GmbH;DE89370400440532013000;R-0001",
      "13.08.2026;-25,50;Lastschrift Hosting;Provider AG;;",
    ].join("\n");

    const r = parseBankCsv(csv);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen).toHaveLength(2);
    expect(r.zeilen[0]).toMatchObject({
      datum: "2026-08-12",
      richtung: "eingang",
      betrag: "119.00",
      verwendungszweck: "Rechnung R-0001",
      gegenkonto_name: "Muster GmbH",
      referenz: "R-0001",
    });
    expect(r.zeilen[1]).toMatchObject({
      datum: "2026-08-13",
      richtung: "ausgang",
      betrag: "25.50",
    });
  });

  it("erkennt Komma-Delimiter", () => {
    const csv =
      "Datum,Betrag,Verwendungszweck\n2026-08-01,10.00,Test\n";
    const r = parseBankCsv(csv);
    expect(r.zeilen).toHaveLength(1);
    expect(r.zeilen[0]!.betrag).toBe("10.00");
  });

  it("meldet fehlende Datum-Spalte", () => {
    const r = parseBankCsv("Foo;Bar\n1;2\n");
    expect(r.zeilen).toHaveLength(0);
    expect(r.fehler[0]!.meldung).toMatch(/Datum/);
  });
});

describe("parseCsvRows", () => {
  it("quoted fields mit Delimiter", () => {
    const rows = parseCsvRows('a;b\n"x;y";z\n', ";");
    expect(rows[1]).toEqual(["x;y", "z"]);
  });
});

describe("Idempotenz-Schlüssel", () => {
  it("stabil und hex 64", () => {
    const zeile = {
      datum: "2026-08-12",
      richtung: "eingang" as const,
      betrag: "119.00",
      verwendungszweck: "Rechnung R-0001",
      gegenkonto_iban: "DE89 3704 0044 0532 0130 00",
      referenz: "R-0001",
    };
    const a = buildIdempotenzSchluessel("konto1", zeile);
    const b = buildIdempotenzSchluessel("konto1", {
      ...zeile,
      verwendungszweck: "  rechnung r-0001 ",
      gegenkonto_iban: "DE89370400440532013000",
    });
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
  });

  it("ändert sich bei Betrag", () => {
    const base = {
      datum: "2026-08-12",
      richtung: "eingang" as const,
      betrag: "100.00",
      verwendungszweck: "x",
      gegenkonto_iban: "",
      referenz: "",
    };
    expect(buildIdempotenzSchluessel("k", base)).not.toBe(
      buildIdempotenzSchluessel("k", { ...base, betrag: "100.01" }),
    );
  });
});

describe("extractRechnungsnummernCandidates / scoreMatch", () => {
  it("findet R-0001 im Verwendungszweck", () => {
    expect(extractRechnungsnummernCandidates("Zahlung Rechnung R-0001 danke")).toEqual(
      expect.arrayContaining(["R-0001"]),
    );
  });

  it("hoher Score bei Betrag + Nummer", () => {
    const { score, gruende } = scoreMatch({
      bewegungBetrag: "119.00",
      bewegungDatum: "2026-08-15",
      verwendungszweck: "RE R-0042",
      referenz: "",
      rechnungsnummer: "R-0042",
      offen: "119.00",
      brutto: "119.00",
      rechnungsdatum: "2026-08-10",
    });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(gruende.some((g) => /Betrag/i.test(g))).toBe(true);
    expect(gruende.some((g) => /Rechnungsnummer/i.test(g))).toBe(true);
  });

  it("niedriger Score ohne Übereinstimmung", () => {
    const { score } = scoreMatch({
      bewegungBetrag: "5.00",
      bewegungDatum: "2020-01-01",
      verwendungszweck: "Sonstiges",
      referenz: "",
      rechnungsnummer: "R-9999",
      offen: "500.00",
      brutto: "500.00",
      rechnungsdatum: "2026-08-01",
    });
    expect(score).toBeLessThan(40);
  });
});
