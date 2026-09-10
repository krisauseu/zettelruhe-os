import { rcHinweisAusXml } from "./import-grenzen";
/**
 * Adapter: ZUGFeRD/Factur-X CII-XML → ParsedEInvoice (ADR-0015).
 * Light: Header + Totals + Seller; kein vollständiges EN-16931-Profil.
 */

import {
  allTagBlocks,
  firstTagBlock,
  firstTagText,
  mapTaxPercentToSteuersatz,
  normalizeEInvoiceAmount,
  normalizeEInvoiceDate,
  stripXmlNamespaces,
} from "./parse-utils";
import type { ParsedEInvoice, ParsedEInvoiceLine, ParseEInvoiceResult } from "./types";

export function parseCiiXml(xmlRaw: string): ParseEInvoiceResult {
  try {
    const xml = stripXmlNamespaces(xmlRaw);

    if (
      !xmlRaw.toLowerCase().includes("crossindustryinvoice") &&
      !xml.toLowerCase().includes("exchangeddocument")
    ) {
      return {
        ok: false,
        error: "Kein CII/ZUGFeRD-Dokument erkannt.",
        format: "unbekannt",
      };
    }

    const exchanged = firstTagBlock(xml, "ExchangedDocument");
    const rechnungsnummer = firstTagText(exchanged, "ID");
    const issueDateTime = firstTagBlock(exchanged, "IssueDateTime");
    const dateTimeString =
      firstTagText(issueDateTime, "DateTimeString") ||
      firstTagText(exchanged, "DateTimeString");
    const rechnungsdatum = normalizeEInvoiceDate(dateTimeString);

    // Seller trade party
    const seller =
      firstTagBlock(xml, "SellerTradeParty") ||
      (() => {
        const agreement = firstTagBlock(xml, "ApplicableHeaderTradeAgreement");
        return firstTagBlock(agreement, "SellerTradeParty");
      })();
    const lieferantName = firstTagText(seller, "Name");
    const taxReg = firstTagBlock(seller, "SpecifiedTaxRegistration");
    const lieferantUst = firstTagText(taxReg, "ID");
    const postal = firstTagBlock(seller, "PostalTradeAddress");
    const strasse = firstTagText(postal, "LineOne");
    const plz = firstTagText(postal, "PostcodeCode");
    const ort = firstTagText(postal, "CityName");
    const land = firstTagText(postal, "CountryID");

    // Buyer
    const buyer =
      firstTagBlock(xml, "BuyerTradeParty") ||
      firstTagBlock(
        firstTagBlock(xml, "ApplicableHeaderTradeAgreement"),
        "BuyerTradeParty",
      );
    const empfaengerName = firstTagText(buyer, "Name");

    // Settlement monetary summation
    const settlement = firstTagBlock(xml, "ApplicableHeaderTradeSettlement");
    const sum =
      firstTagBlock(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation") ||
      firstTagBlock(xml, "SpecifiedTradeSettlementHeaderMonetarySummation");

    let betrag_netto = normalizeEInvoiceAmount(
      firstTagText(sum, "TaxBasisTotalAmount") ||
        firstTagText(sum, "LineTotalAmount"),
    );
    let betrag_brutto = normalizeEInvoiceAmount(
      firstTagText(sum, "GrandTotalAmount") ||
        firstTagText(sum, "DuePayableAmount"),
    );
    let betrag_ust = normalizeEInvoiceAmount(firstTagText(sum, "TaxTotalAmount"));

    const tax = firstTagBlock(settlement, "ApplicableTradeTax");
    const percent = firstTagText(tax, "RateApplicablePercent");
    const steuersatz = mapTaxPercentToSteuersatz(percent);
    if (!betrag_ust) {
      betrag_ust = normalizeEInvoiceAmount(firstTagText(tax, "CalculatedAmount"));
    }

    const currency =
      firstTagText(settlement, "InvoiceCurrencyCode");

    // IBAN
    const payment = firstTagBlock(settlement, "SpecifiedTradeSettlementPaymentMeans");
    const iban =
      firstTagText(firstTagBlock(payment, "PayeePartyCreditorFinancialAccount"), "IBANID") ||
      firstTagText(payment, "IBANID");

    // Due date
    const paymentTerms = firstTagBlock(settlement, "SpecifiedTradePaymentTerms");
    const dueBlock = firstTagBlock(paymentTerms, "DueDateDateTime");
    const faelligkeitsdatum =
      normalizeEInvoiceDate(firstTagText(dueBlock, "DateTimeString")) ||
      undefined;

    // Lines
    const lineBlocks = allTagBlocks(xml, "IncludedSupplyChainTradeLineItem");
    const positionen: ParsedEInvoiceLine[] = lineBlocks.slice(0, 50).map((lb) => {
      const product = firstTagBlock(lb, "SpecifiedTradeProduct");
      const text =
        firstTagText(product, "Name") ||
        firstTagText(product, "Description") ||
        "Position";
      const delivery = firstTagBlock(lb, "SpecifiedLineTradeDelivery");
      const menge = firstTagText(delivery, "BilledQuantity");
      const agreement = firstTagBlock(lb, "SpecifiedLineTradeAgreement");
      const price = firstTagBlock(agreement, "NetPriceProductTradePrice");
      const einzelpreis = normalizeEInvoiceAmount(
        firstTagText(price, "ChargeAmount"),
      );
      const settlementLine = firstTagBlock(lb, "SpecifiedLineTradeSettlement");
      const lineSum = firstTagBlock(
        settlementLine,
        "SpecifiedTradeSettlementLineMonetarySummation",
      );
      const netto = normalizeEInvoiceAmount(
        firstTagText(lineSum, "LineTotalAmount"),
      );
      return {
        text: text.slice(0, 200),
        menge: menge || undefined,
        einzelpreis: einzelpreis || undefined,
        netto: netto || undefined,
      };
    });

    if (!betrag_brutto && !betrag_netto) {
      return {
        ok: false,
        error: "CII: Keine Beträge (MonetarySummation) gefunden.",
        format: "zugferd_cii",
      };
    }
    if (!betrag_brutto && betrag_netto) {
      betrag_brutto = betrag_netto;
      if (!betrag_ust) betrag_ust = "0.00";
    }
    if (!betrag_netto && betrag_brutto) {
      betrag_netto = betrag_brutto;
      if (!betrag_ust) betrag_ust = "0.00";
    }
    if (!betrag_ust) betrag_ust = "0.00";

    if (!rechnungsdatum) {
      return {
        ok: false,
        error: "CII: Rechnungsdatum fehlt oder ungültig.",
        format: "zugferd_cii",
      };
    }

    const dto: ParsedEInvoice = {
      format: "zugferd_cii",
      rechnungsnummer: (rechnungsnummer || "").slice(0, 80),
      rechnungsdatum,
      faelligkeitsdatum,
      waehrung: currency.trim().toUpperCase(),
      rc_hinweis: rcHinweisAusXml(xmlRaw),
      lieferant: {
        name: lieferantName.slice(0, 200) || "Unbekannt",
        ust_id: lieferantUst || undefined,
        strasse: strasse || undefined,
        plz: plz || undefined,
        ort: ort || undefined,
        land: land ? land.slice(0, 2).toUpperCase() : undefined,
        iban: iban || undefined,
      },
      empfaenger: empfaengerName
        ? { name: empfaengerName.slice(0, 200) }
        : undefined,
      betrag_netto,
      betrag_ust,
      betrag_brutto,
      steuersatz: steuersatz || "",
      positionen: positionen.length ? positionen : undefined,
    };

    return { ok: true, data: dto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "CII-Parse fehlgeschlagen.",
      format: "zugferd_cii",
    };
  }
}
