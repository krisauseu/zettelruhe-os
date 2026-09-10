import { describe, expect, it } from "vitest";
import { parseCsvRows, parseKontakteCsv, serializeKontakteCsv } from "./csv";
import type { Kontakt } from "./types";

describe("parseCsvRows", () => {
  it("parst Semikolon-CSV", () => {
    const rows = parseCsvRows("a;b;c\n1;2;3");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parst Komma-CSV und Quotes", () => {
    const rows = parseCsvRows('name,ort\n"Muster, GmbH","Berlin"');
    expect(rows).toEqual([
      ["name", "ort"],
      ["Muster, GmbH", "Berlin"],
    ]);
  });

  it("parst escaped Quotes", () => {
    const rows = parseCsvRows('name\n"Firma ""X"""');
    expect(rows[1][0]).toBe('Firma "X"');
  });
});

describe("parseKontakteCsv", () => {
  it("parst de-DE Header und Bool-Werte", () => {
    const csv = [
      "name;ist_kunde;ist_lieferant;email;ort",
      "Alpha GmbH;ja;nein;a@example.de;Berlin",
      "Beta AG;0;1;b@example.de;Hamburg",
    ].join("\n");

    const result = parseKontakteCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      name: "Alpha GmbH",
      ist_kunde: true,
      ist_lieferant: false,
      email: "a@example.de",
      ort: "Berlin",
    });
    expect(result.items[1]).toMatchObject({
      name: "Beta AG",
      ist_kunde: false,
      ist_lieferant: true,
    });
  });

  it("setzt Default Kund:in wenn keine Rolle", () => {
    const csv = "name;email\nNur Name;x@y.de\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].ist_kunde).toBe(true);
    expect(result.items[0].ist_lieferant).toBe(false);
  });

  it("liest USt-IdNr. aus ust_id", () => {
    const csv = "name;ust_id\nParis SARL;FR12345678901\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].ust_id).toBe("FR12345678901");
  });

  it("liest Leitweg-ID / Käuferreferenz", () => {
    const csv = "name;leitweg_id\nBehörde X;99-TEST-0000-00\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].leitweg_id).toBe("99-TEST-0000-00");
  });

  it("liest Kontaktnummer und Alias Kundennummer", () => {
    const csv = "name;kundennummer\nAlpha GmbH;KT-0042\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].kontaktnummer).toBe("KT-0042");
  });

  it("lässt leere Kontaktnummer weg (Auto-vergabe)", () => {
    const csv = "name;kontaktnummer\nNeu;\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].kontaktnummer).toBeUndefined();
  });

  it("akzeptiert Alias Firma als name", () => {
    const csv = "Firma;Kunde\nTestfirma;ja\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].name).toBe("Testfirma");
    expect(result.items[0].ist_kunde).toBe(true);
  });

  it("meldet fehlenden name-Header", () => {
    const result = parseKontakteCsv("email;ort\na@b.de;X\n");
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toMatch(/name/i);
  });

  it("überspringt leere Namen", () => {
    const csv = "name;email\n;a@b.de\nOk;c@d.de\n";
    const result = parseKontakteCsv(csv);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });
});

describe("serializeKontakteCsv", () => {
  it("roundtrip basic fields", () => {
    const items: Kontakt[] = [
      {
        id: "1",
        firma: "f",
        name: "Test; Firma",
        kontaktnummer: "KT-0001",
        ist_kunde: true,
        ist_lieferant: false,
        strasse: "A 1",
        plz: "12345",
        ort: "Köln",
        land: "DE",
        ust_id: "ATU12345678",
        leitweg_id: "",
        email: "t@example.de",
        telefon: "",
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
        notiz: 'Zeile "eins"',
      },
    ];
    const csv = serializeKontakteCsv(items);
    const body = csv.replace(/^\uFEFF/, "");
    const result = parseKontakteCsv(body);
    expect(result.items[0].name).toBe("Test; Firma");
    expect(result.items[0].iban).toBe("DE89370400440532013000");
    expect(result.items[0].ust_id).toBe("ATU12345678");
    expect(result.items[0].notiz).toBe('Zeile "eins"');
    expect(result.items[0].kontaktnummer).toBe("KT-0001");
  });

  it("exportiert und importiert den ersten Ansprechpartner", () => {
    const items: Kontakt[] = [
      {
        id: "1",
        firma: "f",
        name: "Alpha GmbH",
        kontaktnummer: "KT-0002",
        ist_kunde: true,
        ist_lieferant: false,
        strasse: "",
        plz: "",
        ort: "",
        land: "DE",
        ust_id: "",
        leitweg_id: "",
        email: "",
        telefon: "",
        iban: "",
        bic: "",
        notiz: "",
      },
    ];
    const csv = serializeKontakteCsv(
      items,
      ";",
      new Map([
        [
          "1",
          [
            {
              id: "ap1",
              firma: "f",
              kontakt: "1",
              name: "Ina Beispiel",
              email: "ina@alpha.de",
              telefon: "030 1",
              position: "Buchhaltung",
            },
            {
              id: "ap2",
              firma: "f",
              kontakt: "1",
              name: "Otto Zweit",
              email: "otto@alpha.de",
              telefon: "",
              position: "",
            },
          ],
        ],
      ]),
    );
    expect(csv).toContain("ansprechpartner_name");
    expect(csv).toContain("Ina Beispiel");
    expect(csv).toContain("Otto Zweit");
    const result = parseKontakteCsv(csv);
    expect(result.items[0].ansprechpartner?.name).toBe("Ina Beispiel");
    expect(result.items[0].ansprechpartner?.email).toBe("ina@alpha.de");
  });
});
