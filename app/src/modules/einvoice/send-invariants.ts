/**
 * Invarianten E-Rechnungs-Versand (ohne I/O).
 * Original je Profil einmal; Rechnungs-PDF nie anfassen (ADR-0012 / ADR-0022).
 */

import { isFestgeschrieben } from "@/modules/sales/invariants";
import type { Rechnung } from "@/modules/sales/types";
import type { EInvoiceOutbound, EInvoiceSendProfil } from "./outbound-types";
import { renderZugferdCii } from "./render-cii";
import { renderXRechnungUbl } from "./render-ubl";

export const VERSAND_BEREITS_ERROR =
  "Für dieses Profil liegt bereits eine E-Rechnung vor. Das Original wird nicht überschrieben.";

export const VERSAND_NUR_FESTGESCHRIEBEN_ERROR =
  "E-Rechnung nur aus einer festgeschriebenen Rechnung. Bitte zuerst festschreiben.";

export const VERSAND_ORIGINAL_IMMUTABLE_ERROR =
  "Das E-Rechnungs-Original ist nach der Erzeugung unveränderbar (ADR-0012).";

export function assertCanErzeugenVersand(
  rechnung: Pick<Rechnung, "status" | "rechnungsnummer">,
  existingForProfil: boolean,
): void {
  if (!isFestgeschrieben(rechnung)) {
    throw new Error(VERSAND_NUR_FESTGESCHRIEBEN_ERROR);
  }
  if (!rechnung.rechnungsnummer) {
    throw new Error(
      "Ohne Rechnungsnummer keine E-Rechnung (Nummern erst bei Festschreibung).",
    );
  }
  if (existingForProfil) {
    throw new Error(VERSAND_BEREITS_ERROR);
  }
}

export function renderEInvoiceXml(draft: EInvoiceOutbound): string {
  if (draft.profil === "xrechnung_ubl") {
    return renderXRechnungUbl(draft);
  }
  return renderZugferdCii(draft);
}

export function versandDateiname(
  rechnungsnummer: string,
  profil: EInvoiceSendProfil,
): string {
  const n = (rechnungsnummer || "Rechnung").replace(/[^\w.\-]+/g, "_");
  return profil === "xrechnung_ubl"
    ? `${n}-xrechnung.xml`
    : `${n}-zugferd.xml`;
}

export function erzeugtAmUtc(now: Date = new Date()): string {
  return now.toISOString();
}
