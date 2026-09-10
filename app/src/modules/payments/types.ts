/**
 * Domain-Typen: Zahlungen (manuell, inkl. Teilzahlung)
 * Ausgleich offener Rechnungen; Grundlage für Status und späteren Bank-Match (Abschn. 11).
 * Zahlung als eigener Datensatz + Rechnungsstatus; Zufluss-Journal (ADR-0024).
 */

/** Zahlungsweg light (optional) */
export type Zahlungsweg = "bar" | "ueberweisung" | "sonstiges";

/** Persistierte Zahlung */
export type Zahlung = {
  id: string;
  firma: string;
  /** Verknüpfte Rechnung (festgeschrieben) */
  rechnung: string;
  /** YYYY-MM-DD */
  datum: string;
  /** Betrag als Decimal-String (2 Stellen) */
  betrag: string;
  zahlungsweg: Zahlungsweg | "";
  notiz: string;
  created?: string;
  updated?: string;
};

/** Eingabe Zahlung anlegen */
export type ZahlungInput = {
  rechnung: string;
  datum: string;
  betrag: string;
  zahlungsweg?: Zahlungsweg | "";
  notiz?: string;
};

export type ZahlungFilter = {
  rechnung?: string;
  /** YYYY-MM-DD inklusiv */
  von?: string;
  bis?: string;
  q?: string;
};

export type ZahlungListResult = {
  items: Zahlung[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/**
 * Offener Posten: festgeschriebene Rechnung mit Restbetrag > 0
 * (offen / teilbezahlt / ueberfaellig).
 */
export type OffenerPosten = {
  rechnungId: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faellig_am: string;
  kundeId: string | null;
  kundeName: string | null;
  status: string;
  betrag_brutto: string;
  bezahlt: string;
  offen: string;
};
