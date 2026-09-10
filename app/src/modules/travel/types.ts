/**
 * Domain-Typen: Fahrten
 * Kund:in Pflicht, Projekt optional; km; Default abrechenbar.
 */

import type { Abrechnungsstatus } from "@/modules/time/types";

export type { Abrechnungsstatus };

export type Fahrt = {
  id: string;
  firma: string;
  /** Kund:in (Kontakt), Pflicht */
  kunde: string;
  /** Optional Projekt */
  projekt: string | null;
  /** YYYY-MM-DD */
  datum: string;
  /** Kilometer als Decimal-String (z. B. "12.50") */
  km: string;
  /** Strecke / Zweck light */
  strecke: string;
  status: Abrechnungsstatus;
  /** Light Flag steuerlich relevant */
  steuerlich_relevant: boolean;
  steuer_notiz: string;
  /** Optionaler km-Satz EUR */
  km_satz: string;
  /** Nach Übernahme in Rechnung */
  rechnung: string | null;
  created?: string;
  updated?: string;
};

export type FahrtInput = {
  kunde: string;
  projekt?: string | null;
  datum: string;
  km: string;
  strecke?: string;
  status?: Abrechnungsstatus;
  steuerlich_relevant?: boolean;
  steuer_notiz?: string;
  km_satz?: string;
};

export type FahrtFilter = {
  q?: string;
  kunde?: string;
  projekt?: string;
  status?: Abrechnungsstatus | "";
  /** YYYY-MM-DD inklusiv */
  von?: string;
  bis?: string;
};

export type FahrtListResult = {
  items: Fahrt[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
