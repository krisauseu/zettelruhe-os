import { describe, expect, it } from "vitest";
import {
  allocateZahlungAufStaffel,
  assertKeineUeberzahlung,
  assertRechnungZahlungsfaehig,
  buildJournalInputsFromZahlung,
  deriveRechnungStatus,
  offenerBetrag,
  rechnungStaffelFuerZahlung,
  sumZahlungen,
  validateZahlungInput,
  ZAHLUNG_BEZAHLT_ERROR,
  ZAHLUNG_ENTWURF_ERROR,
  ZAHLUNG_STORNIERT_ERROR,
  ZAHLUNG_UEBERZAHLUNG_ERROR,
} from "./invariants";

describe("validateZahlungInput", () => {
  it("normalisiert de-DE Betrag und Pflichtfelder", () => {
    const v = validateZahlungInput({
      rechnung: "r1",
      datum: "2026-08-12",
      betrag: "50,50",
      zahlungsweg: "ueberweisung",
      notiz: "Anzahlung",
    });
    expect(v.betrag).toBe("50.50");
    expect(v.datum).toBe("2026-08-12");
    expect(v.zahlungsweg).toBe("ueberweisung");
    expect(v.notiz).toBe("Anzahlung");
  });

  it("lehnt Betrag ≤ 0 ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "r1",
        datum: "2026-08-12",
        betrag: "0",
      }),
    ).toThrow(/größer als 0/);
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "r1",
        datum: "12.08.2026",
        betrag: "10",
      }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it("lehnt fehlende Rechnung ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "",
        datum: "2026-08-12",
        betrag: "10",
      }),
    ).toThrow(/Rechnung/);
  });
});

describe("sumZahlungen / offenerBetrag", () => {
  it("summiert Teilzahlungen", () => {
    expect(
      sumZahlungen([{ betrag: "40.00" }, { betrag: "30.50" }]),
    ).toBe("70.50");
  });

  it("berechnet offenen Rest", () => {
    expect(
      offenerBetrag("119.00", [{ betrag: "50.00" }, { betrag: "19.00" }]),
    ).toBe("50.00");
  });

  it("offener Betrag bei Vollzahlung = 0", () => {
    expect(offenerBetrag("100.00", [{ betrag: "100.00" }])).toBe("0.00");
  });
});

describe("assertKeineUeberzahlung", () => {
  it("erlaubt exakte Restzahlung", () => {
    expect(() =>
      assertKeineUeberzahlung("100.00", [{ betrag: "40.00" }], "60.00"),
    ).not.toThrow();
  });

  it("lehnt Überzahlung ab", () => {
    expect(() =>
      assertKeineUeberzahlung("100.00", [{ betrag: "40.00" }], "60.01"),
    ).toThrow(ZAHLUNG_UEBERZAHLUNG_ERROR);
  });

  it("lehnt erste Zahlung über Brutto ab", () => {
    expect(() =>
      assertKeineUeberzahlung("50.00", [], "50.01"),
    ).toThrow(ZAHLUNG_UEBERZAHLUNG_ERROR);
  });
});

describe("assertRechnungZahlungsfaehig", () => {
  it("erlaubt offen / teilbezahlt / ueberfaellig", () => {
    for (const status of ["offen", "teilbezahlt", "ueberfaellig"] as const) {
      expect(() =>
        assertRechnungZahlungsfaehig({
          status,
          betrag_brutto: "100.00",
        }),
      ).not.toThrow();
    }
  });

  it("lehnt Entwurf ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "entwurf",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_ENTWURF_ERROR);
  });

  it("lehnt bezahlt ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "bezahlt",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_BEZAHLT_ERROR);
  });

  it("lehnt storniert ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "storniert",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_STORNIERT_ERROR);
  });
});

describe("deriveRechnungStatus", () => {
  it("offen ohne Zahlungen und nicht fällig", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-12-31",
        heute: "2026-08-12",
      }),
    ).toBe("offen");
  });

  it("ueberfaellig ohne Zahlungen und Fälligkeit überschritten", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-08-01",
        heute: "2026-08-12",
      }),
    ).toBe("ueberfaellig");
  });

  it("teilbezahlt bei Teilzahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "40.00" }],
        faellig_am: "2026-08-01",
        heute: "2026-08-12",
      }),
    ).toBe("teilbezahlt");
  });

  it("bezahlt bei Vollzahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "teilbezahlt",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "60.00" }, { betrag: "40.00" }],
        heute: "2026-08-12",
      }),
    ).toBe("bezahlt");
  });

  it("bezahlt bei exakter einer Zahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "119.00",
        zahlungen: [{ betrag: "119.00" }],
      }),
    ).toBe("bezahlt");
  });

  it("lässt entwurf und storniert unverändert", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "entwurf",
        betragBrutto: "100.00",
        zahlungen: [],
      }),
    ).toBe("entwurf");
    expect(
      deriveRechnungStatus({
        currentStatus: "storniert",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "50.00" }],
      }),
    ).toBe("storniert");
  });

  it("nach Löschen aller Zahlungen zurück auf offen/ueberfaellig", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "teilbezahlt",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-12-01",
        heute: "2026-08-12",
      }),
    ).toBe("offen");
  });
});

describe("allocateZahlungAufStaffel", () => {
  const staffel19 = [
    {
      steuersatz: "19" as const,
      betrag_netto: "100.00",
      betrag_ust: "19.00",
      betrag_brutto: "119.00",
    },
  ];

  it("teilt Teilzahlung anteilig (19 %)", () => {
    const anteile = allocateZahlungAufStaffel({
      zahlungsbetrag: "50.00",
      rechnungStaffel: staffel19,
      bereits: [],
      vollstaendig: false,
    });
    expect(anteile).toHaveLength(1);
    expect(anteile[0]?.betrag_brutto).toBe("50.00");
    expect(anteile[0]?.betrag_netto).toBe("42.02");
    expect(anteile[0]?.betrag_ust).toBe("7.98");
    expect(anteile[0]?.steuersatz).toBe("19");
  });

  it("letzte Zahlung nimmt den Rest ohne Cent-Drift", () => {
    const rest = allocateZahlungAufStaffel({
      zahlungsbetrag: "69.00",
      rechnungStaffel: staffel19,
      bereits: [
        {
          steuersatz: "19",
          betrag_netto: "42.02",
          betrag_ust: "7.98",
          betrag_brutto: "50.00",
        },
      ],
      vollstaendig: true,
    });
    expect(rest).toEqual([
      {
        steuersatz: "19",
        betrag_netto: "57.98",
        betrag_ust: "11.02",
        betrag_brutto: "69.00",
      },
    ]);
  });

  it("teilt gemischte Sätze anteilig, letzte Zeile fängt Rundung", () => {
    const anteile = allocateZahlungAufStaffel({
      zahlungsbetrag: "86.25",
      rechnungStaffel: [
        {
          steuersatz: "19",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          betrag_brutto: "119.00",
        },
        {
          steuersatz: "7",
          betrag_netto: "50.00",
          betrag_ust: "3.50",
          betrag_brutto: "53.50",
        },
      ],
      bereits: [],
      vollstaendig: false,
    });
    expect(anteile).toHaveLength(2);
    const sumBrutto = anteile.reduce(
      (a, r) => a + Number(r.betrag_brutto),
      0,
    );
    expect(sumBrutto.toFixed(2)).toBe("86.25");
    expect(anteile[0]?.steuersatz).toBe("19");
    expect(anteile[1]?.steuersatz).toBe("7");
  });
});

describe("buildJournalInputsFromZahlung", () => {
  it("setzt quelle_typ=zahlung und Zahlungsdatum", () => {
    const inputs = buildJournalInputsFromZahlung({
      zahlung: {
        id: "z1",
        datum: "2026-09-01",
        betrag: "119.00",
        zahlungsweg: "ueberweisung",
      },
      rechnung: {
        rechnungsnummer: "R-0004",
        rechnungsdatum: "2026-08-10",
        kunde: "k1",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        betrag_brutto: "119.00",
        steuermodus: "regelbesteuerung_ist",
      },
      positionen: [
        {
          steuersatz: "19",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
        },
      ],
      bereits: [],
      vollstaendig: true,
    });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.quelle_typ).toBe("zahlung");
    expect(inputs[0]?.quelle_id).toBe("z1");
    expect(inputs[0]?.buchungsdatum).toBe("2026-09-01");
    expect(inputs[0]?.belegdatum).toBe("2026-08-10");
    expect(inputs[0]?.richtung).toBe("einnahme");
    expect(inputs[0]?.betrag_brutto).toBe("119.00");
    expect(inputs[0]?.steuersatz).toBe("19");
    expect(inputs[0]?.buchungstext).toMatch(/Überweisung/);
    expect(inputs[0]?.buchungstext).toMatch(/R-0004/);
  });

  it("bildet Staffel aus Positionen", () => {
    const staffel = rechnungStaffelFuerZahlung(
      {
        betrag_netto: "150.00",
        betrag_ust: "22.50",
        betrag_brutto: "172.50",
        steuermodus: "regelbesteuerung_ist",
      },
      [
        { steuersatz: "19", betrag_netto: "100.00", betrag_ust: "19.00" },
        { steuersatz: "7", betrag_netto: "50.00", betrag_ust: "3.50" },
      ],
    );
    expect(staffel).toHaveLength(2);
    expect(staffel[0]?.betrag_brutto).toBe("119.00");
    expect(staffel[1]?.betrag_brutto).toBe("53.50");
  });
});
