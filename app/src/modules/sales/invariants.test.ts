import { describe, expect, it } from "vitest";
import {
  assertCanFestschreiben,
  assertCanPreviewRechnungPdf,
  assertCanServeOriginalRechnungPdf,
  assertCanStornierenRechnung,
  assertRechnungVorschauNurEntwurf,
  assertEntwurfEditable,
  assertEntwurfOhneNummer,
  buildJournalInputFromRechnung,
  calculatePositionBetraege,
  einheitlicherSteuersatz,
  ustStaffelAusPositionen,
  defaultFaelligAm,
  FESTGESCHRIEBEN_ERROR,
  isEntwurf,
  isFestgeschrieben,
  KLEINUNTERNEHMER_HINWEIS,
  PDF_IMMUTABLE_ERROR,
  PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR,
  PDF_VORSCHAU_NUR_ENTWURF_ERROR,
  RECHNUNG_STORNO_BEREITS_ERROR,
  RECHNUNG_STORNO_ENTWURF_ERROR,
  sumPositionen,
  validateRechnungInput,
} from "./invariants";
import type { Rechnung, Rechnungsposition } from "./types";

function sampleRechnung(over: Partial<Rechnung> = {}): Rechnung {
  return {
    id: "r1",
    firma: "f1",
    kunde: "k1",
    rechnungsdatum: "2026-08-11",
    leistungszeitraum_von: "",
    leistungszeitraum_bis: "",
    faellig_am: "2026-08-25",
    notiz: "",
    status: "entwurf",
    rechnungsnummer: "",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuermodus: "regelbesteuerung_ist",
    pdf: "",
    journal_eintrag: null,
    festgeschrieben_am: "",
    ...over,
  };
}

function samplePos(over: Partial<Rechnungsposition> = {}): Rechnungsposition {
  return {
    id: "p1",
    firma: "f1",
    rechnung: "r1",
    sortierung: 0,
    bezeichnung: "Beratung",
    menge: "2",
    einheit: "h",
    einzelpreis: "50.00",
    steuersatz: "19",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    katalog_position: null,
    ...over,
  };
}

describe("calculatePositionBetraege", () => {
  it("berechnet Netto/USt/Brutto unter Regelbesteuerung", () => {
    const v = calculatePositionBetraege(
      { menge: "2", einzelpreis: "50,00", steuersatz: "19" },
      "regelbesteuerung_ist",
    );
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("19.00");
    expect(v.betrag_brutto).toBe("119.00");
    expect(v.steuersatz).toBe("19");
  });

  it("setzt USt unter Kleinunternehmerregelung auf 0", () => {
    const v = calculatePositionBetraege(
      { menge: "1", einzelpreis: "100", steuersatz: "19" },
      "kleinunternehmer",
    );
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("0.00");
    expect(v.betrag_brutto).toBe("100.00");
    expect(v.steuersatz).toBe("");
  });

  it("lehnt Menge ≤ 0 ab", () => {
    expect(() =>
      calculatePositionBetraege(
        { menge: "0", einzelpreis: "10" },
        "kleinunternehmer",
      ),
    ).toThrow(/Menge/);
  });
});

describe("sumPositionen", () => {
  it("summiert Zeilen", () => {
    const s = sumPositionen([
      {
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        betrag_brutto: "119.00",
      },
      {
        betrag_netto: "50.00",
        betrag_ust: "9.50",
        betrag_brutto: "59.50",
      },
    ]);
    expect(s.betrag_netto).toBe("150.00");
    expect(s.betrag_ust).toBe("28.50");
    expect(s.betrag_brutto).toBe("178.50");
  });
});

describe("validateRechnungInput", () => {
  it("validiert Kopf + Positionen und summiert", () => {
    const v = validateRechnungInput(
      {
        kunde: "k1",
        rechnungsdatum: "2026-08-11",
        positionen: [
          {
            bezeichnung: "Arbeit",
            menge: "1",
            einzelpreis: "200,00",
            steuersatz: "19",
          },
        ],
      },
      "regelbesteuerung_ist",
    );
    expect(v.betrag_brutto).toBe("238.00");
    expect(v.positionen).toHaveLength(1);
  });

  it("verwendet 1-basierte sortierung (PB required number: 0 = blank)", () => {
    const v = validateRechnungInput(
      {
        rechnungsdatum: "2026-08-11",
        positionen: [
          { bezeichnung: "A", menge: "1", einzelpreis: "10" },
          { bezeichnung: "B", menge: "1", einzelpreis: "20" },
        ],
      },
      "kleinunternehmer",
    );
    expect(v.positionen.map((p) => p.sortierung)).toEqual([1, 2]);
  });

  it("lehnt Rechnung ohne Position ab", () => {
    expect(() =>
      validateRechnungInput(
        { rechnungsdatum: "2026-08-11", positionen: [] },
        "kleinunternehmer",
      ),
    ).toThrow(/Position/);
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateRechnungInput(
        {
          rechnungsdatum: "11.08.2026",
          positionen: [
            { bezeichnung: "X", menge: "1", einzelpreis: "10" },
          ],
        },
        "kleinunternehmer",
      ),
    ).toThrow(/Rechnungsdatum/);
  });
});

describe("Entwurf vs. Festschreibung", () => {
  it("erkennt Status (alle nicht-entwurf = festgeschrieben)", () => {
    expect(isEntwurf(sampleRechnung())).toBe(true);
    expect(isFestgeschrieben(sampleRechnung({ status: "offen" }))).toBe(true);
    expect(
      isFestgeschrieben(sampleRechnung({ status: "teilbezahlt" })),
    ).toBe(true);
    expect(isFestgeschrieben(sampleRechnung({ status: "bezahlt" }))).toBe(
      true,
    );
    expect(
      isFestgeschrieben(sampleRechnung({ status: "ueberfaellig" })),
    ).toBe(true);
  });

  it("blockiert Edit nach Festschreibung", () => {
    expect(() =>
      assertEntwurfEditable(sampleRechnung({ status: "offen" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
    expect(() =>
      assertEntwurfEditable(sampleRechnung({ status: "bezahlt" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
  });

  it("Entwurf ohne Rechnungsnummer", () => {
    expect(() =>
      assertEntwurfOhneNummer(sampleRechnung({ rechnungsnummer: "" })),
    ).not.toThrow();
    expect(() =>
      assertEntwurfOhneNummer(
        sampleRechnung({ status: "entwurf", rechnungsnummer: "R-0001" }),
      ),
    ).toThrow(/keine Rechnungsnummer/);
  });

  it("erlaubt Festschreiben nur für Entwurf mit Kund:in und Positionen", () => {
    expect(() =>
      assertCanFestschreiben(sampleRechnung(), [samplePos()]),
    ).not.toThrow();

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ status: "offen" }), [
        samplePos(),
      ]),
    ).toThrow(/Nur Entwürfe/);

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ kunde: null }), [samplePos()]),
    ).toThrow(/Kund:in/);

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ rechnungsnummer: "R-1" }), [
        samplePos(),
      ]),
    ).toThrow(/Rechnungsnummer/);

    expect(() => assertCanFestschreiben(sampleRechnung(), [])).toThrow(
      /Position/,
    );
  });
});

describe("assertCanStornierenRechnung", () => {
  it("erlaubt festgeschriebene Status", () => {
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "offen" })),
    ).not.toThrow();
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "bezahlt" })),
    ).not.toThrow();
  });

  it("lehnt Entwurf und bereits Storniertes ab", () => {
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "entwurf" })),
    ).toThrow(RECHNUNG_STORNO_ENTWURF_ERROR);
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "storniert" })),
    ).toThrow(RECHNUNG_STORNO_BEREITS_ERROR);
  });
});

describe("einheitlicherSteuersatz", () => {
  it("nimmt den gemeinsamen Satz unter Regelbesteuerung", () => {
    expect(
      einheitlicherSteuersatz(
        [{ steuersatz: "19" }, { steuersatz: "19" }],
        "regelbesteuerung_ist",
      ),
    ).toBe("19");
    expect(
      einheitlicherSteuersatz([{ steuersatz: "7" }], "regelbesteuerung_ist"),
    ).toBe("7");
    expect(
      einheitlicherSteuersatz([{ steuersatz: "0" }], "regelbesteuerung_ist"),
    ).toBe("0");
  });

  it("bleibt leer bei gemischten Sätzen, fehlenden Positionen oder Kleinunternehmerregelung", () => {
    expect(
      einheitlicherSteuersatz(
        [{ steuersatz: "19" }, { steuersatz: "7" }],
        "regelbesteuerung_ist",
      ),
    ).toBe("");
    expect(
      einheitlicherSteuersatz(
        [{ steuersatz: "19" }, { steuersatz: "" }],
        "regelbesteuerung_ist",
      ),
    ).toBe("");
    expect(einheitlicherSteuersatz([], "regelbesteuerung_ist")).toBe("");
    expect(
      einheitlicherSteuersatz([{ steuersatz: "19" }], "kleinunternehmer"),
    ).toBe("");
  });
});

describe("ustStaffelAusPositionen", () => {
  it("bündelt Bemessungsgrundlage und Steuerbetrag je Satz", () => {
    expect(
      ustStaffelAusPositionen([
        { steuersatz: "19", betrag_netto: "333.00", betrag_ust: "63.27" },
        { steuersatz: "7", betrag_netto: "30.00", betrag_ust: "2.10" },
        { steuersatz: "0", betrag_netto: "30.00", betrag_ust: "0.00" },
      ]),
    ).toEqual([
      { steuersatz: "19", betrag_netto: "333.00", betrag_ust: "63.27" },
      { steuersatz: "7", betrag_netto: "30.00", betrag_ust: "2.10" },
      { steuersatz: "0", betrag_netto: "30.00", betrag_ust: "0.00" },
    ]);
  });

  it("summiert gleiche Sätze und sortiert 19 vor 7 vor 0", () => {
    expect(
      ustStaffelAusPositionen([
        { steuersatz: "7", betrag_netto: "10.00", betrag_ust: "0.70" },
        { steuersatz: "19", betrag_netto: "100.00", betrag_ust: "19.00" },
        { steuersatz: "19", betrag_netto: "50.00", betrag_ust: "9.50" },
      ]),
    ).toEqual([
      { steuersatz: "19", betrag_netto: "150.00", betrag_ust: "28.50" },
      { steuersatz: "7", betrag_netto: "10.00", betrag_ust: "0.70" },
    ]);
  });
});

describe("buildJournalInputFromRechnung", () => {
  it("setzt quelle_typ=rechnung und Richtung Einnahme", () => {
    const j = buildJournalInputFromRechnung(sampleRechnung(), {
      rechnungId: "r1",
      rechnungsnummer: "R-0001",
      kundeName: "Muster GmbH",
      positionen: [samplePos()],
    });
    expect(j.quelle_typ).toBe("rechnung");
    expect(j.quelle_id).toBe("r1");
    expect(j.richtung).toBe("einnahme");
    expect(j.betrag_brutto).toBe("119.00");
    expect(j.steuersatz).toBe("19");
    expect(j.buchungstext).toMatch(/R-0001/);
    expect(j.buchungstext).toMatch(/Muster/);
  });

  it("schreibt keinen Satz bei gemischten Positionen", () => {
    const j = buildJournalInputFromRechnung(sampleRechnung(), {
      rechnungId: "r1",
      rechnungsnummer: "R-0002",
      positionen: [
        samplePos({ steuersatz: "19" }),
        samplePos({ id: "p2", steuersatz: "7" }),
      ],
    });
    expect(j.steuersatz).toBe("");
    expect(j.betrag_ust).toBe("19.00");
  });

  it("schreibt unter Kleinunternehmerregelung keinen Satz", () => {
    const j = buildJournalInputFromRechnung(
      sampleRechnung({
        steuermodus: "kleinunternehmer",
        betrag_ust: "0.00",
        betrag_brutto: "100.00",
      }),
      {
        rechnungId: "r1",
        rechnungsnummer: "R-0003",
        positionen: [samplePos({ steuersatz: "19" })],
      },
    );
    expect(j.steuersatz).toBe("");
  });
});

describe("defaultFaelligAm", () => {
  it("addiert 14 Tage", () => {
    expect(defaultFaelligAm("2026-08-11")).toBe("2026-08-25");
  });
});

describe("PDF / §-19-Hinweis", () => {
  it("ADR-0012 Immutability-Hinweis", () => {
    expect(PDF_IMMUTABLE_ERROR).toMatch(/unveränderbar/i);
  });

  it("§-19-Hinweis für Kleinunternehmerregelung", () => {
    expect(KLEINUNTERNEHMER_HINWEIS).toMatch(/§ 19/);
  });
});

describe("Rechnungs-PDF Vorschau vs. Original", () => {
  it("erlaubt Vorschau nur für sendefähigen Entwurf", () => {
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung(), [samplePos()]),
    ).not.toThrow();
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung({ kunde: null }), [
        samplePos(),
      ]),
    ).toThrow(/Kund:in/);
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung({ status: "offen" }), [
        samplePos(),
      ]),
    ).toThrow(/Nur Entwürfe/);
  });

  it("serviert Original nicht am Entwurf", () => {
    expect(() =>
      assertCanServeOriginalRechnungPdf(sampleRechnung()),
    ).toThrow(PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR);
    expect(() =>
      assertCanServeOriginalRechnungPdf(
        sampleRechnung({ status: "offen", pdf: "R-0001.pdf" }),
      ),
    ).not.toThrow();
  });

  it("blockiert Vorschau nach Festschreibung", () => {
    expect(() =>
      assertRechnungVorschauNurEntwurf(sampleRechnung({ status: "offen" })),
    ).toThrow(PDF_VORSCHAU_NUR_ENTWURF_ERROR);
  });
});
