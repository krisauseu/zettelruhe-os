import { allTagBlocks, firstTagText, stripXmlNamespaces } from "./parse-utils";
import type { ParsedEInvoice } from "./types";
/** Hints can stop ordinary mapping, but cannot establish a supported RC service. */
export function rcHinweisAusXml(raw: string): boolean {
  const xml = stripXmlNamespaces(raw);
  const structured = [...allTagBlocks(xml, "TaxCategory"), ...allTagBlocks(xml, "ClassifiedTaxCategory")]
    .some(block => firstTagText(block, "ID").toUpperCase() === "AE")
    || allTagBlocks(xml, "ApplicableTradeTax").some(block => firstTagText(block, "CategoryCode").toUpperCase() === "AE");
  return structured || /reverse[\s-]*charge|VATEX-EU-AE|Steuerschuldnerschaft\s+des\s+Leistungsempfängers|§\s*13b/i.test(xml);
}
export function assertEurImport(dto: ParsedEInvoice): void {
  if (!dto.waehrung || !/^[A-Z]{3}$/.test(dto.waehrung)) throw new Error("Rechnungswährung unbekannt oder ungültig. Keine Übernahme als EUR-Beleg; Original prüfen.");
  if (dto.waehrung !== "EUR") throw new Error(`Rechnungswährung ${dto.waehrung} wird nicht unterstützt. Nur nachgewiesene EUR-Rechnungen können als Beleg übernommen werden. Es erfolgt keine Umrechnung.`);
}
export const RC_IMPORT_HINWEIS = "Die E-Rechnung enthält einen Reverse-Charge-Hinweis. Das ist ein Prüfhinweis, keine endgültige Einordnung. Die automatische Übernahme als gewöhnlicher 0-%-Beleg ist gesperrt. Bitte Original prüfen und unter Belege → Beleg anlegen den Dienstleistungsfall, Leistungsabschnitt und Zahlungsnachweis erfassen. Waren und Mischbelege werden nicht unterstützt.";
export function assertOrdinaryEInvoiceImport(dto: ParsedEInvoice): void {
  assertEurImport(dto);
  if (dto.rc_hinweis || /reverse[\s-]*charge|VATEX-EU-AE|Steuerschuldnerschaft\s+des\s+Leistungsempfängers|§\s*13b/i.test(dto.notiz ?? "")) throw new Error(RC_IMPORT_HINWEIS);
}
