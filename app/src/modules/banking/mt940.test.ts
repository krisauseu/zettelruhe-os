import { describe, expect, it } from "vitest";
import { decodeBankImportBytes } from "./encoding";
import { buildIdempotenzSchluessel } from "./invariants";
import {
  MT940_BUNQ_AEHNLICH,
  MT940_KLASSISCH,
  MT940_KONTO_OHNE_IBAN,
  MT940_MEHRSATZ,
  MT940_OHNE_SCHLUSSSALDO,
  MT940_SWIFT_HUELLE,
} from "./mt940.fixtures";
import {
  anzeigeVerwendungszweck,
  detectBankImportFormat,
  extractIbanFromKontoId,
  looksLikeMt940,
  parseMt940,
  parseMt940Info86,
  parseSlashInfo86,
  parseSwiftYymmdd,
  pruefeMt940KontoIds,
} from "./mt940";

describe("parseSwiftYymmdd", () => {
  it("26 → 2026", () => {
    expect(parseSwiftYymmdd("260802")).toBe("2026-08-02");
  });

  it("70 → 1970", () => {
    expect(parseSwiftYymmdd("700101")).toBe("1970-01-01");
  });

  it("lehnt unmöglichen Tag ab", () => {
    expect(() => parseSwiftYymmdd("260231")).toThrow(/Datum/);
  });
});

describe("parseMt940 klassisch", () => {
  it("parst Valuta, C/D mit Funds-Code, strukturiertes und freies :86:", () => {
    const r = parseMt940(MT940_KLASSISCH);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen).toHaveLength(2);
    expect(r.zeilen[0]).toEqual({
      datum: "2026-08-02",
      richtung: "eingang",
      betrag: "119.00",
      verwendungszweck: "Rechnung R-0001",
      gegenkonto_name: "Muster GmbH",
      gegenkonto_iban: "DE02120300000000202051",
      referenz: "R-0001",
    });
    expect(r.zeilen[1]).toMatchObject({
      datum: "2026-08-03",
      richtung: "ausgang",
      betrag: "25.50",
      verwendungszweck: "Lastschrift Hosting",
      referenz: "",
    });
    expect(r.kontoIds).toEqual(["DE89370400440532013000"]);
  });

  it("RC = Ausgang, RD = Eingang", () => {
    const text = [
      ":20:STARTUMS",
      ":25:DE89370400440532013000",
      ":60F:C260801EUR0,00",
      ":61:260801RC15,00NMSCNONREF",
      ":86:Storno Gutschrift",
      ":61:260801RD8,50NMSCNONREF",
      ":86:Storno Lastschrift",
      ":62F:C260801EUR0,00",
      "-",
    ].join("\n");
    const r = parseMt940(text);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen[0]).toMatchObject({
      richtung: "ausgang",
      betrag: "15.00",
    });
    expect(r.zeilen[1]).toMatchObject({
      richtung: "eingang",
      betrag: "8.50",
    });
  });

  it("Mehrsatz-Datei", () => {
    const r = parseMt940(MT940_MEHRSATZ);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen).toHaveLength(3);
    expect(r.zeilen.map((z) => z.verwendungszweck)).toEqual([
      "Satz eins",
      "Satz zwei A",
      "Satz zwei B",
    ]);
  });

  it("SWIFT-Hülle {4: … -}", () => {
    const r = parseMt940(MT940_SWIFT_HUELLE);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen).toHaveLength(1);
    expect(r.zeilen[0]).toMatchObject({
      betrag: "50.00",
      referenz: "REF50",
      verwendungszweck: "Huelle",
    });
  });

  it("lehnt unvollständigen Satz ohne :62: ab", () => {
    const r = parseMt940(MT940_OHNE_SCHLUSSSALDO);
    expect(r.zeilen).toHaveLength(0);
    expect(r.fehler[0]!.meldung).toMatch(/Schlusssaldo/);
  });

  it("lehnt Betrag mit Tausenderpunkt ab", () => {
    const text = [
      ":20:STARTUMS",
      ":25:DE89370400440532013000",
      ":60F:C260801EUR0,00",
      ":61:260801C1.234,56NMSCNONREF",
      ":86:x",
      ":62F:C260801EUR0,00",
      "-",
    ].join("\n");
    const r = parseMt940(text);
    expect(r.zeilen).toHaveLength(0);
    expect(r.fehler[0]!.meldung).toMatch(/SWIFT-Format/);
  });
});

describe("parseMt940Info86", () => {
  it("unstrukturiert = ganzer Text", () => {
    expect(parseMt940Info86("Rechnung R-0001")).toEqual({
      vwz: "Rechnung R-0001",
      name: "",
      iban: "",
    });
  });

  it("Schrägstrich-:86: behält vollen Text (Idempotenz), Name separat", () => {
    const raw =
      "/IBAN/DE02120300000000202051/NAME/Muster GmbH/REMI/Rechnung R-0001";
    expect(parseMt940Info86(raw)).toEqual({
      vwz: raw,
      name: "Muster GmbH",
      iban: "",
    });
  });

  it("rät keine IBAN aus BLZ/Konto", () => {
    const r = parseMt940Info86(
      "?00GUTSCHRIFT?20Rechnung?3037040044?310532013000?32Kunde",
    );
    expect(r.iban).toBe("");
    expect(r.name).toBe("Kunde");
    expect(r.vwz).toBe("Rechnung");
  });
});

describe("bunq-ähnliches STA", () => {
  it("akzeptiert :25: mit EUR und parst C6,", () => {
    const r = parseMt940(MT940_BUNQ_AEHNLICH);
    expect(r.fehler).toEqual([]);
    expect(r.zeilen).toHaveLength(2);
    expect(extractIbanFromKontoId(r.kontoIds[0] ?? "")).toBe(
      "DE89370400440532013000",
    );
    expect(pruefeMt940KontoIds(r.kontoIds, "DE89370400440532013000").ablehnen).toBeUndefined();
    expect(r.zeilen[0]).toMatchObject({
      datum: "2026-08-02",
      richtung: "eingang",
      betrag: "6.00",
      gegenkonto_name: "Muster GmbH",
    });
    expect(r.zeilen[0]!.verwendungszweck.startsWith("/IBAN/")).toBe(true);
    expect(anzeigeVerwendungszweck(r.zeilen[0]!)).toBe("Muster GmbH");
    expect(anzeigeVerwendungszweck(r.zeilen[1]!)).toBe("Rechnung R-0001");
  });
});

describe("parseSlashInfo86 / Anzeige", () => {
  it("nimmt REMI, sonst NAME — nicht den IBAN-Anfang", () => {
    expect(
      parseSlashInfo86(
        "/IBAN/DE02120300000000202051/NAME/Muster GmbH/REMI/Umbuchung",
      ),
    ).toMatchObject({
      structured: true,
      vwz: "Umbuchung",
      name: "Muster GmbH",
      iban: "DE02120300000000202051",
    });
    expect(
      anzeigeVerwendungszweck({
        verwendungszweck:
          "/IBAN/DE14700500000002034300/NAME/Stadtwerke/REMI/",
      }),
    ).toBe("Stadtwerke");
  });
});

describe("Idempotenz wie CSV", () => {
  it("gleicher Inhalt → gleicher Hash", () => {
    const r = parseMt940(MT940_KLASSISCH);
    const zeile = r.zeilen[0]!;
    const fromMt = buildIdempotenzSchluessel("konto1", zeile);
    const fromCsv = buildIdempotenzSchluessel("konto1", {
      datum: "2026-08-02",
      richtung: "eingang",
      betrag: "119.00",
      verwendungszweck: "Rechnung R-0001",
      gegenkonto_iban: "DE02120300000000202051",
      referenz: "R-0001",
    });
    expect(fromMt).toBe(fromCsv);
    expect(fromMt).toHaveLength(64);
  });
});

describe(":25: gegen Stammdaten-IBAN", () => {
  it("findet IBAN in :25:", () => {
    expect(extractIbanFromKontoId("COBADEFFXXX/DE89370400440532013000")).toBe(
      "DE89370400440532013000",
    );
    expect(extractIbanFromKontoId("37040044/0532013000")).toBeNull();
  });

  it("hängt EUR in :25: nicht an die IBAN", () => {
    expect(extractIbanFromKontoId("DE89370400440532013000 EUR")).toBe(
      "DE89370400440532013000",
    );
    expect(extractIbanFromKontoId("DE89370400440532013000EUR")).toBe(
      "DE89370400440532013000",
    );
    const r = pruefeMt940KontoIds(
      ["DE89370400440532013000EUR"],
      "DE89370400440532013000",
    );
    expect(r.ablehnen).toBeUndefined();
  });

  it("lehnt abweichende IBAN ab", () => {
    const r = pruefeMt940KontoIds(
      ["DE89370400440532013000"],
      "DE02120300000000202051",
    );
    expect(r.ablehnen).toMatch(/passt nicht/);
  });

  it("passt bei gleicher IBAN", () => {
    const r = pruefeMt940KontoIds(
      ["DE89 3704 0044 0532 0130 00"],
      "DE89370400440532013000",
    );
    expect(r.ablehnen).toBeUndefined();
    expect(r.warnungen).toEqual([]);
  });

  it("warnt bei BLZ/Konto ohne IBAN", () => {
    const parsed = parseMt940(MT940_KONTO_OHNE_IBAN);
    const r = pruefeMt940KontoIds(parsed.kontoIds, "DE89370400440532013000");
    expect(r.ablehnen).toBeUndefined();
    expect(r.warnungen[0]).toMatch(/keine IBAN/);
  });

  it("lehnt ab, wenn Datei-IBAN da ist, Stamm ohne IBAN", () => {
    const r = pruefeMt940KontoIds(["DE89370400440532013000"], "");
    expect(r.ablehnen).toMatch(/keine IBAN hinterlegt/);
  });
});

describe("detectBankImportFormat", () => {
  it("erkennt MT940 am Inhalt", () => {
    expect(looksLikeMt940(MT940_KLASSISCH)).toBe(true);
    expect(detectBankImportFormat(MT940_KLASSISCH, "auszug.csv")).toBe("mt940");
  });

  it("CSV bleibt CSV", () => {
    const csv = "Datum;Betrag;Verwendungszweck\n12.08.2026;10,00;Test\n";
    expect(detectBankImportFormat(csv, "konto.csv")).toBe("csv");
  });

  it("lehnt CAMT und MT942 ab", () => {
    expect(() =>
      detectBankImportFormat(
        '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">',
      ),
    ).toThrow(/CAMT/);
    expect(() =>
      detectBankImportFormat(":20:INTRADAY\n:25:DE89\n:34F:EUR0,\n:61:260801C1,00NMSC\n"),
    ).toThrow(/MT942/);
  });

  it("lehnt .sta ohne MT940-Inhalt ab", () => {
    expect(() => detectBankImportFormat("nur text", "auszug.sta")).toThrow(
      /\.sta/,
    );
  });
});

describe("decodeBankImportBytes", () => {
  it("UTF-8 mit Umlaut", () => {
    const { text, encoding } = decodeBankImportBytes(
      new TextEncoder().encode(":86:Miete für August"),
    );
    expect(encoding).toBe("utf-8");
    expect(text).toContain("für");
  });

  it("Windows-1252 mit Umlaut", () => {
    const bytes = Uint8Array.from([
      0x3a, 0x38, 0x36, 0x3a, 0x4d, 0x69, 0x65, 0x74, 0x65, 0x20, 0x66, 0xfc,
      0x72,
    ]);
    const { text, encoding } = decodeBankImportBytes(bytes);
    expect(encoding).toBe("windows-1252");
    expect(text).toBe(":86:Miete für");
  });
});

it('parses the published synthetic release fixture with balanced statement totals', async () => {
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(new URL('./fixtures/synthetisch.sta', import.meta.url), 'utf8');
  const result = parseMt940(text);
  expect(result.fehler).toEqual([]);
  expect(result.zeilen.map(z => [z.richtung, z.betrag])).toEqual([['eingang', '119.00'], ['ausgang', '19.00']]);
});
