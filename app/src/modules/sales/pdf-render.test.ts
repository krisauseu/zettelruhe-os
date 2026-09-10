import { describe, expect, it } from "vitest";
import type { FirmaRecord } from "@/lib/pb";
import type { Kontakt } from "@/modules/contacts/types";
import { DEFAULT_NUMMERNKREISE } from "@/lib/pb";
import { renderAngebotPdf, renderRechnungPdf } from "./pdf";
import { defaultDokumentPdfLayout } from "./pdf-layout";
import type { Angebot, Rechnung, Rechnungsposition } from "./types";

const firma = (over: Partial<FirmaRecord> = {}): FirmaRecord => ({
  id: "f1",
  name: "Werkstatt Beispiel",
  steuermodus: "kleinunternehmer",
  skr: "skr03",
  nummernkreise: DEFAULT_NUMMERNKREISE,
  strasse: "Werkstatt 3",
  plz: "10115",
  ort: "Berlin",
  land: "DE",
  steuernummer: "11/222/33333",
  ust_id: "",
  email: "post@example.test",
  telefon: "",
  logo: "",
  ...over,
});

const kunde: Kontakt = {
  id: "k1",
  firma: "f1",
  name: "Acme Software Solutions GmbH",
  kontaktnummer: "KT-0001",
  ist_kunde: true,
  ist_lieferant: false,
  strasse: "Innovationspark 12",
  plz: "80331",
  ort: "München",
  land: "DE",
  email: "",
  telefon: "",
  iban: "",
  bic: "",
  ust_id: "",
  leitweg_id: "",
  notiz: "",
};

const position: Rechnungsposition = {
  id: "p1",
  firma: "f1",
  rechnung: "r1",
  sortierung: 1,
  bezeichnung: "Beratung",
  menge: "2.00",
  einheit: "Std",
  einzelpreis: "95.00",
  steuersatz: "19",
  betrag_netto: "190.00",
  betrag_ust: "36.10",
  betrag_brutto: "226.10",
  katalog_position: null,
};

function rechnung(over: Partial<Rechnung> = {}): Rechnung {
  return {
    id: "r1",
    firma: "f1",
    kunde: "k1",
    rechnungsdatum: "2026-08-16",
    leistungszeitraum_von: "2026-08-16",
    leistungszeitraum_bis: "2026-08-16",
    faellig_am: "2026-08-30",
    notiz: "",
    status: "entwurf",
    rechnungsnummer: "",
    betrag_netto: "190.00",
    betrag_ust: "0.00",
    betrag_brutto: "190.00",
    steuermodus: "kleinunternehmer",
    pdf: "",
    journal_eintrag: null,
    festgeschrieben_am: "",
    ...over,
  };
}

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("PDF-Render", () => {
  it("erzeugt Entwurfs-Rechnung unter Kleinunternehmerregelung", async () => {
    const buf = await renderRechnungPdf({
      rechnung: rechnung(),
      positionen: [{ ...position, steuersatz: "", betrag_ust: "0.00" }],
      firma: firma(),
      kunde,
      entwurf: true,
      layout: {
        ...defaultDokumentPdfLayout(),
        kopftext: "Vielen Dank für Ihren Auftrag.",
        bank: {
          name: "Geschäftskonto",
          iban: "DE89370400440532013000",
          bic: "COBADEFFXXX",
          kontoinhaber: "Werkstatt Beispiel",
        },
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(800);
  });

  it("erzeugt Original-Rechnung mit gemischten Steuersätzen", async () => {
    const buf = await renderRechnungPdf({
      rechnung: rechnung({
        status: "offen",
        rechnungsnummer: "R-0002",
        steuermodus: "regelbesteuerung_ist",
        betrag_netto: "393.00",
        betrag_ust: "65.37",
        betrag_brutto: "458.37",
      }),
      positionen: [
        { ...position, betrag_netto: "333.00", betrag_ust: "63.27", betrag_brutto: "396.27" },
        {
          ...position,
          id: "p2",
          sortierung: 2,
          bezeichnung: "Testartikel 7%",
          einzelpreis: "30.00",
          steuersatz: "7",
          betrag_netto: "30.00",
          betrag_ust: "2.10",
          betrag_brutto: "32.10",
        },
        {
          ...position,
          id: "p3",
          sortierung: 3,
          bezeichnung: "Gebühren 0%",
          einzelpreis: "30.00",
          steuersatz: "0",
          betrag_netto: "30.00",
          betrag_ust: "0.00",
          betrag_brutto: "30.00",
        },
      ],
      firma: firma({
        steuermodus: "regelbesteuerung_ist",
        ust_id: "DE123456789",
      }),
      kunde,
      rechnungsnummer: "R-0002",
      entwurf: false,
      layout: defaultDokumentPdfLayout(),
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("erzeugt Original-Rechnung unter Regelbesteuerung mit GiroCode", async () => {
    const buf = await renderRechnungPdf({
      rechnung: rechnung({
        status: "offen",
        rechnungsnummer: "R-0001",
        steuermodus: "regelbesteuerung_ist",
        betrag_ust: "36.10",
        betrag_brutto: "226.10",
      }),
      positionen: [position],
      firma: firma({
        steuermodus: "regelbesteuerung_ist",
        ust_id: "DE123456789",
      }),
      kunde,
      rechnungsnummer: "R-0001",
      entwurf: false,
      layout: {
        ...defaultDokumentPdfLayout(),
        akzentfarbe: "#0055FF",
        bank: {
          name: "Geschäftskonto",
          iban: "DE89370400440532013000",
          bic: "COBADEFFXXX",
          kontoinhaber: "Werkstatt Beispiel",
        },
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1500);
  });

  it("nimmt ein Firmenlogo in die Rechnung auf", async () => {
    const buf = await renderRechnungPdf({
      rechnung: rechnung(),
      positionen: [{ ...position, steuersatz: "", betrag_ust: "0.00" }],
      firma: firma(),
      kunde,
      entwurf: true,
      layout: {
        ...defaultDokumentPdfLayout(),
        logoDataUri: TINY_PNG,
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(900);
  });

  it("setzt Fußtext, Bank und Firmen-Kontakt in die Rechnung", async () => {
    const buf = await renderRechnungPdf({
      rechnung: rechnung(),
      positionen: [{ ...position, steuersatz: "", betrag_ust: "0.00" }],
      firma: firma({
        telefon: "030 123456",
        email: "post@example.test",
        webseite: "https://www.werkstatt.example",
        steuernummer: "11/222/33333",
      }),
      kunde,
      entwurf: true,
      layout: {
        ...defaultDokumentPdfLayout(),
        fusstext:
          "Vielen Dank für Ihren Auftrag.\n\nMit freundlichen Grüßen\nAnton Titz",
        bank: {
          name: "Fyrst Bank",
          iban: "DE56390702100080446800",
          bic: "DEUTDEDKP09",
          kontoinhaber: "Anton Titz",
        },
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(800);
  });

  it("erzeugt Angebots-PDF ohne Zahlblock", async () => {
    const angebot: Angebot = {
      id: "a1",
      firma: "f1",
      kunde: "k1",
      angebotsdatum: "2026-08-16",
      gueltig_bis: "2026-09-16",
      notiz: "",
      status: "gesendet",
      angebotsnummer: "A-0001",
      betrag_netto: "190.00",
      betrag_ust: "0.00",
      betrag_brutto: "190.00",
      steuermodus: "kleinunternehmer",
      pdf: "",
      gesendet_am: "2026-08-16T10:00:00Z",
      rechnung: null,
    };
    const buf = await renderAngebotPdf({
      angebot,
      positionen: [
        {
          id: "ap1",
          firma: "f1",
          angebot: "a1",
          sortierung: 1,
          bezeichnung: "Beratung",
          menge: "2.00",
          einheit: "Std",
          einzelpreis: "95.00",
          steuersatz: "",
          betrag_netto: "190.00",
          betrag_ust: "0.00",
          betrag_brutto: "190.00",
          katalog_position: null,
        },
      ],
      firma: firma({
        email: "post@example.test",
        webseite: "https://www.werkstatt.example/",
      }),
      kunde,
      angebotsnummer: "A-0001",
      entwurf: false,
      layout: {
        ...defaultDokumentPdfLayout(),
        fusstext: "Vielen Dank für Ihre Anfrage.\nMit freundlichen Grüßen",
        bank: {
          name: "Geschäftskonto",
          iban: "DE89370400440532013000",
          bic: "COBADEFFXXX",
          kontoinhaber: "Werkstatt Beispiel",
        },
      },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
