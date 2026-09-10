import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  assertCanCreateBeleg,
  deserializeParsed,
  PARSE_FEHLER_BELEG_ERROR,
  serializeParsed,
  validateERechnungDatei,
} from "./invariants";
import {
  LIEFERANT_MATCH_MIN_SCORE,
  mapParsedToBelegInput,
  scoreLieferantMatch,
} from "./mapping";
import { parseEInvoiceFile, parseEInvoiceXml } from "./parse";
import {
  extractUncompressedXmlFromPdf,
  extractXmlFromPdf,
  PDF_OHNE_XML_ERROR,
  PDF_VERSCHLUESSELT_ERROR,
} from "./parse-pdf-xml";
import {
  mapTaxPercentToSteuersatz,
  normalizeEInvoiceAmount,
  normalizeEInvoiceDate,
  stripXmlNamespaces,
} from "./parse-utils";
import type { ParsedEInvoice } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ublXml = readFileSync(
  join(__dirname, "fixtures/xrechnung-minimal.xml"),
  "utf8",
);
const ciiXml = readFileSync(
  join(__dirname, "fixtures/zugferd-cii-minimal.xml"),
  "utf8",
);

describe("parse-utils", () => {
  it("stript Namespace-Präfixe", () => {
    const stripped = stripXmlNamespaces("<cbc:ID>A1</cbc:ID>");
    expect(stripped).toContain("<ID>A1</ID>");
  });

  it("normalisiert Datum YYYYMMDD und ISO", () => {
    expect(normalizeEInvoiceDate("20260805")).toBe("2026-08-05");
    expect(normalizeEInvoiceDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeEInvoiceDate("2026-08-01T12:00:00")).toBe("2026-08-01");
  });

  it("normalisiert Beträge Punkt/Komma", () => {
    expect(normalizeEInvoiceAmount("119.00")).toBe("119.00");
    expect(normalizeEInvoiceAmount("1.234,56")).toBe("1234.56");
    expect(normalizeEInvoiceAmount("19,5")).toBe("19.50");
  });

  it("mappt Steuersätze", () => {
    expect(mapTaxPercentToSteuersatz("19")).toBe("19");
    expect(mapTaxPercentToSteuersatz("19.00")).toBe("19");
    expect(mapTaxPercentToSteuersatz("7")).toBe("7");
    expect(mapTaxPercentToSteuersatz("0")).toBe("0");
    expect(mapTaxPercentToSteuersatz("16")).toBe("");
  });
});

describe("parse XRechnung UBL", () => {
  it("parst Fixture zu ParsedEInvoice", () => {
    const result = parseEInvoiceXml(ublXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.format).toBe("xrechnung_ubl");
    expect(result.data.rechnungsnummer).toBe("XR-2026-0042");
    expect(result.data.rechnungsdatum).toBe("2026-08-01");
    expect(result.data.faelligkeitsdatum).toBe("2026-08-15");
    expect(result.data.waehrung).toBe("EUR");
    expect(result.data.lieferant.name).toBe("Muster Liefer GmbH");
    expect(result.data.lieferant.ust_id).toBe("DE123456789");
    expect(result.data.betrag_netto).toBe("100.00");
    expect(result.data.betrag_ust).toBe("19.00");
    expect(result.data.betrag_brutto).toBe("119.00");
    expect(result.data.steuersatz).toBe("19");
    expect(result.data.positionen?.[0]?.text).toContain("Beratung");
  });

  it("parst über File-Fassade (Bytes)", () => {
    const bytes = Buffer.from(ublXml, "utf8");
    const result = parseEInvoiceFile({
      bytes,
      filename: "xrechnung.xml",
      mimeType: "application/xml",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("XR-2026-0042");
  });
});

describe("parse ZUGFeRD CII", () => {
  it("parst CII-Fixture", () => {
    const result = parseEInvoiceXml(ciiXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.format).toBe("zugferd_cii");
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
    expect(result.data.rechnungsdatum).toBe("2026-08-05");
    expect(result.data.lieferant.name).toBe("ZUGFeRD Hosting AG");
    expect(result.data.lieferant.ust_id).toBe("DE987654321");
    expect(result.data.betrag_netto).toBe("50.00");
    expect(result.data.betrag_ust).toBe("9.50");
    expect(result.data.betrag_brutto).toBe("59.50");
    expect(result.data.steuersatz).toBe("19");
  });

  it("extrahiert XML aus PDF-Bytes light (unkomprimiert)", () => {
    const pdfLike = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<<>>\nendobj\n${ciiXml}\n%%EOF`,
      "latin1",
    );
    const extracted = extractXmlFromPdf(new Uint8Array(pdfLike));
    expect(extracted).toBeTruthy();
    expect(extracted).toContain("CrossIndustryInvoice");

    const result = parseEInvoiceFile({
      bytes: pdfLike,
      filename: "zugferd.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
  });

  it("liest Flate-Attachment factur-x.xml", () => {
    const pdf = buildPdfWithAttachments([
      { name: "factur-x.xml", xml: ciiXml, flate: true },
    ]);
    expect(extractUncompressedXmlFromPdf(pdf)).toBeNull();
    const extracted = extractXmlFromPdf(pdf);
    expect(extracted).toContain("ZF-2026-0007");

    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "rechnung.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.format).toBe("zugferd_cii");
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
    expect(result.data.betrag_brutto).toBe("59.50");
    expect(result.data.lieferant.name).toBe("ZUGFeRD Hosting AG");
  });

  it("liest Flate trotz umbrochenem /Type und verschachteltem /Params", () => {
    const pdf = buildIntarsysLikeFlatePdf(ciiXml);
    expect(extractUncompressedXmlFromPdf(pdf)).toBeNull();
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "einfach.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
  });

  it("bevorzugt factur-x.xml wenn mehrere Anhänge Invoice-XML sind", () => {
    const other = ciiXml.replace("ZF-2026-0007", "OTHER-1");
    const pdf = buildPdfWithAttachments([
      { name: "notes.xml", xml: other, flate: true },
      { name: "factur-x.xml", xml: ciiXml, flate: true },
    ]);
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "zwei.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
  });
});

describe("unparseable Guard", () => {
  it("liefert Fehler, verwirft nicht still", () => {
    const result = parseEInvoiceXml("<root>kein e-rechnung</root>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(5);
  });

  it("lehnt leere Datei ab", () => {
    const result = parseEInvoiceFile({
      bytes: new Uint8Array(0),
      filename: "x.xml",
    });
    expect(result.ok).toBe(false);
  });

  it("PDF ohne XML → Fehler", () => {
    const pdf = Buffer.from("%PDF-1.4 empty no invoice %%EOF", "utf8");
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "scan.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_OHNE_XML_ERROR);
  });

  it("Flate-Content ohne /EmbeddedFile ist kein E-Rechnungs-XML", () => {
    const compressed = deflateSync(Buffer.from(ciiXml, "utf8"));
    const pdf = Buffer.concat([
      Buffer.from(
        `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>
endobj
4 0 obj
<< /Filter /FlateDecode /Length ${compressed.length} >>
stream
`,
        "latin1",
      ),
      compressed,
      Buffer.from(
        `
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`,
        "latin1",
      ),
    ]);
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "nur-inhalt.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_OHNE_XML_ERROR);
  });

  it("verschlüsseltes PDF → ehrlicher Fehler, kein XML-Raten", () => {
    const pdf = Buffer.from(
      `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Encrypt 5 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>
endobj
5 0 obj
<< /Filter /Standard /V 1 /R 2 /O (x) /U (y) /P -4 >>
endobj
${ciiXml}
trailer
<< /Root 1 0 R /Encrypt 5 0 R >>
%%EOF
`,
      "latin1",
    );
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "geheim.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_VERSCHLUESSELT_ERROR);
  });
});

describe("mapping → BelegInput", () => {
  const dto: ParsedEInvoice = {
    format: "xrechnung_ubl",
    rechnungsnummer: "XR-1",
    rechnungsdatum: "2026-08-01",
    waehrung: "EUR",
    lieferant: { name: "Liefer AG", ust_id: "DE111" },
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuersatz: "19",
  };

  it("Regelbesteuerung behält USt", () => {
    const input = mapParsedToBelegInput(dto, {
      steuermodus: "regelbesteuerung_ist",
      lieferantId: "kontakt1",
    });
    expect(input.richtung).toBe("ausgabe");
    expect(input.belegdatum).toBe("2026-08-01");
    expect(input.betrag_netto).toBe("100.00");
    expect(input.betrag_ust).toBe("19.00");
    expect(input.betrag_brutto).toBe("119.00");
    expect(input.steuersatz).toBe("19");
    expect(input.lieferant).toBe("kontakt1");
    expect(input.kategorie).toBe("E-Rechnung");
    expect(input.notiz).toContain("XR-1");
  });

  it("Kleinunternehmer setzt USt light auf 0", () => {
    const input = mapParsedToBelegInput(dto, {
      steuermodus: "kleinunternehmer",
    });
    expect(input.betrag_ust).toBe("0.00");
    expect(input.steuersatz).toBe("0");
    expect(input.betrag_brutto).toBe("119.00");
    expect(input.betrag_netto).toBe("119.00");
    expect(input.notiz).toContain("Liefer AG");
  });
});

describe("Lieferant:in Match light", () => {
  const dto: ParsedEInvoice = {
    format: "xrechnung_ubl",
    rechnungsnummer: "X",
    rechnungsdatum: "2026-01-01",
    waehrung: "EUR",
    lieferant: { name: "Muster Liefer GmbH", ust_id: "DE123456789" },
    betrag_netto: "1.00",
    betrag_ust: "0.00",
    betrag_brutto: "1.00",
  };

  it("exakter Name scoret hoch", () => {
    const score = scoreLieferantMatch(dto, {
      id: "1",
      name: "Muster Liefer GmbH",
      ist_lieferant: true,
    });
    expect(score).toBeGreaterThanOrEqual(LIEFERANT_MATCH_MIN_SCORE);
  });

  it("USt-Id in Notiz scoret", () => {
    const score = scoreLieferantMatch(dto, {
      id: "2",
      name: "Andere Firma",
      notiz: "USt-Id DE123456789",
      ist_lieferant: true,
    });
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("USt-Id am Stamm scoret, ohne die Notiz zu brauchen", () => {
    const score = scoreLieferantMatch(dto, {
      id: "3",
      name: "Andere Firma",
      ust_id: "DE123456789",
      ist_lieferant: true,
    });
    expect(score).toBeGreaterThanOrEqual(50);
  });
});

describe("invariants", () => {
  it("validiert Dateityp und Größe", () => {
    expect(() =>
      validateERechnungDatei({
        type: "application/xml",
        size: 100,
        name: "a.xml",
      }),
    ).not.toThrow();
    expect(() =>
      validateERechnungDatei({ type: "image/png", size: 100, name: "a.png" }),
    ).toThrow(/Dateityp/);
    expect(() =>
      validateERechnungDatei({ type: "application/xml", size: 0, name: "a.xml" }),
    ).toThrow(/leer/);
  });

  it("assertCanCreateBeleg blockiert unparseable und doppelten Beleg", () => {
    expect(() =>
      assertCanCreateBeleg({
        parse_status: "fehler",
        beleg: null,
        status: "neu",
      }),
    ).toThrow(PARSE_FEHLER_BELEG_ERROR);

    expect(() =>
      assertCanCreateBeleg({
        parse_status: "ok",
        beleg: "abc",
        status: "beleg_erstellt",
      }),
    ).toThrow(/bereits/);
  });

  it("serialisiert DTO roundtrip", () => {
    const result = parseEInvoiceXml(ublXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = serializeParsed(result.data);
    const back = deserializeParsed(raw);
    expect(back?.rechnungsnummer).toBe(result.data.rechnungsnummer);
    expect(back?.betrag_brutto).toBe("119.00");
  });
});

type TestAttachment = { name: string; xml: string; flate?: boolean };

/** Minimales PDF mit /EmbeddedFiles. Fixtures synthetisch, kein Corpus. */
function buildPdfWithAttachments(files: TestAttachment[]): Buffer {
  const parts: Buffer[] = [];
  const namePairs: string[] = [];
  const filespecObjs: string[] = [];
  let nextObj = 6;
  const fileSpecs: { specObj: number; streamObj: number; name: string }[] = [];

  const streams: { obj: number; header: string; payload: Buffer }[] = [];

  for (const file of files) {
    const specObj = nextObj++;
    const streamObj = nextObj++;
    fileSpecs.push({ specObj, streamObj, name: file.name });
    namePairs.push(`(${file.name}) ${specObj} 0 R`);
    filespecObjs.push(
      `${specObj} 0 obj\n<< /Type /Filespec /F (${file.name}) /UF (${file.name}) /EF << /F ${streamObj} 0 R >> /AFRelationship /Alternative >>\nendobj\n`,
    );
    const raw = Buffer.from(file.xml, "utf8");
    const payload = file.flate ? deflateSync(raw) : raw;
    const filter = file.flate ? "/Filter /FlateDecode " : "";
    streams.push({
      obj: streamObj,
      header: `${streamObj} 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml ${filter}/Length ${payload.length} >>\nstream\n`,
      payload,
    });
  }

  const catalog = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 5 0 R >> /AF [ ${fileSpecs.map((f) => `${f.specObj} 0 R`).join(" ")} ] >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>
endobj
5 0 obj
<< /Names [ ${namePairs.join(" ")} ] >>
endobj
`;

  parts.push(Buffer.from(catalog, "latin1"));
  for (const spec of filespecObjs) {
    parts.push(Buffer.from(spec, "latin1"));
  }
  for (const s of streams) {
    parts.push(Buffer.from(s.header, "latin1"));
    parts.push(s.payload);
    parts.push(Buffer.from("\nendstream\nendobj\n", "latin1"));
  }
  parts.push(Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
  return Buffer.concat(parts);
}

/** Wie intarsys: /Type umbrochen, /Params verschachtelt, Flate. */
function buildIntarsysLikeFlatePdf(xml: string): Buffer {
  const payload = deflateSync(Buffer.from(xml, "utf8"));
  const header = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 5 0 R >> /AF [4 0 R] >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>
endobj
4 0 obj
<< /Type /Filespec /F (zugferd-invoice.xml) /EF << /F 6 0 R >> >>
endobj
5 0 obj
<< /Names [ (zugferd-invoice.xml) 4 0 R ] >>
endobj
6 0 obj
<</Filter /FlateDecode /Length ${payload.length} /Params
  <</ModDate (D:20260818120000+00'00')>> /Subtype /text#2Fxml /Type
  /EmbeddedFile>>
stream
`;
  return Buffer.concat([
    Buffer.from(header, "latin1"),
    payload,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
}

describe("RC and currency import boundaries", () => {
  for (const [format, source, tag] of [["UBL", ublXml, "DocumentCurrencyCode"], ["CII", ciiXml, "InvoiceCurrencyCode"]]) {
    it(`${format}: missing document currency never means EUR`, () => {
      const xml = source.replace(new RegExp(`<[^<>]*${tag}[^>]*>[^<]*</[^<>]*${tag}>`, "g"), "");
      const parsed = parseEInvoiceXml(xml);
      expect(parsed.ok).toBe(true); if (!parsed.ok) return;
      expect(parsed.data.waehrung).toBe("");
      expect(() => mapParsedToBelegInput(parsed.data, { steuermodus: "kleinunternehmer" })).toThrow(/unbekannt/);
    });
    it(`${format}: foreign currency rejected before KU normalization`, () => {
      const parsed = parseEInvoiceXml(source.replaceAll("EUR", "USD"));
      expect(parsed.ok).toBe(true); if (!parsed.ok) return;
      for (const steuermodus of ["kleinunternehmer", "regelbesteuerung_ist"] as const) expect(() => mapParsedToBelegInput(parsed.data, { steuermodus })).toThrow(/USD/);
    });
    it(`${format}: RC text is a review hint, never ordinary zero tax`, () => {
      const parsed = parseEInvoiceXml(source.replace(/(<[^>]*Invoice[^>]*>)/, "$1<Note>Tax to be paid on reverse charge basis</Note>"));
      expect(parsed.ok).toBe(true); if (!parsed.ok) return;
      expect(parsed.data.rc_hinweis).toBe(true);
      for (const steuermodus of ["kleinunternehmer", "regelbesteuerung_ist"] as const) expect(() => mapParsedToBelegInput(parsed.data, { steuermodus })).toThrow(/Reverse-Charge-Hinweis/);
    });
  }
  it("UBL AE in a later line and CII AE in a later tax group are retained", () => {
    for (const source of [ublXml.replace("</Invoice>", "<ClassifiedTaxCategory><ID>AE</ID></ClassifiedTaxCategory></Invoice>"), ciiXml.replace("</rsm:CrossIndustryInvoice>", "<ram:ApplicableTradeTax><ram:CategoryCode>AE</ram:CategoryCode></ram:ApplicableTradeTax></rsm:CrossIndustryInvoice>")]) {
      const result = parseEInvoiceXml(source); expect(result.ok).toBe(true); if (result.ok) expect(result.data.rc_hinweis).toBe(true);
    }
  });
  it("foreign supplier with ordinary German VAT stays ordinary", () => {
    const parsed = parseEInvoiceXml(ublXml); if (!parsed.ok) throw new Error(parsed.error);
    parsed.data.lieferant.land = "IE"; parsed.data.lieferant.ust_id = "DE123456789";
    const b = mapParsedToBelegInput(parsed.data, { steuermodus: "regelbesteuerung_ist" });
    expect(b).toMatchObject({ steuersatz: "19", betrag_ust: "19.00" }); expect(b.rc).toBeUndefined();
  });
});
