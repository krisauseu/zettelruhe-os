import { describe, expect, it } from "vitest";
import {
  assertCanStornieren,
  assertImmutableWriteBlocked,
  assertSaldoNichtNegativ,
  buildJournalInputFromKasse,
  buildKassenbuchStornoInput,
  compareKassenbuchChronologisch,
  computeRunningSaldo,
  IMMUTABLE_ERROR,
  invertRichtung,
  NEGATIVER_SALDO_ERROR,
  STORNO_BEREITS_ERROR,
  STORNO_VON_STORNO_ERROR,
  validateKassenbuchInput,
} from "./invariants";
import type { KassenbuchEintrag } from "./types";

function entry(
  partial: Partial<KassenbuchEintrag> &
    Pick<KassenbuchEintrag, "id" | "datum" | "richtung" | "betrag_brutto">,
): Pick<KassenbuchEintrag, "id" | "datum" | "richtung" | "betrag_brutto"> {
  return partial;
}

describe("validateKassenbuchInput", () => {
  it("normalisiert de-DE Brutto und Pflichtfelder", () => {
    const v = validateKassenbuchInput({
      datum: "2026-08-12",
      richtung: "einnahme",
      betrag_brutto: "50,50",
      text: "Barverkauf",
      kategorie: "Verkauf",
    });
    expect(v.betrag_brutto).toBe("50.50");
    expect(v.betrag_netto).toBe("50.50");
    expect(v.betrag_ust).toBe("0.00");
    expect(v.text).toBe("Barverkauf");
    expect(v.kategorie).toBe("Verkauf");
    expect(v.richtung).toBe("einnahme");
  });

  it("rechnet USt aus Brutto + Satz", () => {
    const v = validateKassenbuchInput({
      datum: "2026-08-12",
      richtung: "ausgabe",
      betrag_brutto: "119",
      steuersatz: "19",
      text: "Material bar",
    });
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("19.00");
    expect(v.betrag_brutto).toBe("119.00");
  });

  it("lehnt Betrag 0 ab", () => {
    expect(() =>
      validateKassenbuchInput({
        datum: "2026-08-12",
        richtung: "einnahme",
        betrag_brutto: "0",
        text: "x",
      }),
    ).toThrow(/größer als 0/);
  });

  it("lehnt ungültiges Datum und leeren Text ab", () => {
    expect(() =>
      validateKassenbuchInput({
        datum: "12.08.2026",
        richtung: "einnahme",
        betrag_brutto: "10",
        text: "x",
      }),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      validateKassenbuchInput({
        datum: "2026-08-12",
        richtung: "einnahme",
        betrag_brutto: "10",
        text: "  ",
      }),
    ).toThrow(/Text/);
  });
});

describe("computeRunningSaldo", () => {
  it("addiert Einnahmen und subtrahiert Ausgaben chronologisch", () => {
    const { items, saldo } = computeRunningSaldo([
      entry({
        id: "b",
        datum: "2026-08-02",
        richtung: "ausgabe",
        betrag_brutto: "30.00",
      }),
      entry({
        id: "a",
        datum: "2026-08-01",
        richtung: "einnahme",
        betrag_brutto: "100.00",
      }),
    ]);
    expect(items[0].id).toBe("a");
    expect(items[0].saldo_nach).toBe("100.00");
    expect(items[1].id).toBe("b");
    expect(items[1].saldo_nach).toBe("70.00");
    expect(saldo).toBe("70.00");
  });

  it("sortiert bei gleichem Datum nach id", () => {
    const { items } = computeRunningSaldo([
      entry({
        id: "z",
        datum: "2026-08-01",
        richtung: "ausgabe",
        betrag_brutto: "10.00",
      }),
      entry({
        id: "a",
        datum: "2026-08-01",
        richtung: "einnahme",
        betrag_brutto: "50.00",
      }),
    ]);
    expect(items.map((e) => e.id)).toEqual(["a", "z"]);
    expect(items[1].saldo_nach).toBe("40.00");
  });

  it("leerer Bestand → Saldo 0", () => {
    const { saldo, items } = computeRunningSaldo([]);
    expect(saldo).toBe("0.00");
    expect(items).toEqual([]);
  });
});

describe("assertSaldoNichtNegativ", () => {
  it("erlaubt Ausgabe innerhalb des Saldos", () => {
    expect(() =>
      assertSaldoNichtNegativ(
        [
          entry({
            id: "1",
            datum: "2026-08-01",
            richtung: "einnahme",
            betrag_brutto: "100.00",
          }),
        ],
        entry({
          id: "2",
          datum: "2026-08-02",
          richtung: "ausgabe",
          betrag_brutto: "100.00",
        }),
      ),
    ).not.toThrow();
  });

  it("lehnt Ausgabe ab, die den Saldo unter 0 drückt", () => {
    expect(() =>
      assertSaldoNichtNegativ(
        [
          entry({
            id: "1",
            datum: "2026-08-01",
            richtung: "einnahme",
            betrag_brutto: "50.00",
          }),
        ],
        entry({
          id: "2",
          datum: "2026-08-02",
          richtung: "ausgabe",
          betrag_brutto: "50.01",
        }),
      ),
    ).toThrow(NEGATIVER_SALDO_ERROR);
  });

  it("lehnt erste Barausgabe bei Saldo 0 ab", () => {
    expect(() =>
      assertSaldoNichtNegativ(
        [],
        entry({
          id: "1",
          datum: "2026-08-01",
          richtung: "ausgabe",
          betrag_brutto: "10.00",
        }),
      ),
    ).toThrow(NEGATIVER_SALDO_ERROR);
  });

  it("erkennt negativen Zwischenstand bei rückdatiertem Eintrag", () => {
    // Chronologisch: Ausgabe 20 am 01. → Saldo −20, dann Einnahme 100 am 02.
    expect(() =>
      assertSaldoNichtNegativ(
        [
          entry({
            id: "2",
            datum: "2026-08-02",
            richtung: "einnahme",
            betrag_brutto: "100.00",
          }),
        ],
        entry({
          id: "1",
          datum: "2026-08-01",
          richtung: "ausgabe",
          betrag_brutto: "20.00",
        }),
      ),
    ).toThrow(NEGATIVER_SALDO_ERROR);
  });
});

describe("buildJournalInputFromKasse", () => {
  it("setzt quelle_typ=kasse und Beträge", () => {
    const j = buildJournalInputFromKasse(
      {
        datum: "2026-08-12",
        richtung: "einnahme",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        betrag_brutto: "119.00",
        steuersatz: "19",
        text: "Barverkauf",
        kategorie: "Verkauf",
        kontakt: "k1",
      },
      { eintragId: "kb1", belegnummer: "K-0001" },
    );
    expect(j.quelle_typ).toBe("kasse");
    expect(j.quelle_id).toBe("kb1");
    expect(j.richtung).toBe("einnahme");
    expect(j.betrag_brutto).toBe("119.00");
    expect(j.buchungstext).toContain("K-0001");
    expect(j.kontakt).toBe("k1");
  });
});

describe("buildKassenbuchStornoInput", () => {
  it("invertiert die Richtung und behält Beträge", () => {
    const original = {
      id: "orig",
      firma: "f1",
      datum: "2026-08-10",
      richtung: "einnahme" as const,
      betrag_netto: "10.00",
      betrag_ust: "0.00",
      betrag_brutto: "10.00",
      steuersatz: "" as const,
      text: "Test",
      kategorie: "Cat",
      notiz: "",
      kontakt: null,
      belegnummer: "K-0001",
      journal_eintrag: "j1",
      festgeschrieben_am: "2026-08-10T10:00:00.000Z",
      storno_von: null,
    };
    const s = buildKassenbuchStornoInput(original, { datum: "2026-08-12" });
    expect(s.richtung).toBe("ausgabe");
    expect(s.betrag_brutto).toBe("10.00");
    expect(s.datum).toBe("2026-08-12");
    expect(s.text).toMatch(/Storno zu K-0001/);
  });
});

describe("assertCanStornieren / Immutability", () => {
  it("blockiert Storno von Storno", () => {
    expect(() =>
      assertCanStornieren({ storno_von: "x" }, null),
    ).toThrow(STORNO_VON_STORNO_ERROR);
  });

  it("blockiert Doppel-Storno", () => {
    const storno = {
      id: "s",
      belegnummer: "K-0002",
    } as KassenbuchEintrag;
    expect(() => assertCanStornieren({ storno_von: null }, storno)).toThrow(
      STORNO_BEREITS_ERROR,
    );
  });

  it("blockiert Update/Delete", () => {
    expect(() => assertImmutableWriteBlocked("update")).toThrow(
      IMMUTABLE_ERROR,
    );
    expect(() => assertImmutableWriteBlocked("delete")).toThrow(
      IMMUTABLE_ERROR,
    );
  });
});

describe("compareKassenbuchChronologisch / invertRichtung", () => {
  it("vergleicht Datum dann id", () => {
    expect(
      compareKassenbuchChronologisch(
        { id: "a", datum: "2026-01-01" },
        { id: "b", datum: "2026-01-02" },
      ),
    ).toBeLessThan(0);
    expect(
      compareKassenbuchChronologisch(
        { id: "b", datum: "2026-01-01" },
        { id: "a", datum: "2026-01-01" },
      ),
    ).toBeGreaterThan(0);
  });

  it("invertiert Richtung", () => {
    expect(invertRichtung("einnahme")).toBe("ausgabe");
    expect(invertRichtung("ausgabe")).toBe("einnahme");
  });
});
