/**
 * Ausgangs-DTO für E-Rechnungs-Versand (ADR-0015 / ADR-0022).
 * Domain und Renderer hängen nur hieran — nicht an UBL/CII-Details.
 */

import type { Steuermodus } from "@/lib/pb";
import type { EInvoiceFormat } from "./types";

/** Wählbare Versand-Profile (kein Hybrid-PDF) */
export type EInvoiceSendProfil = Extract<
  EInvoiceFormat,
  "xrechnung_ubl" | "zugferd_cii"
>;

/** UNTDID 5305 — nur was wir ehrlich setzen */
export type EInvoiceTaxCategory = "S" | "E";

export type EInvoiceOutboundParty = {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  ust_id: string;
  steuernummer: string;
  email: string;
  telefon: string;
};

export type EInvoiceOutboundLine = {
  id: string;
  bezeichnung: string;
  menge: string;
  einheit_code: string;
  einheit_name: string;
  einzelpreis: string;
  betrag_netto: string;
  steuersatz: "0" | "7" | "19";
  tax_category: EInvoiceTaxCategory;
  tax_exemption_reason: string;
};

export type EInvoiceOutboundTaxSubtotal = {
  category: EInvoiceTaxCategory;
  percent: string;
  basis: string;
  tax: string;
  exemption_reason: string;
};

/**
 * Vollständiger Versand-Schnappschuss.
 * Beträge als "12.34" (ADR-0016).
 */
export type EInvoiceOutbound = {
  profil: EInvoiceSendProfil;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faellig_am: string;
  leistungszeitraum_von: string;
  leistungszeitraum_bis: string;
  waehrung: "EUR";
  /** BT-10: Leitweg-ID oder Käuferreferenz */
  kaeuferreferenz: string;
  hinweis: string;
  steuermodus: Steuermodus;
  verkaeufer: EInvoiceOutboundParty;
  kaeufer: EInvoiceOutboundParty;
  iban: string;
  bic: string;
  kontoinhaber: string;
  positionen: EInvoiceOutboundLine[];
  tax_subtotals: EInvoiceOutboundTaxSubtotal[];
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

export type EInvoiceValidationIssue = {
  code: string;
  feld: string;
  message: string;
};

export type EInvoicePrepareResult = {
  draft: EInvoiceOutbound;
  issues: EInvoiceValidationIssue[];
};

/** Persistierter Versand-Datensatz */
export type ERechnungVersand = {
  id: string;
  firma: string;
  rechnung: string;
  profil: EInvoiceSendProfil;
  original_datei: string;
  original_dateiname: string;
  iban: string;
  erzeugt_am: string;
  notiz: string;
  created?: string;
  updated?: string;
};
