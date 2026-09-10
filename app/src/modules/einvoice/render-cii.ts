/**
 * Adapter: EInvoiceOutbound → ZUGFeRD/Factur-X EN-16931 CII-XML (ADR-0022).
 * XML-Original, kein Hybrid-PDF/A-3.
 */

import { ZUGFERD_EN16931_GUIDELINE_ID } from "./outbound";
import type { EInvoiceOutbound } from "./outbound-types";
import { isoToCiiDate, xmlEl } from "./xml";

function dt(iso: string): string {
  return `<udt:DateTimeString format="102">${isoToCiiDate(iso)}</udt:DateTimeString>`;
}

function taxReg(id: string, scheme: "VA" | "FC"): string {
  return `<ram:SpecifiedTaxRegistration>${xmlEl("ram:ID", id, { schemeID: scheme })}</ram:SpecifiedTaxRegistration>`;
}

function tradeParty(
  party: EInvoiceOutbound["verkaeufer"],
  opts: { includeSteuernummer?: boolean; contact?: boolean; endpoint?: boolean },
): string {
  const chunks: string[] = [xmlEl("ram:Name", party.name)];

  if (opts.contact && (party.email || party.telefon)) {
    const c: string[] = [xmlEl("ram:PersonName", party.name)];
    if (party.telefon) {
      c.push(
        `<ram:TelephoneUniversalCommunication>${xmlEl("ram:CompleteNumber", party.telefon)}</ram:TelephoneUniversalCommunication>`,
      );
    }
    if (party.email) {
      c.push(
        `<ram:EmailURIUniversalCommunication>${xmlEl("ram:URIID", party.email)}</ram:EmailURIUniversalCommunication>`,
      );
    }
    chunks.push(`<ram:DefinedTradeContact>${c.join("")}</ram:DefinedTradeContact>`);
  }

  chunks.push(`<ram:PostalTradeAddress>
    ${xmlEl("ram:PostcodeCode", party.plz)}
    ${xmlEl("ram:LineOne", party.strasse)}
    ${xmlEl("ram:CityName", party.ort)}
    ${xmlEl("ram:CountryID", party.land)}
  </ram:PostalTradeAddress>`);

  if (opts.endpoint && party.email) {
    chunks.push(
      `<ram:URIUniversalCommunication>${xmlEl("ram:URIID", party.email, { schemeID: "EM" })}</ram:URIUniversalCommunication>`,
    );
  }

  if (party.ust_id) chunks.push(taxReg(party.ust_id, "VA"));
  if (opts.includeSteuernummer && party.steuernummer) {
    chunks.push(taxReg(party.steuernummer, "FC"));
  }

  return chunks.join("");
}

function tradeTax(opts: {
  basis?: string;
  tax?: string;
  category: string;
  percent: string;
  exemption?: string;
}): string {
  const parts: string[] = [];
  if (opts.tax !== undefined) {
    parts.push(xmlEl("ram:CalculatedAmount", opts.tax));
  }
  parts.push(xmlEl("ram:TypeCode", "VAT"));
  if (opts.exemption) {
    parts.push(xmlEl("ram:ExemptionReason", opts.exemption));
  }
  if (opts.basis !== undefined) {
    parts.push(xmlEl("ram:BasisAmount", opts.basis));
  }
  parts.push(xmlEl("ram:CategoryCode", opts.category));
  parts.push(xmlEl("ram:RateApplicablePercent", opts.percent));
  return `<ram:ApplicableTradeTax>${parts.join("")}</ram:ApplicableTradeTax>`;
}

export function renderZugferdCii(draft: EInvoiceOutbound): string {
  const note = draft.hinweis
    ? `<ram:IncludedNote>${xmlEl("ram:Content", draft.hinweis)}</ram:IncludedNote>`
    : "";

  const lines = draft.positionen
    .map((p) => {
      const percent =
        p.steuersatz === "7" ? "7.00" : p.steuersatz === "19" ? "19.00" : "0.00";
      return `<ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>${xmlEl("ram:LineID", p.id)}</ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>${xmlEl("ram:Name", p.bezeichnung)}</ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>${xmlEl("ram:ChargeAmount", p.einzelpreis)}</ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          ${xmlEl("ram:BilledQuantity", p.menge, { unitCode: p.einheit_code })}
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          ${tradeTax({
            category: p.tax_category,
            percent,
            exemption: p.tax_exemption_reason || undefined,
          })}
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            ${xmlEl("ram:LineTotalAmount", p.betrag_netto)}
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("");

  const headerTax = draft.tax_subtotals
    .map((t) =>
      tradeTax({
        basis: t.basis,
        tax: t.tax,
        category: t.category,
        percent: t.percent,
        exemption: t.exemption_reason || undefined,
      }),
    )
    .join("");

  const period =
    draft.leistungszeitraum_von || draft.leistungszeitraum_bis
      ? `<ram:BillingSpecifiedPeriod>
          ${
            draft.leistungszeitraum_von
              ? `<ram:StartDateTime>${dt(draft.leistungszeitraum_von)}</ram:StartDateTime>`
              : ""
          }
          <ram:EndDateTime>${dt(
            draft.leistungszeitraum_bis ||
              draft.leistungszeitraum_von ||
              draft.rechnungsdatum,
          )}</ram:EndDateTime>
        </ram:BillingSpecifiedPeriod>`
      : "";

  const due = draft.faellig_am
    ? `<ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>${dt(draft.faellig_am)}</ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>`
    : "";

  const bic = draft.bic ? xmlEl("ram:BICID", draft.bic) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      ${xmlEl("ram:ID", ZUGFERD_EN16931_GUIDELINE_ID)}
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    ${xmlEl("ram:ID", draft.rechnungsnummer)}
    ${xmlEl("ram:TypeCode", "380")}
    <ram:IssueDateTime>${dt(draft.rechnungsdatum)}</ram:IssueDateTime>
    ${note}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lines}
    <ram:ApplicableHeaderTradeAgreement>
      ${draft.kaeuferreferenz ? xmlEl("ram:BuyerReference", draft.kaeuferreferenz) : ""}
      <ram:SellerTradeParty>
        ${tradeParty(draft.verkaeufer, {
          includeSteuernummer: true,
          contact: true,
          endpoint: true,
        })}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        ${tradeParty(draft.kaeufer, {
          includeSteuernummer: false,
          contact: false,
          endpoint: true,
        })}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery />
    <ram:ApplicableHeaderTradeSettlement>
      ${xmlEl("ram:InvoiceCurrencyCode", draft.waehrung)}
      <ram:SpecifiedTradeSettlementPaymentMeans>
        ${xmlEl("ram:TypeCode", "58")}
        <ram:PayeePartyCreditorFinancialAccount>
          ${xmlEl("ram:IBANID", draft.iban)}
          ${draft.kontoinhaber ? xmlEl("ram:AccountName", draft.kontoinhaber) : ""}
        </ram:PayeePartyCreditorFinancialAccount>
        ${
          bic
            ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>${bic}</ram:PayeeSpecifiedCreditorFinancialInstitution>`
            : ""
        }
      </ram:SpecifiedTradeSettlementPaymentMeans>
      ${headerTax}
      ${period}
      ${due}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        ${xmlEl("ram:LineTotalAmount", draft.betrag_netto)}
        ${xmlEl("ram:TaxBasisTotalAmount", draft.betrag_netto)}
        ${xmlEl("ram:TaxTotalAmount", draft.betrag_ust, { currencyID: "EUR" })}
        ${xmlEl("ram:GrandTotalAmount", draft.betrag_brutto)}
        ${xmlEl("ram:DuePayableAmount", draft.betrag_brutto)}
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`.replace(/^\s*[\r\n]/gm, "");
}
