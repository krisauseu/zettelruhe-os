import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  addMonthsIso,
  faelligAmFromZahlungsziel,
  isVorlageFaellig,
  mapVorlageToRechnungInput,
  nextNaechstesDatum,
  parseRhythmus,
  validateWiederkehrInput,
} from "./wiederkehrend-invariants";
import type { WiederkehrendeRechnung, WiederkehrPosition } from "./wiederkehrend-types";

describe("wiederkehrend Rhythmus / Datum", () => {
  it("parseRhythmus erkennt bekannte Werte", () => {
    expect(parseRhythmus("monatlich")).toBe("monatlich");
    expect(parseRhythmus("quartalsweise")).toBe("quartalsweise");
    expect(parseRhythmus("jaehrlich")).toBe("jaehrlich");
    expect(parseRhythmus("tage")).toBe("tage");
    expect(parseRhythmus("subscription")).toBe("");
  });

  it("addDaysIso addiert Kalendertage", () => {
    expect(addDaysIso("2026-01-15", 14)).toBe("2026-01-29");
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("addMonthsIso klemmt Monatsende", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonthsIso("2026-01-15", 3)).toBe("2026-04-15");
    expect(addMonthsIso("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("nextNaechstesDatum je Rhythmus", () => {
    expect(nextNaechstesDatum("2026-03-01", "monatlich", 0)).toBe(
      "2026-04-01",
    );
    expect(nextNaechstesDatum("2026-03-01", "quartalsweise", 0)).toBe(
      "2026-06-01",
    );
    expect(nextNaechstesDatum("2026-03-01", "jaehrlich", 0)).toBe(
      "2027-03-01",
    );
    expect(nextNaechstesDatum("2026-03-01", "tage", 14)).toBe("2026-03-15");
    expect(nextNaechstesDatum("2026-03-01", "tage", 0)).toBe("2026-03-02");
  });

  it("faelligAmFromZahlungsziel", () => {
    expect(faelligAmFromZahlungsziel("2026-03-01", 14)).toBe("2026-03-15");
    expect(faelligAmFromZahlungsziel("2026-03-01", 0)).toBe("2026-03-01");
  });

  it("isVorlageFaellig", () => {
    expect(
      isVorlageFaellig(
        { aktiv: true, naechstes_datum: "2026-08-01" },
        "2026-08-12",
      ),
    ).toBe(true);
    expect(
      isVorlageFaellig(
        { aktiv: true, naechstes_datum: "2026-08-20" },
        "2026-08-12",
      ),
    ).toBe(false);
    expect(
      isVorlageFaellig(
        { aktiv: false, naechstes_datum: "2026-08-01" },
        "2026-08-12",
      ),
    ).toBe(false);
  });
});

describe("validateWiederkehrInput", () => {
  const base = {
    bezeichnung: "Hosting",
    kunde: "k1",
    naechstes_datum: "2026-09-01",
    rhythmus: "monatlich" as const,
    positionen: [
      {
        bezeichnung: "Paket",
        menge: "1",
        einzelpreis: "10,00",
      },
    ],
  };

  it("validiert monatliche Vorlage", () => {
    const v = validateWiederkehrInput(base, "kleinunternehmer");
    expect(v.bezeichnung).toBe("Hosting");
    expect(v.rhythmus).toBe("monatlich");
    expect(v.betrag_brutto).toBe("10.00");
    expect(v.aktiv).toBe(true);
  });

  it("fordert intervall_tage bei Rhythmus Tage", () => {
    expect(() =>
      validateWiederkehrInput(
        { ...base, rhythmus: "tage", intervall_tage: 0 },
        "kleinunternehmer",
      ),
    ).toThrow(/Intervall/);
    const v = validateWiederkehrInput(
      { ...base, rhythmus: "tage", intervall_tage: 7 },
      "kleinunternehmer",
    );
    expect(v.intervall_tage).toBe(7);
  });
});

describe("mapVorlageToRechnungInput", () => {
  const vorlage: WiederkehrendeRechnung = {
    id: "wr1",
    firma: "f1",
    bezeichnung: "Hosting monatlich",
    kunde: "k1",
    naechstes_datum: "2026-09-01",
    rhythmus: "monatlich",
    intervall_tage: 0,
    zahlungsziel_tage: 14,
    aktiv: true,
    notiz: "Abo-Hinweis",
    betrag_netto: "10.00",
    betrag_ust: "0.00",
    betrag_brutto: "10.00",
    steuermodus: "kleinunternehmer",
    zuletzt_erzeugt_am: "",
    letzte_rechnung: null,
  };

  const positionen: WiederkehrPosition[] = [
    {
      id: "p1",
      firma: "f1",
      wiederkehrende_rechnung: "wr1",
      sortierung: 1,
      bezeichnung: "Hosting",
      menge: "1",
      einheit: "Mon.",
      einzelpreis: "10.00",
      steuersatz: "",
      betrag_netto: "10.00",
      betrag_ust: "0.00",
      betrag_brutto: "10.00",
      katalog_position: null,
    },
  ];

  it("mappt auf Rechnungs-Entwurf-Input", () => {
    const input = mapVorlageToRechnungInput(vorlage, positionen);
    expect(input.kunde).toBe("k1");
    expect(input.rechnungsdatum).toBe("2026-09-01");
    expect(input.faellig_am).toBe("2026-09-15");
    expect(input.positionen).toHaveLength(1);
    expect(input.notiz).toContain("Wiederkehrende Rechnung");
    expect(input.notiz).toContain("Abo-Hinweis");
  });

  it("lehnt pausierte Vorlage ab", () => {
    expect(() =>
      mapVorlageToRechnungInput({ ...vorlage, aktiv: false }, positionen),
    ).toThrow(/pausiert/i);
  });
});
