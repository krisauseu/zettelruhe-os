import Decimal from "decimal.js";

/**
 * Geldbeträge und Steuerberechnungen — nie native JS-Floats (ADR-0016).
 * Interne Repräsentation: Decimal mit 2 Nachkommastellen (EUR Cent-sicher).
 */

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = string | number | Decimal;

export function money(value: MoneyInput = 0): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "string" && value.trim() === "") {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/** Summe von Beträgen */
export function sumMoney(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(money(v)), money(0));
}

/** Differenz a − b */
export function subMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(money(b));
}

/** Produkt (z. B. Menge × Preis) */
export function mulMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).times(money(b));
}

/**
 * Prozentanteil (z. B. 19 % USt auf Netto).
 * `rate` als Zahl: 19 für 19 %.
 */
export function percentOf(base: MoneyInput, rate: MoneyInput): Decimal {
  return money(base).times(money(rate)).dividedBy(100);
}

/** Netto + USt → Brutto */
export function bruttoFromNetto(netto: MoneyInput, ustRate: MoneyInput): Decimal {
  return money(netto).plus(percentOf(netto, ustRate));
}

/** Brutto → Netto bei bekanntem USt-Satz */
export function nettoFromBrutto(brutto: MoneyInput, ustRate: MoneyInput): Decimal {
  const rate = money(ustRate);
  // netto = brutto / (1 + rate/100)
  return money(brutto).dividedBy(rate.dividedBy(100).plus(1));
}

/** Auf 2 Nachkommastellen (kaufmännisch) runden */
export function roundMoney(value: MoneyInput, decimals = 2): Decimal {
  return money(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/** Serialisierung für DB/API (string, 2 Stellen) */
export function moneyToString(value: MoneyInput, decimals = 2): string {
  return roundMoney(value, decimals).toFixed(decimals);
}

/** Anzeige de-DE (1.234,56) ohne Währungssymbol */
export function formatMoneyDe(
  value: MoneyInput,
  options?: { currency?: boolean; decimals?: number },
): string {
  const decimals = options?.decimals ?? 2;
  const n = roundMoney(value, decimals).toNumber();
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
  if (options?.currency) {
    return `${formatted}\u00a0€`;
  }
  return formatted;
}

export { Decimal };
