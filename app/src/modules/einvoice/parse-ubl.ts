import { rcHinweisAusXml } from "./import-grenzen";
/**
 * Adapter: XRechnung / UBL-XML → ParsedEInvoice (ADR-0015).
 * Production path für BA12.
 */

import {
  allTagBlocks,
  detectXmlFormat,
  firstTagBlock,
  firstTagText,
  mapTaxPercentToSteuersatz,
  normalizeEInvoiceAmount,
  normalizeEInvoiceDate,
  stripXmlNamespaces,
} from "./parse-utils";
import type { ParsedEInvoice, ParsedEInvoiceLine, ParseEInvoiceResult } from "./types";

export function parseUblXml(xmlRaw: string): ParseEInvoiceResult {
  try {
    const xml = stripXmlNamespaces(xmlRaw);
    const format = detectXmlFormat(xmlRaw);
    if (format === "zugferd_cii") {
      return {
        ok: false,
        error: "CII-XML bitte über CII-Adapter parsen.",
        format: "zugferd_cii",
      };
    }

    // UBL Invoice root erwartet
    if (!/<Invoice[\s>]/i.test(xml) && !xmlRaw.toLowerCase().includes("ubl")) {
      // manches XRechnung hat Invoice ohne Namespace-Hinweis nach Strip
      if (!firstTagText(xml, "ID") && !firstTagText(xml, "IssueDate")) {
        return {
          ok: false,
          error: "Kein UBL-Invoice-Dokument erkannt.",
          format: "unbekannt",
        };
      }
    }

    const rechnungsnummer = firstTagText(xml, "ID");
    // IssueDate ist Kopf-Datum; erste ID kann Invoice-ID sein — Prefer Invoice/ID via Header
    // Nach Strip: mehrere ID-Tags. XRechnung: Invoice/ID ist typisch vor IssueDate.
    const issueDate = firstTagText(xml, "IssueDate");
    const rechnungsdatum = normalizeEInvoiceDate(issueDate);

    // Bessere ID: vor AccountingSupplierParty, erstes ID nach CustomizationID/ProfileID
    const header = xml.slice(0, xml.indexOf("AccountingSupplierParty") > 0
      ? xml.indexOf("AccountingSupplierParty")
      : 4000);
    const headerIds = [...header.matchAll(/<ID(?:\s[^>]*)?>([\s\S]*?)<\/ID>/gi)].map(
      (m) => m[1].replace(/<[^>]+>/g, "").trim(),
    );
    // Skip UUID-like customization — Invoice ID oft kürzer / alphanumerisch
    let invId = rechnungsnummer;
    for (const id of headerIds) {
      if (/^[0-9A-Za-z][0-9A-Za-z._\-\/]{0,40}$/.test(id) && !id.includes(":")) {
        invId = id;
        break;
      }
    }
    // Wenn CustomizationID-ähnlich (URN), nimm letztes sinnvolles ID im Header
    if (invId.includes(":") || invId.length > 50) {
      const candidates = headerIds.filter(
        (id) => id && !id.includes(":") && id.length <= 40,
      );
      if (candidates.length) invId = candidates[candidates.length - 1];
    }

    const due = firstTagText(xml, "DueDate");
    const faelligkeitsdatum = normalizeEInvoiceDate(due) || undefined;

    const currency =
      firstTagText(xml, "DocumentCurrencyCode");

    // Supplier
    const supplierBlock =
      firstTagBlock(xml, "AccountingSupplierParty") ||
      firstTagBlock(xml, "SellerSupplierParty");
    const supplierParty = firstTagBlock(supplierBlock, "Party") || supplierBlock;
    const lieferantName =
      firstTagText(supplierParty, "RegistrationName") ||
      firstTagText(supplierParty, "Name") ||
      "";
    const lieferantUst =
      firstTagText(supplierParty, "CompanyID") ||
      (() => {
        const tax = firstTagBlock(supplierParty, "PartyTaxScheme");
        return firstTagText(tax, "CompanyID");
      })();
    const postal = firstTagBlock(supplierParty, "PostalAddress");
    const strasse =
      firstTagText(postal, "StreetName") ||
      firstTagText(postal, "AddressLine");
    const plz = firstTagText(postal, "PostalZone");
    const ort = firstTagText(postal, "CityName");
    const land =
      firstTagText(postal, "IdentificationCode") ||
      firstTagText(postal, "Country");

    // Payment means IBAN light
    const payment = firstTagBlock(xml, "PaymentMeans");
    const iban =
      firstTagText(payment, "ID") ||
      firstTagText(firstTagBlock(payment, "PayeeFinancialAccount"), "ID");

    // Customer (optional)
    const customerBlock = firstTagBlock(xml, "AccountingCustomerParty");
    const customerParty = firstTagBlock(customerBlock, "Party") || customerBlock;
    const empfaengerName =
      firstTagText(customerParty, "RegistrationName") ||
      firstTagText(customerParty, "Name") ||
      "";

    // Monetary totals
    const legal = firstTagBlock(xml, "LegalMonetaryTotal");
    const taxTotal = firstTagBlock(xml, "TaxTotal");
    let betrag_netto =
      normalizeEInvoiceAmount(firstTagText(legal, "TaxExclusiveAmount")) ||
      normalizeEInvoiceAmount(firstTagText(legal, "LineExtensionAmount"));
    let betrag_brutto =
      normalizeEInvoiceAmount(firstTagText(legal, "TaxInclusiveAmount")) ||
      normalizeEInvoiceAmount(firstTagText(legal, "PayableAmount"));
    let betrag_ust =
      normalizeEInvoiceAmount(firstTagText(taxTotal, "TaxAmount")) || "";

    const taxSub = firstTagBlock(taxTotal, "TaxSubtotal");
    const percent = firstTagText(
      firstTagBlock(taxSub, "TaxCategory") || taxSub,
      "Percent",
    );
    const steuersatz = mapTaxPercentToSteuersatz(percent);

    if (!betrag_ust && betrag_netto && betrag_brutto) {
      // Differenz
      const n = Number.parseFloat(betrag_netto);
      const b = Number.parseFloat(betrag_brutto);
      if (!Number.isNaN(n) && !Number.isNaN(b) && b >= n) {
        betrag_ust = (b - n).toFixed(2);
      }
    }

    // Lines light
    const lineBlocks = allTagBlocks(xml, "InvoiceLine");
    const positionen: ParsedEInvoiceLine[] = lineBlocks.slice(0, 50).map((lb) => {
      const item = firstTagBlock(lb, "Item");
      const text =
        firstTagText(item, "Name") ||
        firstTagText(item, "Description") ||
        firstTagText(lb, "Note") ||
        "Position";
      const menge = firstTagText(lb, "InvoicedQuantity");
      const price = firstTagBlock(lb, "Price");
      const einzelpreis = normalizeEInvoiceAmount(
        firstTagText(price, "PriceAmount"),
      );
      const netto = normalizeEInvoiceAmount(
        firstTagText(lb, "LineExtensionAmount"),
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
        error: "UBL: Keine Beträge (LegalMonetaryTotal) gefunden.",
        format: "xrechnung_ubl",
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
        error: "UBL: Rechnungsdatum (IssueDate) fehlt oder ungültig.",
        format: "xrechnung_ubl",
      };
    }

    const dto: ParsedEInvoice = {
      format: "xrechnung_ubl",
      rechnungsnummer: (invId || rechnungsnummer || "").slice(0, 80),
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
      notiz: undefined,
    };

    return { ok: true, data: dto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "UBL-Parse fehlgeschlagen.",
      format: "xrechnung_ubl",
    };
  }
}
