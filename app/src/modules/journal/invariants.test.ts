import { describe, expect, it } from "vitest";
import {
  buildStornoInput,
  festschreibungsZeitpunktUtc,
  IMMUTABLE_ERROR,
  invertRichtung,
  isValidIsoDate,
  normalizeBetragInput,
  normalizeBetraege,
  todayBerlin,
  validateBuchungInput,
  assertImmutableWriteBlocked,
} from "./invariants";

describe("isValidIsoDate", () => {
  it("akzeptiert gültige Daten", () => {
    expect(isValidIsoDate("2026-08-11")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });

  it("lehnt ungültige ab", () => {
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("11.08.2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("normalizeBetragInput", () => {
  it("parst de-DE und Punkt", () => {
    expect(normalizeBetragInput("19,99")).toBe("19.99");
    expect(normalizeBetragInput("1.234,50")).toBe("1234.50");
    expect(normalizeBetragInput("10.00")).toBe("10.00");
  });

  it("lehnt negativ und leer ab", () => {
    expect(() => normalizeBetragInput("-1")).toThrow(/negativ/i);
    expect(() => normalizeBetragInput("")).toThrow(/erforderlich/i);
  });
});

describe("normalizeBetraege", () => {
  it("rechnet USt und Brutto aus Netto + Satz", () => {
    const r = normalizeBetraege({
      betrag_netto: "100,00",
      steuersatz: "19",
    });
    expect(r.betrag_netto).toBe("100.00");
    expect(r.betrag_ust).toBe("19.00");
    expect(r.betrag_brutto).toBe("119.00");
  });

  it("rechnet Netto aus Brutto + Satz", () => {
    const r = normalizeBetraege({
      betrag_brutto: "119",
      steuersatz: "19",
    });
    expect(r.betrag_netto).toBe("100.00");
    expect(r.betrag_ust).toBe("19.00");
    expect(r.betrag_brutto).toBe("119.00");
  });

  it("ohne USt: Netto = Brutto", () => {
    const r = normalizeBetraege({ betrag_netto: "42,5" });
    expect(r.betrag_netto).toBe("42.50");
    expect(r.betrag_ust).toBe("0.00");
    expect(r.betrag_brutto).toBe("42.50");
  });

  it("lehnt inkonsistente Beträge ab", () => {
    expect(() =>
      normalizeBetraege({
        betrag_netto: "100",
        betrag_ust: "10",
        betrag_brutto: "200",
      }),
    ).toThrow(/inkonsistent/i);
  });
});

describe("validateBuchungInput", () => {
  const base = {
    buchungsdatum: "2026-08-11",
    buchungstext: "Testbuchung",
    richtung: "ausgabe" as const,
    betrag_netto: "10,00",
  };

  it("validiert manuelle Buchung", () => {
    const v = validateBuchungInput(base);
    expect(v.quelle_typ).toBe("manuell");
    expect(v.betrag_brutto).toBe("10.00");
    expect(v.storno_von).toBeNull();
  });

  it("lehnt Nullbetrag ab", () => {
    expect(() =>
      validateBuchungInput({ ...base, betrag_netto: "0" }),
    ).toThrow(/größer als 0/i);
  });

  it("fordert storno_von bei quelle storno", () => {
    expect(() =>
      validateBuchungInput({
        ...base,
        quelle_typ: "storno",
      }),
    ).toThrow(/storno/i);
  });

  it("akzeptiert Quelle Zahlung", () => {
    const v = validateBuchungInput({
      ...base,
      richtung: "einnahme",
      quelle_typ: "zahlung",
      quelle_id: "pay1",
    });
    expect(v.quelle_typ).toBe("zahlung");
    expect(v.quelle_id).toBe("pay1");
  });

  it("akzeptiert Storno mit Verweis", () => {
    const v = validateBuchungInput({
      ...base,
      quelle_typ: "storno",
      storno_von: "abc123xyz456789",
    });
    expect(v.storno_von).toBe("abc123xyz456789");
  });
});

describe("Storno-Gegenbuchung", () => {
  it("invertiert Richtung", () => {
    expect(invertRichtung("einnahme")).toBe("ausgabe");
    expect(invertRichtung("ausgabe")).toBe("einnahme");
  });

  it("baut Gegenbuchung mit gleichen Beträgen", () => {
    const input = buildStornoInput({
      id: "orig01orig01orig",
      buchungsdatum: "2026-08-01",
      buchungstext: "Bürobedarf",
      richtung: "ausgabe",
      betrag_netto: "50.00",
      betrag_ust: "9.50",
      betrag_brutto: "59.50",
      steuersatz: "19",
      konto: "4930",
      kontakt: null,
    });
    expect(input.richtung).toBe("einnahme");
    expect(input.quelle_typ).toBe("storno");
    expect(input.storno_von).toBe("orig01orig01orig");
    expect(input.betrag_brutto).toBe("59.50");
  });
});

describe("Festschreibung / Immutability", () => {
  it("todayBerlin liefert YYYY-MM-DD", () => {
    expect(todayBerlin(new Date("2026-08-11T22:30:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("festschreibungsZeitpunktUtc ist ISO", () => {
    const s = festschreibungsZeitpunktUtc(new Date("2026-08-11T12:00:00.000Z"));
    expect(s).toBe("2026-08-11T12:00:00.000Z");
  });

  it("blockiert update/delete mit fachlicher Meldung", () => {
    expect(() => assertImmutableWriteBlocked("update")).toThrow(IMMUTABLE_ERROR);
    expect(() => assertImmutableWriteBlocked("delete")).toThrow(/Storno/);
  });
});
