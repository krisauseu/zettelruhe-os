/**
 * Domain-Typen: Wiederkehrende Rechnungen (Vorlage + Rhythmus)
 * Job erzeugt Rechnungs-Entwurf; Nummernkreis erst bei manuellem Festschreiben.
 */

import type { Steuermodus } from "@/lib/pb";
import type { Steuersatz } from "@/modules/journal/types";
import type { RechnungspositionInput } from "./types";

export type { Steuersatz, Steuermodus };

/**
 * Rhythmus light (eine klare Modellierung):
 * - monatlich / quartalsweise / jaehrlich: feste Kalenderschritte
 * - tage: Intervall über intervall_tage (z. B. alle 14 Tage)
 */
export type WiederkehrRhythmus =
  | "monatlich"
  | "quartalsweise"
  | "jaehrlich"
  | "tage";

/** Eine Positionszeile der Vorlage (analog Rechnungsposition) */
export type WiederkehrPosition = {
  id: string;
  firma: string;
  wiederkehrende_rechnung: string;
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  katalog_position: string | null;
};

export type WiederkehrPositionInput = RechnungspositionInput;

/** Persistierte Vorlage */
export type WiederkehrendeRechnung = {
  id: string;
  firma: string;
  bezeichnung: string;
  /** Kund:in (Kontakt); Pflicht für Erzeugung */
  kunde: string | null;
  /** YYYY-MM-DD nächstes Ausstellungsdatum */
  naechstes_datum: string;
  rhythmus: WiederkehrRhythmus;
  /** Nur bei rhythmus=tage; sonst 0/leer */
  intervall_tage: number;
  /** Tage bis Fälligkeit ab Rechnungsdatum (Default 14) */
  zahlungsziel_tage: number;
  aktiv: boolean;
  notiz: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuermodus: Steuermodus;
  /** ISO-8601 UTC */
  zuletzt_erzeugt_am: string;
  letzte_rechnung: string | null;
  created?: string;
  updated?: string;
};

export type WiederkehrendeRechnungMitPositionen = WiederkehrendeRechnung & {
  positionen: WiederkehrPosition[];
};

export type WiederkehrInput = {
  bezeichnung: string;
  kunde?: string | null;
  naechstes_datum: string;
  rhythmus: WiederkehrRhythmus;
  intervall_tage?: number;
  zahlungsziel_tage?: number;
  aktiv?: boolean;
  notiz?: string;
  positionen: WiederkehrPositionInput[];
};

export type WiederkehrFilter = {
  q?: string;
  aktiv?: boolean | "";
  kunde?: string;
};

export type WiederkehrListResult = {
  items: WiederkehrendeRechnung[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
