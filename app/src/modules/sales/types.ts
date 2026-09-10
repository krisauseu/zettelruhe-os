/**
 * Domain-Typen: Rechnungen + Angebote (Sales)
 * Rechnung: Entwurf editierbar; Festschreibung → Nummer + PDF + Journal.
 * Angebot: Entwurf editierbar; Senden → Nummer + PDF (kein Journal).
 */

import type { Steuermodus } from "@/lib/pb";
import type { Steuersatz } from "@/modules/journal/types";

/**
 * Rechnungsstatus (CONTEXT/Roadmap light):
 * Entwurf → Offen → Teilbezahlt → Bezahlt; optional Überfällig; Storniert light
 */
export type RechnungStatus =
  | "entwurf"
  | "offen"
  | "teilbezahlt"
  | "bezahlt"
  | "ueberfaellig"
  | "storniert";

/**
 * Angebotsstatus (CONTEXT/Roadmap):
 * Entwurf → Gesendet → Angenommen / Abgelehnt / Abgelaufen → Abgerechnet
 */
export type AngebotStatus =
  | "entwurf"
  | "gesendet"
  | "angenommen"
  | "abgelehnt"
  | "abgelaufen"
  | "abgerechnet";

export type { Steuersatz, Steuermodus };

/** Eine Rechnungsposition */
export type Rechnungsposition = {
  id: string;
  firma: string;
  rechnung: string;
  sortierung: number;
  bezeichnung: string;
  /** Menge als Decimal-String */
  menge: string;
  einheit: string;
  /** Einzelpreis netto */
  einzelpreis: string;
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  /** Optionaler Katalog-Bezug */
  katalog_position: string | null;
};

/** Eingabe Position (ohne id/firma/rechnung) */
export type RechnungspositionInput = {
  bezeichnung: string;
  menge: string;
  einheit?: string;
  einzelpreis: string;
  steuersatz?: Steuersatz | "";
  katalog_position?: string | null;
};

/** Persistierte Rechnung (Kopf) */
export type Rechnung = {
  id: string;
  firma: string;
  /** Kund:in (Kontakt), optional im Entwurf, Pflicht bei Festschreibung */
  kunde: string | null;
  /** YYYY-MM-DD */
  rechnungsdatum: string;
  leistungszeitraum_von: string;
  leistungszeitraum_bis: string;
  faellig_am: string;
  notiz: string;
  status: RechnungStatus;
  /** Erst bei Festschreibung vergeben */
  rechnungsnummer: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  /** Snapshot Steuer-Modus (PDF / Historie) */
  steuermodus: Steuermodus;
  /** Dateiname PDF in PB (leer = keins) */
  pdf: string;
  journal_eintrag: string | null;
  /** ISO-8601 UTC */
  festgeschrieben_am: string;
  created?: string;
  updated?: string;
};

/** Rechnung mit geladenen Positionen */
export type RechnungMitPositionen = Rechnung & {
  positionen: Rechnungsposition[];
};

/** Eingabe für Entwurf anlegen/aktualisieren */
export type RechnungInput = {
  kunde?: string | null;
  rechnungsdatum: string;
  leistungszeitraum_von?: string;
  leistungszeitraum_bis?: string;
  faellig_am?: string;
  notiz?: string;
  positionen: RechnungspositionInput[];
};

export type RechnungFilter = {
  q?: string;
  status?: RechnungStatus | "";
  /** YYYY-MM-DD inklusiv (Rechnungsdatum) */
  von?: string;
  bis?: string;
  kunde?: string;
};

export type RechnungListResult = {
  items: Rechnung[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// Angebote
// ---------------------------------------------------------------------------

/** Eine Angebotsposition (analog Rechnungsposition) */
export type Angebotsposition = {
  id: string;
  firma: string;
  angebot: string;
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

/** Eingabe Position (ohne id/firma/angebot) */
export type AngebotspositionInput = {
  bezeichnung: string;
  menge: string;
  einheit?: string;
  einzelpreis: string;
  steuersatz?: Steuersatz | "";
  katalog_position?: string | null;
};

/** Persistiertes Angebot (Kopf) */
export type Angebot = {
  id: string;
  firma: string;
  /** Kund:in (Kontakt), optional im Entwurf, Pflicht beim Senden */
  kunde: string | null;
  /** YYYY-MM-DD */
  angebotsdatum: string;
  /** YYYY-MM-DD Gültig bis */
  gueltig_bis: string;
  notiz: string;
  status: AngebotStatus;
  /** Erst beim Senden vergeben */
  angebotsnummer: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  /** Snapshot Steuer-Modus (PDF / Historie) */
  steuermodus: Steuermodus;
  /** Dateiname PDF in PB (leer = keins) */
  pdf: string;
  /** ISO-8601 UTC Zeitpunkt des Sendens */
  gesendet_am: string;
  /** Optional: erzeugte Rechnung nach Übernahme */
  rechnung: string | null;
  created?: string;
  updated?: string;
};

export type AngebotMitPositionen = Angebot & {
  positionen: Angebotsposition[];
};

export type AngebotInput = {
  kunde?: string | null;
  angebotsdatum: string;
  gueltig_bis?: string;
  notiz?: string;
  positionen: AngebotspositionInput[];
};

export type AngebotFilter = {
  q?: string;
  status?: AngebotStatus | "";
  /** YYYY-MM-DD inklusiv (Angebotsdatum) */
  von?: string;
  bis?: string;
  kunde?: string;
};

export type AngebotListResult = {
  items: Angebot[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** Statuswechsel nach Senden (manuell, light) */
export type AngebotStatusZiel =
  | "angenommen"
  | "abgelehnt"
  | "abgelaufen"
  | "abgerechnet";
