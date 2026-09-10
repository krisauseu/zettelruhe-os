/**
 * Domain-Typen: E-Rechnung Empfang
 * Stabiles DTO (ADR-0015) + Persistenz-Typen für Inbox.
 * Kein Parser-Lib-Lock-in. Versand-Typen: outbound-types.ts (ADR-0022).
 */

import type { BelegInput, Steuersatz } from "@/modules/expenses/types";

/** Erkanntes E-Rechnungs-Format (light) */
export type EInvoiceFormat =
  | "xrechnung_ubl"
  | "zugferd_cii"
  | "unbekannt";

/** Parse-Ergebnis am Inbox-Datensatz */
export type EInvoiceParseStatus = "ok" | "fehler";

/** Workflow-Status Empfang (Festschreibung nur über Beleg/expenses) */
export type ERechnungEmpfangStatus = "neu" | "beleg_erstellt" | "archiviert";

/** Lieferant:in / Verkäufer:in aus der E-Rechnung (DTO, kein Kontakt-ID) */
export type ParsedEInvoiceParty = {
  name: string;
  ust_id?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  iban?: string;
};

/** Optionale Positionszeile (Vorschau light) */
export type ParsedEInvoiceLine = {
  text: string;
  menge?: string;
  einzelpreis?: string;
  netto?: string;
};

/**
 * Stabiles internes DTO nach Parse (ADR-0015).
 * Domain und Beleg-Mapping hängen nur an diesem Typ — nicht an XML-Lib.
 * Beträge als normalisierte Strings "12.34" (ADR-0016).
 */
export type ParsedEInvoice = {
  format: EInvoiceFormat;
  rechnungsnummer: string;
  /** YYYY-MM-DD */
  rechnungsdatum: string;
  /** YYYY-MM-DD optional */
  faelligkeitsdatum?: string;
  /** Empty means unknown; never default to EUR. */
  waehrung: string;
  /** Review hint only, no determination of service type or German rate. */
  rc_hinweis?: boolean;
  lieferant: ParsedEInvoiceParty;
  empfaenger?: ParsedEInvoiceParty;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz?: Steuersatz | "";
  positionen?: ParsedEInvoiceLine[];
  /** Freitext / Hinweise aus dem Dokument */
  notiz?: string;
};

/** Ergebnis des Parser-Adapters */
export type ParseEInvoiceResult =
  | { ok: true; data: ParsedEInvoice }
  | { ok: false; error: string; format?: EInvoiceFormat };

/** Persistierter Empfangs-Datensatz (Inbox) */
export type ERechnungEmpfang = {
  id: string;
  firma: string;
  /** Dateiname in PB (leer = keine Datei — sollte nicht vorkommen) */
  original_datei: string;
  original_dateiname: string;
  format: EInvoiceFormat;
  parse_status: EInvoiceParseStatus;
  parse_fehler: string;
  /** Deserialisiertes DTO wenn parse_status=ok */
  geparst: ParsedEInvoice | null;
  rechnungsnummer: string;
  rechnungsdatum: string;
  lieferant_name: string;
  betrag_brutto: string;
  status: ERechnungEmpfangStatus;
  /** Relation Beleg nach „Beleg-Entwurf anlegen“ */
  beleg: string | null;
  /** ISO-8601 UTC */
  empfangen_am: string;
  notiz: string;
  created?: string;
  updated?: string;
};

export type ERechnungEmpfangFilter = {
  q?: string;
  status?: ERechnungEmpfangStatus | "";
  parse_status?: EInvoiceParseStatus | "";
};

export type ERechnungEmpfangListResult = {
  items: ERechnungEmpfang[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** Mapping-Kontext: Steuer-Modus + optional gematchter Kontakt */
export type MapToBelegOptions = {
  steuermodus: "kleinunternehmer" | "regelbesteuerung_ist";
  /** Kontakt-ID wenn light-Match erfolgreich */
  lieferantId?: string | null;
};

export type { BelegInput };
