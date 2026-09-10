import type { RcInput, RcSnapshot } from "./reverse-charge";
/**
 * Domain-Typen: Belege (manuelle Erfassung + Datei)
 * UX-Schicht über dem Buchungsjournal; Festschreibung → Journal (quelle_typ=beleg).
 */

import type { Buchungsrichtung, Steuersatz } from "@/modules/journal/types";

export type BelegStatus = "entwurf" | "festgeschrieben";

/** Max. Anzahl Dateien je Beleg (z. B. Fotoseiten). */
export const BELEG_DATEI_MAX_ANZAHL = 10;

export type { Buchungsrichtung, Steuersatz };

/** Persistierter Beleg */
export type Beleg = {
  rc?: RcInput | RcSnapshot | null;
  rc_steuerdatum?: string;
  rc_vorgang?: string;
  id: string;
  firma: string;
  /** YYYY-MM-DD */
  belegdatum: string;
  /** YYYY-MM-DD — bei Entwurf optional, bei Festschreibung gesetzt */
  buchungsdatum: string;
  richtung: Buchungsrichtung;
  /** Lieferant:in (Kontakt), optional — nur Ausgabe */
  lieferant: string | null;
  /** Kund:in (Kontakt), optional — nur Einnahme */
  kunde: string | null;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
  kategorie: string;
  /** Bezeichnung des Geschäftsvorfalls (PB-Feld `notiz`, keine Migration) */
  notiz: string;
  konto: string;
  status: BelegStatus;
  /** Dateinamen in PB (leer = keine Datei) */
  datei: string[];
  /** Erst bei Festschreibung vergeben */
  belegnummer: string;
  /** Verweis auf Journal-Eintrag nach Festschreibung */
  journal_eintrag: string | null;
  /** ISO-8601 UTC */
  festgeschrieben_am: string;
  created?: string;
  updated?: string;
};

/** Eingabe für Entwurf anlegen/aktualisieren */
export type BelegInput = {
  rc?: RcInput | null;
  belegdatum: string;
  buchungsdatum?: string;
  richtung: Buchungsrichtung;
  lieferant?: string | null;
  kunde?: string | null;
  betrag_netto?: string;
  betrag_ust?: string;
  betrag_brutto?: string;
  steuersatz?: Steuersatz | "";
  kategorie?: string;
  notiz?: string;
  konto?: string;
};

export type BelegFilter = {
  q?: string;
  status?: BelegStatus | "";
  richtung?: Buchungsrichtung | "";
  /** YYYY-MM-DD inklusiv (Belegdatum) */
  von?: string;
  bis?: string;
};

export type BelegListResult = {
  items: Beleg[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** Option in den Beleg-Dropdowns Lieferant:in / Kund:in */
export type BelegPartnerOption = { id: string; name: string; land?: string; ust_id?: string; ausgaben_steuerstandard?: import("@/modules/contacts/steuerstandard").AusgabenSteuerstandard };
