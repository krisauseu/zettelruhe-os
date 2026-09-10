import { describe, expect, it } from "vitest";
import type { FirmaRecord } from "@/lib/pb";
import type { Kontakt } from "@/modules/contacts/types";
import { KLEINUNTERNEHMER_HINWEIS } from "@/modules/sales/invariants";
import type { Rechnung, Rechnungsposition } from "@/modules/sales/types";
import {
  buildEInvoiceOutbound,
  mapEinheitToUnece,
  parseSendProfil,
} from "./outbound";
import { parseEInvoiceXml } from "./parse";
import { renderZugferdCii } from "./render-cii";
import { renderXRechnungUbl } from "./render-ubl";
import {
  VERSAND_BEREITS_ERROR,
  VERSAND_NUR_FESTGESCHRIEBEN_ERROR,
  assertCanErzeugenVersand,
  renderEInvoiceXml,
  versandDateiname,
} from "./send-invariants";
import { validateEInvoiceOutbound } from "./validate-outbound";

function firma(over: Partial<FirmaRecord> = {}): FirmaRecord {
  return {
    id: "f1",
    name: "Zettelruhe Solo",
    steuermodus: "regelbesteuerung_ist",
    skr: "skr03",
    nummernkreise: {
      angebot: { prefix: "A-", digits: 4, next: 1 },
      rechnung: { prefix: "R-", digits: 4, next: 1 },
      gutschrift: { prefix: "G-", digits: 4, next: 1 },
      beleg: { prefix: "B-", digits: 4, next: 1 },
      kasse: { prefix: "K-", digits: 4, next: 1 },
      kontakt: { prefix: "KT-", digits: 4, next: 1 },
    },
    strasse: "Werkstatt 3",
    plz: "10115",
    ort: "Berlin",
    land: "DE",
    steuernummer: "11/222/33333",
    ust_id: "DE123456789",
    email: "rechnung@zettelruhe.test",
    telefon: "+49 30 111",
    logo: "",
    dokument_akzentfarbe: "",
    dokument_kopftext: "",
    dokument_fusstext: "",
    ...over,
  };
}

function kunde(over: Partial<Kontakt> = {}): Kontakt {
  return {
    id: "k1",
    firma: "f1",
    name: "Beispiel GmbH",
    kontaktnummer: "KT-0001",
    ist_kunde: true,
    ist_lieferant: false,
    strasse: "Kundenweg 8",
    plz: "80331",
    ort: "München",
    land: "DE",
    email: "einkauf@beispiel.test",
    telefon: "",
    iban: "",
    bic: "",
    ust_id: "DE987654321",
    leitweg_id: "99-TEST-0000-00",
    notiz: "",
    ...over,
  };
}

function rechnung(over: Partial<Rechnung> = {}): Rechnung {
  return {
    id: "r1",
    firma: "f1",
    kunde: "k1",
    rechnungsdatum: "2026-08-15",
    leistungszeitraum_von: "2026-08-01",
    leistungszeitraum_bis: "2026-08-15",
    faellig_am: "2026-08-29",
    notiz: "",
    status: "offen",
    rechnungsnummer: "R-0008",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuermodus: "regelbesteuerung_ist",
    pdf: "R-0008.pdf",
    journal_eintrag: "j1",
    festgeschrieben_am: "2026-08-15T10:00:00.000Z",
    ...over,
  };
}

function pos(over: Partial<Rechnungsposition> = {}): Rechnungsposition {
  return {
    id: "p1",
    firma: "f1",
    rechnung: "r1",
    sortierung: 1,
    bezeichnung: "Beratung August",
    menge: "2",
    einheit: "Stunde",
    einzelpreis: "50.00",
    steuersatz: "19",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    katalog_position: null,
    ...over,
  };
}

const bank = {
  name: "Geschäftskonto",
  iban: "DE89370400440532013000",
  bic: "COBADEFFXXX",
  kontoinhaber: "",
};

describe("mapEinheitToUnece", () => {
  it("mappt Katalog-Einheiten", () => {
    expect(mapEinheitToUnece("Std.").code).toBe("HUR");
    expect(mapEinheitToUnece("Stunde").code).toBe("HUR");
    expect(mapEinheitToUnece("Stück").code).toBe("C62");
    expect(mapEinheitToUnece("Karton").code).toBe("CT");
    expect(mapEinheitToUnece("unbekannt").code).toBe("C62");
  });
});

describe("parseSendProfil", () => {
  it("akzeptiert nur die zwei XML-Profile", () => {
    expect(parseSendProfil("xrechnung_ubl")).toBe("xrechnung_ubl");
    expect(parseSendProfil("zugferd_cii")).toBe("zugferd_cii");
    expect(parseSendProfil("zugferd_pdf")).toBe("");
  });
});

describe("Kontoinhaber im Versand-DTO", () => {
  it("nimmt den Kontoinhaber vom Bankkonto, sonst den Firmennamen", () => {
    expect(
      buildEInvoiceOutbound({
        profil: "xrechnung_ubl",
        rechnung: rechnung(),
        positionen: [pos()],
        firma: firma(),
        kunde: kunde(),
        bankkonto: { ...bank, kontoinhaber: "Werkstatt Beispiel GmbH" },
      }).kontoinhaber,
    ).toBe("Werkstatt Beispiel GmbH");
    expect(
      buildEInvoiceOutbound({
        profil: "xrechnung_ubl",
        rechnung: rechnung(),
        positionen: [pos()],
        firma: firma(),
        kunde: kunde(),
        bankkonto: bank,
      }).kontoinhaber,
    ).toBe("Zettelruhe Solo");
  });
});

describe("validateEInvoiceOutbound", () => {
  it("ist ok bei vollständigen Stammdaten (XRechnung)", () => {
    const draft = buildEInvoiceOutbound({
      profil: "xrechnung_ubl",
      rechnung: rechnung(),
      positionen: [pos()],
      firma: firma(),
      kunde: kunde(),
      bankkonto: bank,
    });
    expect(validateEInvoiceOutbound(draft, { rechnung: rechnung(), erzeugen: true })).toEqual(
      [],
    );
  });

  it("listet fehlende Pflichtfelder auf Deutsch", () => {
    const draft = buildEInvoiceOutbound({
      profil: "xrechnung_ubl",
      rechnung: rechnung({ status: "entwurf", rechnungsnummer: "", pdf: "" }),
      positionen: [pos()],
      firma: firma({
        strasse: "",
        plz: "",
        ort: "",
        email: "",
        ust_id: "",
        steuernummer: "",
      }),
      kunde: kunde({
        strasse: "",
        plz: "",
        ort: "",
        email: "",
        leitweg_id: "",
      }),
      bankkonto: null,
    });
    const issues = validateEInvoiceOutbound(draft, {
      rechnung: rechnung({ status: "entwurf", rechnungsnummer: "" }),
      erzeugen: true,
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("RECHNUNG_ENTWURF");
    expect(codes).toContain("FIRMA_ANSCHRIFT");
    expect(codes).toContain("FIRMA_STEUER");
    expect(codes).toContain("FIRMA_EMAIL");
    expect(codes).toContain("KUNDE_LEITWEG");
    expect(codes).toContain("KUNDE_EMAIL");
    expect(codes).toContain("KUNDE_ANSCHRIFT");
    expect(codes).toContain("BANK_IBAN");
    expect(issues.every((i) => i.message.length > 8)).toBe(true);
  });

  it("verlangt Leitweg und E-Mail nicht für ZUGFeRD-CII", () => {
    const draft = buildEInvoiceOutbound({
      profil: "zugferd_cii",
      rechnung: rechnung(),
      positionen: [pos()],
      firma: firma({ email: "" }),
      kunde: kunde({ email: "", leitweg_id: "" }),
      bankkonto: bank,
    });
    const issues = validateEInvoiceOutbound(draft, {
      rechnung: rechnung(),
      erzeugen: true,
    });
    expect(issues.map((i) => i.code)).not.toContain("KUNDE_LEITWEG");
    expect(issues.map((i) => i.code)).not.toContain("FIRMA_EMAIL");
    expect(issues.map((i) => i.code)).not.toContain("KUNDE_EMAIL");
  });

  it("lehnt USt-Ausweis unter Kleinunternehmerregelung ab", () => {
    const r = rechnung({
      steuermodus: "kleinunternehmer",
      betrag_netto: "100.00",
      betrag_ust: "19.00",
      betrag_brutto: "119.00",
    });
    const draft = buildEInvoiceOutbound({
      profil: "zugferd_cii",
      rechnung: r,
      positionen: [pos()],
      firma: firma({ steuermodus: "kleinunternehmer" }),
      kunde: kunde(),
      bankkonto: bank,
    });
    const issues = validateEInvoiceOutbound(draft, { rechnung: r, erzeugen: true });
    expect(issues.some((i) => i.code === "STEUER_KLEINUNTERNEHMER")).toBe(true);
  });
});

describe("Kleinunternehmerregelung", () => {
  it("setzt Kategorie E, 0 % und gesetzlichen Hinweis — keine USt-Zeile", () => {
    const r = rechnung({
      steuermodus: "kleinunternehmer",
      betrag_netto: "100.00",
      betrag_ust: "0.00",
      betrag_brutto: "100.00",
    });
    const p = pos({
      steuersatz: "",
      betrag_netto: "100.00",
      betrag_ust: "0.00",
      betrag_brutto: "100.00",
    });
    const draft = buildEInvoiceOutbound({
      profil: "xrechnung_ubl",
      rechnung: r,
      positionen: [p],
      firma: firma({ steuermodus: "kleinunternehmer", ust_id: "" }),
      kunde: kunde(),
      bankkonto: bank,
    });
    expect(draft.hinweis).toBe(KLEINUNTERNEHMER_HINWEIS);
    expect(draft.betrag_ust).toBe("0.00");
    expect(draft.betrag_netto).toBe("100.00");
    expect(draft.positionen[0].tax_category).toBe("E");
    expect(draft.positionen[0].steuersatz).toBe("0");
    expect(draft.tax_subtotals).toHaveLength(1);
    expect(draft.tax_subtotals[0].category).toBe("E");
    expect(draft.tax_subtotals[0].tax).toBe("0.00");
    expect(validateEInvoiceOutbound(draft, { rechnung: r, erzeugen: true })).toEqual(
      [],
    );

    const xml = renderXRechnungUbl(draft);
    expect(xml).toContain(KLEINUNTERNEHMER_HINWEIS);
    expect(xml).not.toMatch(/<cbc:Percent>19/);
    expect(xml).toContain("<cbc:ID>E</cbc:ID>");
  });
});

describe("Regelbesteuerung UBL + CII", () => {
  it("weist 19 % aus und rundet über den Parser zurück", () => {
    const draft = buildEInvoiceOutbound({
      profil: "xrechnung_ubl",
      rechnung: rechnung(),
      positionen: [pos()],
      firma: firma(),
      kunde: kunde(),
      bankkonto: bank,
    });
    const ubl = renderXRechnungUbl(draft);
    expect(ubl).toContain("xrechnung_3.0");
    expect(ubl).toContain("R-0008");
    expect(ubl).toContain("DE123456789");
    expect(ubl).toContain("99-TEST-0000-00");
    expect(ubl).toContain('unitCode="HUR"');
    expect(ubl).toContain("<cbc:Percent>19.00</cbc:Percent>");

    const parsed = parseEInvoiceXml(ubl);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.format).toBe("xrechnung_ubl");
    expect(parsed.data.rechnungsnummer).toBe("R-0008");
    expect(parsed.data.rechnungsdatum).toBe("2026-08-15");
    expect(parsed.data.betrag_netto).toBe("100.00");
    expect(parsed.data.betrag_ust).toBe("19.00");
    expect(parsed.data.betrag_brutto).toBe("119.00");
    expect(parsed.data.lieferant.name).toBe("Zettelruhe Solo");
  });

  it("erzeugt CII EN-16931 und parst es als zugferd_cii", () => {
    const draft = buildEInvoiceOutbound({
      profil: "zugferd_cii",
      rechnung: rechnung(),
      positionen: [pos()],
      firma: firma(),
      kunde: kunde(),
      bankkonto: bank,
    });
    const cii = renderZugferdCii(draft);
    expect(cii).toContain("factur-x.eu:1p0:en16931");
    expect(cii).toContain("CrossIndustryInvoice");
    expect(cii).not.toContain("pdf");

    const parsed = parseEInvoiceXml(cii);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.format).toBe("zugferd_cii");
    expect(parsed.data.rechnungsnummer).toBe("R-0008");
    expect(parsed.data.betrag_brutto).toBe("119.00");
    expect(parsed.data.lieferant.ust_id).toBe("DE123456789");
  });

  it("rät 0-%-Zeilen nicht als Reverse Charge", () => {
    const r = rechnung({
      betrag_netto: "100.00",
      betrag_ust: "0.00",
      betrag_brutto: "100.00",
    });
    const draft = buildEInvoiceOutbound({
      profil: "zugferd_cii",
      rechnung: r,
      positionen: [
        pos({
          steuersatz: "0",
          betrag_netto: "100.00",
          betrag_ust: "0.00",
          betrag_brutto: "100.00",
        }),
      ],
      firma: firma(),
      kunde: kunde(),
      bankkonto: bank,
    });
    expect(draft.positionen[0].tax_category).toBe("E");
    expect(draft.positionen[0].tax_exemption_reason).toMatch(/nicht automatisch/);
    expect(validateEInvoiceOutbound(draft, { rechnung: r, erzeugen: true })).toEqual(
      [],
    );
  });
});

describe("send-invariants", () => {
  it("blockiert Entwurf und Doppel-Erzeugung desselben Profils", () => {
    expect(() =>
      assertCanErzeugenVersand({ status: "entwurf", rechnungsnummer: "" }, false),
    ).toThrow(VERSAND_NUR_FESTGESCHRIEBEN_ERROR);
    expect(() =>
      assertCanErzeugenVersand({ status: "offen", rechnungsnummer: "R-1" }, true),
    ).toThrow(VERSAND_BEREITS_ERROR);
  });

  it("benennt Dateien nach Nummer und Profil", () => {
    expect(versandDateiname("R-0008", "xrechnung_ubl")).toBe(
      "R-0008-xrechnung.xml",
    );
    expect(versandDateiname("R-0008", "zugferd_cii")).toBe("R-0008-zugferd.xml");
  });

  it("renderEInvoiceXml wählt den Adapter nach Profil", () => {
    const ubl = renderEInvoiceXml(
      buildEInvoiceOutbound({
        profil: "xrechnung_ubl",
        rechnung: rechnung(),
        positionen: [pos()],
        firma: firma(),
        kunde: kunde(),
        bankkonto: bank,
      }),
    );
    const cii = renderEInvoiceXml(
      buildEInvoiceOutbound({
        profil: "zugferd_cii",
        rechnung: rechnung(),
        positionen: [pos()],
        firma: firma(),
        kunde: kunde(),
        bankkonto: bank,
      }),
    );
    expect(ubl).toContain("<Invoice");
    expect(cii).toContain("CrossIndustryInvoice");
  });
});
