/**
 * Adapter: EInvoiceOutbound → XRechnung 3.0 UBL-XML (ADR-0022).
 */

import {
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_PROFILE_ID,
} from "./outbound";
import type { EInvoiceOutbound } from "./outbound-types";
import { xmlEl } from "./xml";

function taxScheme(id: string): string {
  return `<cac:TaxScheme>${xmlEl("cbc:ID", id)}</cac:TaxScheme>`;
}

function taxCategoryXml(opts: {
  id: string;
  percent: string;
  exemption?: string;
}): string {
  const parts = [
    xmlEl("cbc:ID", opts.id),
    xmlEl("cbc:Percent", opts.percent),
  ];
  if (opts.exemption) {
    parts.push(xmlEl("cbc:TaxExemptionReason", opts.exemption));
  }
  parts.push(taxScheme("VAT"));
  return `<cac:TaxCategory>${parts.join("")}</cac:TaxCategory>`;
}

function partyXml(
  party: EInvoiceOutbound["verkaeufer"],
  opts: { endpoint?: string; includeSteuernummer?: boolean; contact?: boolean },
): string {
  const chunks: string[] = [];
  if (opts.endpoint) {
    chunks.push(xmlEl("cbc:EndpointID", opts.endpoint, { schemeID: "EM" }));
  }
  chunks.push(
    `<cac:PartyName>${xmlEl("cbc:Name", party.name)}</cac:PartyName>`,
  );
  chunks.push(`<cac:PostalAddress>
    ${xmlEl("cbc:StreetName", party.strasse)}
    ${xmlEl("cbc:CityName", party.ort)}
    ${xmlEl("cbc:PostalZone", party.plz)}
    <cac:Country>${xmlEl("cbc:IdentificationCode", party.land)}</cac:Country>
  </cac:PostalAddress>`);

  if (party.ust_id) {
    chunks.push(`<cac:PartyTaxScheme>
      ${xmlEl("cbc:CompanyID", party.ust_id)}
      ${taxScheme("VAT")}
    </cac:PartyTaxScheme>`);
  }
  if (opts.includeSteuernummer && party.steuernummer) {
    chunks.push(`<cac:PartyTaxScheme>
      ${xmlEl("cbc:CompanyID", party.steuernummer)}
      ${taxScheme("FC")}
    </cac:PartyTaxScheme>`);
  }

  const legal: string[] = [xmlEl("cbc:RegistrationName", party.name)];
  if (party.ust_id) {
    legal.push(xmlEl("cbc:CompanyID", party.ust_id));
  } else if (party.steuernummer) {
    legal.push(xmlEl("cbc:CompanyID", party.steuernummer));
  }
  chunks.push(`<cac:PartyLegalEntity>${legal.join("")}</cac:PartyLegalEntity>`);

  if (opts.contact && (party.email || party.telefon || party.name)) {
    const c: string[] = [xmlEl("cbc:Name", party.name)];
    if (party.telefon) c.push(xmlEl("cbc:Telephone", party.telefon));
    if (party.email) c.push(xmlEl("cbc:ElectronicMail", party.email));
    chunks.push(`<cac:Contact>${c.join("")}</cac:Contact>`);
  }

  return `<cac:Party>${chunks.join("")}</cac:Party>`;
}

export function renderXRechnungUbl(draft: EInvoiceOutbound): string {
  const notes: string[] = [];
  if (draft.hinweis) notes.push(xmlEl("cbc:Note", draft.hinweis));

  const period =
    draft.leistungszeitraum_von || draft.leistungszeitraum_bis
      ? `<cac:InvoicePeriod>
          ${draft.leistungszeitraum_von ? xmlEl("cbc:StartDate", draft.leistungszeitraum_von) : ""}
          ${xmlEl(
            "cbc:EndDate",
            draft.leistungszeitraum_bis ||
              draft.leistungszeitraum_von ||
              draft.rechnungsdatum,
          )}
        </cac:InvoicePeriod>`
      : "";

  const taxSubtotals = draft.tax_subtotals
    .map(
      (t) => `<cac:TaxSubtotal>
        ${xmlEl("cbc:TaxableAmount", t.basis, { currencyID: "EUR" })}
        ${xmlEl("cbc:TaxAmount", t.tax, { currencyID: "EUR" })}
        ${taxCategoryXml({
          id: t.category,
          percent: t.percent,
          exemption: t.exemption_reason || undefined,
        })}
      </cac:TaxSubtotal>`,
    )
    .join("");

  const lines = draft.positionen
    .map((p) => `<cac:InvoiceLine>
        ${xmlEl("cbc:ID", p.id)}
        ${xmlEl("cbc:InvoicedQuantity", p.menge, { unitCode: p.einheit_code })}
        ${xmlEl("cbc:LineExtensionAmount", p.betrag_netto, { currencyID: "EUR" })}
        <cac:Item>
          ${xmlEl("cbc:Name", p.bezeichnung)}
          <cac:ClassifiedTaxCategory>
            ${xmlEl("cbc:ID", p.tax_category)}
            ${xmlEl("cbc:Percent", moneyPercent(p.steuersatz))}
            ${p.tax_exemption_reason ? xmlEl("cbc:TaxExemptionReason", p.tax_exemption_reason) : ""}
            ${taxScheme("VAT")}
          </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
          ${xmlEl("cbc:PriceAmount", p.einzelpreis, { currencyID: "EUR" })}
        </cac:Price>
      </cac:InvoiceLine>`)
    .join("");

  const bic = draft.bic
    ? `<cac:FinancialInstitutionBranch>${xmlEl("cbc:ID", draft.bic)}</cac:FinancialInstitutionBranch>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  ${xmlEl("cbc:CustomizationID", XRECHNUNG_CUSTOMIZATION_ID)}
  ${xmlEl("cbc:ProfileID", XRECHNUNG_PROFILE_ID)}
  ${xmlEl("cbc:ID", draft.rechnungsnummer)}
  ${xmlEl("cbc:IssueDate", draft.rechnungsdatum)}
  ${draft.faellig_am ? xmlEl("cbc:DueDate", draft.faellig_am) : ""}
  ${xmlEl("cbc:InvoiceTypeCode", "380")}
  ${notes.join("")}
  ${xmlEl("cbc:DocumentCurrencyCode", draft.waehrung)}
  ${draft.kaeuferreferenz ? xmlEl("cbc:BuyerReference", draft.kaeuferreferenz) : ""}
  ${period}
  <cac:AccountingSupplierParty>
    ${partyXml(draft.verkaeufer, {
      endpoint: draft.verkaeufer.email,
      includeSteuernummer: true,
      contact: true,
    })}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    ${partyXml(draft.kaeufer, {
      endpoint: draft.kaeufer.email,
      includeSteuernummer: false,
      contact: false,
    })}
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    ${xmlEl("cbc:PaymentMeansCode", "58")}
    <cac:PayeeFinancialAccount>
      ${xmlEl("cbc:ID", draft.iban)}
      ${draft.kontoinhaber ? xmlEl("cbc:Name", draft.kontoinhaber) : ""}
      ${bic}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  ${
    draft.faellig_am
      ? `<cac:PaymentTerms>${xmlEl("cbc:Note", `Zahlbar bis ${draft.faellig_am}`)}</cac:PaymentTerms>`
      : ""
  }
  <cac:TaxTotal>
    ${xmlEl("cbc:TaxAmount", draft.betrag_ust, { currencyID: "EUR" })}
    ${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    ${xmlEl("cbc:LineExtensionAmount", draft.betrag_netto, { currencyID: "EUR" })}
    ${xmlEl("cbc:TaxExclusiveAmount", draft.betrag_netto, { currencyID: "EUR" })}
    ${xmlEl("cbc:TaxInclusiveAmount", draft.betrag_brutto, { currencyID: "EUR" })}
    ${xmlEl("cbc:PayableAmount", draft.betrag_brutto, { currencyID: "EUR" })}
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>
`.replace(/^\s*[\r\n]/gm, "");
}

function moneyPercent(satz: string): string {
  if (satz === "7") return "7.00";
  if (satz === "19") return "19.00";
  return "0.00";
}
