import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_ADRESSFELD_HEIGHT,
  PDF_ADRESSFELD_LEFT,
  PDF_ADRESSFELD_TOP,
  PDF_ADRESSFELD_WIDTH,
  PDF_FUSSTEXT_MARGIN_TOP,
  PDF_KOPF_RESERVE_HEIGHT,
  PDF_LOGO_HEIGHT,
  PDF_LOGO_WIDTH,
  PDF_PAGE_PADDING_BOTTOM,
  PDF_PAGE_PADDING_LEFT,
  PDF_PAGE_PADDING_TOP,
  PDF_WASSERZEICHEN_ENTWURF,
  assertLogoUpload,
  fitPdfLogo,
  imageSizeFromBytes,
  mmToPt,
  pdfLogoBoxFromDataUri,
  dokumentSchalterWert,
  dokumentTitel,
  footerBankzeile,
  footerStammdatenSpalten,
  footerTextZeilen,
  formatIbanAnzeige,
  formatLeistungszeitraum,
  formatPdfDateDe,
  formatWebseiteAnzeige,
  guessImageMime,
  kontrastTextAuf,
  normalizeAkzentfarbe,
  parseDokumentSchalterForm,
  pdfDateiname,
  pdfNummerAnzeige,
  pickDokumentBankkonto,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
  zahlungshinweisRechnung,
} from "./pdf-layout";

describe("pdfNummerAnzeige", () => {
  it("zeigt im Entwurf nie eine Nummer", () => {
    expect(
      pdfNummerAnzeige({ entwurf: true, nummer: "R-0001" }),
    ).toBe(PDF_WASSERZEICHEN_ENTWURF);
    expect(pdfNummerAnzeige({ entwurf: true, nummer: "" })).toBe(
      PDF_WASSERZEICHEN_ENTWURF,
    );
  });

  it("zeigt nach Festschreibung/Senden die Nummer", () => {
    expect(
      pdfNummerAnzeige({ entwurf: false, nummer: "A-0003" }),
    ).toBe("A-0003");
    expect(pdfNummerAnzeige({ entwurf: false, nummer: "" })).toBe("—");
  });
});

describe("pdfDateiname", () => {
  it("benennt Entwurfs-PDFs ohne Kreisnummer", () => {
    expect(pdfDateiname({ art: "angebot", entwurf: true })).toBe(
      "Angebot-Entwurf.pdf",
    );
    expect(
      pdfDateiname({ art: "rechnung", entwurf: true, nummer: "R-0001" }),
    ).toBe("Rechnung-Entwurf.pdf");
  });

  it("benennt Originale nach der Nummer", () => {
    expect(
      pdfDateiname({ art: "rechnung", entwurf: false, nummer: "R-0002" }),
    ).toBe("R-0002.pdf");
  });
});

describe("normalizeAkzentfarbe", () => {
  it("füllt leer mit Default", () => {
    expect(normalizeAkzentfarbe("")).toBe(DEFAULT_DOKUMENT_AKZENTFARBE);
    expect(normalizeAkzentfarbe(null)).toBe(DEFAULT_DOKUMENT_AKZENTFARBE);
  });

  it("normalisiert #RGB und #RRGGBB", () => {
    expect(normalizeAkzentfarbe("#2b6")).toBe("#22BB66");
    expect(normalizeAkzentfarbe("2B6CB0")).toBe("#2B6CB0");
  });

  it("lehnt Ungültiges ab", () => {
    expect(normalizeAkzentfarbe("red")).toBeNull();
    expect(normalizeAkzentfarbe("#12")).toBeNull();
    expect(() => validateDokumentAkzentfarbe("nope")).toThrow(/Akzentfarbe/);
  });
});

describe("validateDokumentTexte", () => {
  it("trimmt und begrenzt", () => {
    expect(validateDokumentTexte({ kopftext: "  Hallo  ", fusstext: "" })).toEqual({
      kopftext: "Hallo",
      fusstext: "",
    });
    expect(() =>
      validateDokumentTexte({ kopftext: "x".repeat(501) }),
    ).toThrow(/Kopftext/);
    expect(() =>
      validateDokumentTexte({ fusstext: "y".repeat(1001) }),
    ).toThrow(/Fußtext/);
  });
});

describe("DIN 5008 Form B Adressfeld", () => {
  it("liegt 45 mm unter der Blattkante, 20 mm vom linken Rand, 85 × 45 mm", () => {
    expect(PDF_ADRESSFELD_LEFT).toBeCloseTo(mmToPt(20), 5);
    expect(PDF_ADRESSFELD_TOP).toBeCloseTo(mmToPt(45), 5);
    expect(PDF_ADRESSFELD_WIDTH).toBeCloseTo(mmToPt(85), 5);
    expect(PDF_ADRESSFELD_HEIGHT).toBeCloseTo(mmToPt(45), 5);
    expect(PDF_PAGE_PADDING_LEFT).toBe(PDF_ADRESSFELD_LEFT);
  });

  it("hält den Firmenblock oben rechts; Betreff beginnt unter dem Adressfeld", () => {
    expect(PDF_PAGE_PADDING_TOP).toBe(44);
    expect(PDF_KOPF_RESERVE_HEIGHT).toBe(
      PDF_ADRESSFELD_TOP + PDF_ADRESSFELD_HEIGHT - PDF_PAGE_PADDING_TOP,
    );
    expect(PDF_ADRESSFELD_TOP - PDF_PAGE_PADDING_TOP).toBeGreaterThan(
      mmToPt(20),
    );
  });
});

describe("Fußtext-Abstand", () => {
  it("setzt den Fußtext mit festem Abstand hinter den Inhalt, Stammdaten bleiben unten", () => {
    expect(PDF_FUSSTEXT_MARGIN_TOP).toBeGreaterThanOrEqual(12);
    expect(PDF_FUSSTEXT_MARGIN_TOP).toBeLessThanOrEqual(18);
    expect(PDF_PAGE_PADDING_BOTTOM).toBeGreaterThanOrEqual(48);
    expect(PDF_PAGE_PADDING_BOTTOM).toBeLessThan(90);
  });
});

describe("PDF-Logo-Box", () => {
  it("gibt dem Firmenlogo mehr als eine Miniatur auf A4", () => {
    expect(PDF_LOGO_WIDTH).toBeGreaterThanOrEqual(160);
    expect(PDF_LOGO_HEIGHT).toBeGreaterThanOrEqual(72);
  });

  it("füllt die Breite nur bei weiten Logos, die Höhe nur bei hohen", () => {
    const weit = fitPdfLogo(800, 235);
    expect(weit.width).toBe(PDF_LOGO_WIDTH);
    expect(weit.height).toBeCloseTo((235 / 800) * PDF_LOGO_WIDTH);
    expect(weit.height).toBeLessThan(PDF_LOGO_HEIGHT);

    const hoch = fitPdfLogo(400, 258);
    expect(hoch.height).toBe(PDF_LOGO_HEIGHT);
    expect(hoch.width).toBeCloseTo((400 / 258) * PDF_LOGO_HEIGHT);
    expect(hoch.width).toBeLessThan(PDF_LOGO_WIDTH);
  });

  it("liest PNG-Maße und setzt die Box auf das sichtbare Logo", () => {
    const png = pngHeader(400, 258);
    expect(imageSizeFromBytes(png)).toEqual({ width: 400, height: 258 });
    const uri = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    const box = pdfLogoBoxFromDataUri(uri);
    expect(box.height).toBe(PDF_LOGO_HEIGHT);
    expect(box.width).toBeLessThan(PDF_LOGO_WIDTH);
  });

  it("liest JPEG- und WebP-Maße", () => {
    expect(imageSizeFromBytes(jpegSof(320, 180))).toEqual({
      width: 320,
      height: 180,
    });
    expect(imageSizeFromBytes(webpVp8x(640, 200))).toEqual({
      width: 640,
      height: 200,
    });
  });
});

function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  b[11] = 13;
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

function jpegSof(width: number, height: number): Uint8Array {
  const b = new Uint8Array(16);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08]);
  b[7] = (height >> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (width >> 8) & 0xff;
  b[10] = width & 0xff;
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46]);
  b[4] = 22;
  b.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8);
  b[16] = 10;
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return b;
}

describe("Logo-Upload", () => {
  it("akzeptiert PNG unter 2 MB", () => {
    expect(() =>
      assertLogoUpload({ size: 1024, type: "image/png" }),
    ).not.toThrow();
  });

  it("lehnt zu große oder fremde Typen ab", () => {
    expect(() =>
      assertLogoUpload({ size: 3 * 1024 * 1024, type: "image/png" }),
    ).toThrow(/2 MB/);
    expect(() =>
      assertLogoUpload({ size: 100, type: "application/pdf" }),
    ).toThrow(/PNG/);
  });

  it("errät MIME aus Dateiname", () => {
    expect(guessImageMime("logo.JPEG")).toBe("image/jpeg");
    expect(guessImageMime("x.webp", "image/webp")).toBe("image/webp");
  });
});

describe("Dokument-Schalter", () => {
  it("fehlt oder nicht false = an", () => {
    expect(dokumentSchalterWert(undefined)).toBe(true);
    expect(dokumentSchalterWert(null)).toBe(true);
    expect(dokumentSchalterWert(true)).toBe(true);
    expect(dokumentSchalterWert(false)).toBe(false);
  });

  it("liest Checkbox-Formwerte", () => {
    expect(parseDokumentSchalterForm("1")).toBe(true);
    expect(parseDokumentSchalterForm("on")).toBe(true);
    expect(parseDokumentSchalterForm(null)).toBe(false);
    expect(parseDokumentSchalterForm("")).toBe(false);
  });
});

describe("pickDokumentBankkonto", () => {
  it("nimmt das erste aktive Konto mit IBAN", () => {
    expect(
      pickDokumentBankkonto([
        { name: "Bar", iban: "", aktiv: true },
        {
          name: "Geschäftskonto",
          iban: "DE89 3704 0044 0532 0130 00",
          bic: "cola deff xxx",
          kontoinhaber: " Werkstatt Beispiel ",
          aktiv: true,
        },
        {
          name: "Zweitkonto",
          iban: "DE02120300000000202051",
          aktiv: true,
        },
      ]),
    ).toEqual({
      name: "Geschäftskonto",
      iban: "DE89370400440532013000",
      bic: "COLADEFFXXX",
      kontoinhaber: "Werkstatt Beispiel",
    });
  });

  it("überspringt inaktive und leere IBANs", () => {
    expect(
      pickDokumentBankkonto([
        {
          name: "Alt",
          iban: "DE89370400440532013000",
          aktiv: false,
        },
        { name: "Leer", iban: "   ", aktiv: true },
      ]),
    ).toBeUndefined();
  });
});

describe("Bankzeile und IBAN-Anzeige", () => {
  it("gruppiert die IBAN und lässt leere Felder weg", () => {
    expect(formatIbanAnzeige("DE89370400440532013000")).toBe(
      "DE89 3704 0044 0532 0130 00",
    );
    expect(
      footerBankzeile({
        name: "Geschäftskonto",
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
        kontoinhaber: "Werkstatt Beispiel",
      }),
    ).toBe(
      "Bank: Geschäftskonto  ·  Kontoinhaber: Werkstatt Beispiel  ·  IBAN: DE89 3704 0044 0532 0130 00  ·  BIC: COBADEFFXXX",
    );
    expect(footerBankzeile(undefined)).toBe("");
    expect(
      footerBankzeile({
        name: "",
        iban: "DE89370400440532013000",
        bic: "",
        kontoinhaber: "",
      }),
    ).toBe("IBAN: DE89 3704 0044 0532 0130 00");
  });
});

describe("Fußtext-Zeilen", () => {
  it("trimmt und verwirft Leerzeilen", () => {
    expect(
      footerTextZeilen(
        "Vielen Dank für Ihren Auftrag.\n\nFür Rückfragen stehe ich Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n\nAnton Titz\n",
      ),
    ).toEqual([
      "Vielen Dank für Ihren Auftrag.",
      "Für Rückfragen stehe ich Ihnen gerne zur Verfügung.",
      "Mit freundlichen Grüßen",
      "Anton Titz",
    ]);
    expect(footerTextZeilen("  \n\n  ")).toEqual([]);
  });
});

describe("Fuß-Stammdaten-Spalten", () => {
  const bank = {
    name: "Fyrst Bank",
    iban: "DE56390702100080446800",
    bic: "DEUTDEDKP09",
    kontoinhaber: "Toni Titz",
  };

  it("legt Firma, Bank und Steuer dreispaltig an, inkl. Tel., E-Mail und Web", () => {
    expect(
      footerStammdatenSpalten({
        firma: {
          name: "Toni Titz Haus & Gartenservice",
          telefon: "030 123456",
          email: "post@example.test",
          webseite: "https://www.titz.example/",
          steuernummer: "209/5143/4260",
          ust_id: "DE123456789",
        },
        bank,
      }),
    ).toEqual([
      {
        zeilen: [
          "Toni Titz Haus & Gartenservice",
          "Tel. 030 123456",
          "E-Mail post@example.test",
          "Web www.titz.example",
        ],
      },
      {
        zeilen: [
          "Fyrst Bank",
          "Kontoinhaber Toni Titz",
          "IBAN DE56 3907 0210 0080 4468 00",
          "BIC DEUTDEDKP09",
        ],
      },
      {
        zeilen: ["St.-Nr. 209/5143/4260", "USt-IdNr. DE123456789"],
      },
    ]);
  });

  it("lässt leeren Kontoinhaber in der Bankspalte weg", () => {
    expect(
      footerStammdatenSpalten({
        firma: { name: "Werkstatt Beispiel" },
        bank: {
          name: "Geschäftskonto",
          iban: "DE89370400440532013000",
          bic: "",
          kontoinhaber: "",
        },
      }),
    ).toEqual([
      { zeilen: ["Werkstatt Beispiel"] },
      {
        zeilen: ["Geschäftskonto", "IBAN DE89 3704 0044 0532 0130 00"],
      },
    ]);
  });

  it("lässt leere Spalten und Felder weg", () => {
    expect(
      footerStammdatenSpalten({
        firma: {
          name: "Werkstatt Beispiel",
          telefon: "  ",
          email: "",
          webseite: "   ",
        },
      }),
    ).toEqual([{ zeilen: ["Werkstatt Beispiel"] }]);
    expect(
      footerStammdatenSpalten({
        firma: { email: "post@example.test", steuernummer: "11/222/33333" },
      }),
    ).toEqual([
      { zeilen: ["E-Mail post@example.test"] },
      { zeilen: ["St.-Nr. 11/222/33333"] },
    ]);
    expect(
      footerStammdatenSpalten({
        firma: {
          name: "Werkstatt Beispiel",
          webseite: "https://www.werkstatt.example/",
        },
      }),
    ).toEqual([
      {
        zeilen: ["Werkstatt Beispiel", "Web www.werkstatt.example"],
      },
    ]);
  });
});

describe("Webseite in der Fußzeile", () => {
  it("entfernt Protokoll und trailing Slash", () => {
    expect(formatWebseiteAnzeige("https://www.beispiel.de/")).toBe(
      "www.beispiel.de",
    );
    expect(formatWebseiteAnzeige("http://beispiel.de")).toBe("beispiel.de");
    expect(formatWebseiteAnzeige("www.beispiel.de")).toBe("www.beispiel.de");
    expect(formatWebseiteAnzeige("  ")).toBe("");
  });
});

describe("dokumentTitel und Daten", () => {
  it("setzt Entwurf ohne Nummer und Original mit Nummer", () => {
    expect(
      dokumentTitel({ art: "rechnung", entwurf: true, nummer: "R-0001" }),
    ).toBe("Rechnung (Entwurf)");
    expect(
      dokumentTitel({ art: "rechnung", entwurf: false, nummer: "R-0001" }),
    ).toBe("Rechnung Nr. R-0001");
    expect(
      dokumentTitel({ art: "angebot", entwurf: false, nummer: "A-0002" }),
    ).toBe("Angebot Nr. A-0002");
  });

  it("formatiert Datum und Leistungszeitraum de-DE", () => {
    expect(formatPdfDateDe("2026-08-16")).toBe("16.08.2026");
    expect(formatLeistungszeitraum("2026-08-16", "2026-08-16")).toBe(
      "16.08.2026",
    );
    expect(formatLeistungszeitraum("2026-08-01", "2026-08-16")).toBe(
      "01.08.2026 – 16.08.2026",
    );
    expect(formatLeistungszeitraum("", "")).toBe("");
  });
});

describe("zahlungshinweisRechnung", () => {
  it("nennt Betrag, Fälligkeit und Bank, im Entwurf ohne Kreisnummer", () => {
    const text = zahlungshinweisRechnung({
      betrag: "3105.90",
      faelligAm: "2026-08-30",
      entwurf: false,
      hatBank: true,
    });
    expect(text).toContain("3.105,90");
    expect(text).toContain("30.08.2026");
    expect(text).toContain("Rechnungsnummer");
    expect(text).toContain("Bankkonto");
    expect(text).not.toContain("späteren");
    expect(
      zahlungshinweisRechnung({
        betrag: "10.00",
        entwurf: true,
        hatBank: false,
      }),
    ).toMatch(/späteren Rechnungsnummer/);
  });
});

describe("kontrastTextAuf", () => {
  it("wählt weiße Schrift auf dunklem Akzent", () => {
    expect(kontrastTextAuf("#0055FF")).toBe("#FFFFFF");
    expect(kontrastTextAuf("#F5F5F5")).toBe("#111111");
  });
});
