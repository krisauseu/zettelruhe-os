import type { RcSnapshot } from "@/modules/expenses/reverse-charge";
/**
 * Domain-Typen: Buchungsjournal (GoBD-Mindeststandard, ADR-0004)
 * Anlegen = Festschreibung; Korrekturen nur über Storno/Gegenbuchung.
 */

/** EÜR-Richtung der Buchung */
export type Buchungsrichtung = "einnahme" | "ausgabe";

/** Herkunft der Buchung (Beleg/Sales/Kasse folgen in späteren Abschnitten) */
export type QuelleTyp =
  | "manuell"
  | "beleg"
  | "rechnung"
  | "zahlung"
  | "kasse"
  | "storno"
  | "system";

export type Steuersatz = "0" | "7" | "19";

/** Festgeschriebener Journal-Eintrag (unveränderbar) */
export type JournalEintrag = {
  rc?: RcSnapshot | null;
  rc_steuerdatum?: string;
  rc_vorgang?: string;
  id: string;
  firma: string;
  /** Fortlaufende Nummer je Firma (bei Festschreibung) */
  laufende_nr: number;
  /** YYYY-MM-DD (steuerlicher Tag, Europe/Berlin) */
  buchungsdatum: string;
  /** YYYY-MM-DD optional */
  belegdatum: string;
  buchungstext: string;
  richtung: Buchungsrichtung;
  /** Geldbeträge als String (decimal.js / ADR-0016) */
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
  konto: string;
  kontakt: string | null;
  quelle_typ: QuelleTyp;
  quelle_id: string;
  /** Verweis auf stornierten Eintrag (bei Gegenbuchung) */
  storno_von: string | null;
  /** ISO-8601 UTC — Zeitpunkt der Festschreibung */
  festgeschrieben_am: string;
  created?: string;
  updated?: string;
};

/**
 * Eingabe für eine neue Buchung (wird mit Anlegen festgeschrieben).
 * Keine Entwürfe — kein Status-Feld.
 */
export type JournalBuchungInput = {
  buchungsdatum: string;
  belegdatum?: string;
  buchungstext: string;
  richtung: Buchungsrichtung;
  /** Brutto- oder Netto-Eingabe je nach Kontext; Repository normalisiert */
  betrag_netto: string;
  betrag_ust?: string;
  betrag_brutto?: string;
  steuersatz?: Steuersatz | "";
  konto?: string;
  kontakt?: string | null;
  quelle_typ?: QuelleTyp;
  quelle_id?: string;
  /** Nur intern bei Storno gesetzt */
  storno_von?: string | null;
};

export type JournalFilter = {
  q?: string;
  richtung?: Buchungsrichtung | "";
  /** YYYY-MM-DD inklusiv */
  von?: string;
  /** YYYY-MM-DD inklusiv */
  bis?: string;
  quelle_typ?: QuelleTyp | "";
};

export type JournalListResult = {
  items: JournalEintrag[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
