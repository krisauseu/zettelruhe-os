import { describe, expect, it } from "vitest";
import {
  bruttoFromNetto,
  formatMoneyDe,
  money,
  moneyToString,
  mulMoney,
  nettoFromBrutto,
  percentOf,
  roundMoney,
  subMoney,
  sumMoney,
} from "./money";

describe("money", () => {
  it("parst und hält Cent-Genauigkeit (kein Float-Drift)", () => {
    // Klassischer Float-Fail: 0.1 + 0.2 !== 0.3
    const total = sumMoney("0.1", "0.2");
    expect(moneyToString(total)).toBe("0.30");
    expect(total.equals(money("0.3"))).toBe(true);
  });

  it("summiert und subtrahiert", () => {
    expect(moneyToString(sumMoney(10, 5.5, "0.25"))).toBe("15.75");
    expect(moneyToString(subMoney("100.00", "33.33"))).toBe("66.67");
  });

  it("multipliziert Menge × Preis", () => {
    expect(moneyToString(mulMoney(3, "19.99"))).toBe("59.97");
  });

  it("berechnet USt und Brutto/Netto (19 %)", () => {
    const netto = money("100.00");
    const ust = percentOf(netto, 19);
    expect(moneyToString(ust)).toBe("19.00");
    expect(moneyToString(bruttoFromNetto(netto, 19))).toBe("119.00");
    expect(moneyToString(nettoFromBrutto("119.00", 19))).toBe("100.00");
  });

  it("rundet kaufmännisch auf 2 Stellen", () => {
    expect(moneyToString(roundMoney("1.005"))).toBe("1.01");
    expect(moneyToString(roundMoney("1.004"))).toBe("1.00");
  });

  it("formatiert de-DE", () => {
    expect(formatMoneyDe("1234.5")).toBe("1.234,50");
    expect(formatMoneyDe("1234.5", { currency: true })).toBe("1.234,50\u00a0€");
  });

  it("behandelt leeren String als 0", () => {
    expect(moneyToString(money(""))).toBe("0.00");
  });
});
