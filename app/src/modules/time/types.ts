/**
 * Domain-Typen: Zeiteinträge
 * Kund:in Pflicht, Projekt optional; Dauer in Minuten; Status abrechenbar.
 */

/** Abrechnungsstatus (CONTEXT) */
export type Abrechnungsstatus =
  | "abrechenbar"
  | "nicht_abrechenbar"
  | "abgerechnet";

export type Zeiteintrag = {
  id: string;
  firma: string;
  /** Kund:in (Kontakt), Pflicht */
  kunde: string;
  /** Optional Projekt */
  projekt: string | null;
  /** YYYY-MM-DD */
  datum: string;
  /** Dauer in Minuten (≥ 1) */
  dauer_minuten: number;
  beschreibung: string;
  status: Abrechnungsstatus;
  /** Optionaler Stundensatz EUR (Text, decimal) */
  stundensatz: string;
  /** Nach Übernahme in Rechnung */
  rechnung: string | null;
  created?: string;
  updated?: string;
};

/**
 * Eingabe: Dauer als Stunden+Minuten und/oder Dezimalstunden.
 * Repository normalisiert auf dauer_minuten.
 */
export type ZeiteintragInput = {
  kunde: string;
  projekt?: string | null;
  datum: string;
  /** Ganze Stunden (≥ 0) */
  stunden?: number | string;
  /** Minuten 0–59 */
  minuten?: number | string;
  /**
   * Alternative: Dezimalstunden (z. B. "1,5" oder "1.5").
   * Wenn gesetzt und stunden/minuten leer, wird daraus Dauer berechnet.
   */
  dezimal_stunden?: string;
  beschreibung?: string;
  status?: Abrechnungsstatus;
  stundensatz?: string;
};

export type ZeiteintragFilter = {
  q?: string;
  kunde?: string;
  projekt?: string;
  status?: Abrechnungsstatus | "";
  /** YYYY-MM-DD inklusiv */
  von?: string;
  bis?: string;
};

export type ZeiteintragListResult = {
  items: Zeiteintrag[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
