/** Domain-Typen: Projekte (optional je Kund:in, light Stammdaten) */

export type Projekt = {
  id: string;
  firma: string;
  /** Kund:in (Kontakt), Pflicht */
  kunde: string;
  name: string;
  notiz: string;
  /** Default true */
  aktiv: boolean;
  created?: string;
  updated?: string;
};

export type ProjektInput = {
  kunde: string;
  name: string;
  notiz?: string;
  aktiv?: boolean;
};

export type ProjektFilter = {
  q?: string;
  kunde?: string;
  /** true = nur aktiv, false = nur inaktiv, undefined = alle */
  aktiv?: boolean;
};

export type ProjektListResult = {
  items: Projekt[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
