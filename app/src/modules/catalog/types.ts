/** Domain-Typen: Produkt- & Leistungskatalog */

/** USt-Sätze v1 (Regelbesteuerung); unter Kleinunternehmerregelung irrelevant */
export type Steuersatz = "0" | "7" | "19";

export type KatalogPosition = {
  id: string;
  firma: string;
  bezeichnung: string;
  einheit: string;
  /** Geldbetrag als String (decimal.js / ADR-0016) */
  preis: string;
  steuersatz: Steuersatz | "";
  notiz: string;
  aktiv: boolean;
  created?: string;
  updated?: string;
};

export type KatalogPositionInput = {
  bezeichnung: string;
  einheit: string;
  preis: string;
  steuersatz?: Steuersatz | "";
  notiz?: string;
  aktiv?: boolean;
};

export type KatalogFilter = {
  q?: string;
  nurAktiv?: boolean;
};

export type KatalogListResult = {
  items: KatalogPosition[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
