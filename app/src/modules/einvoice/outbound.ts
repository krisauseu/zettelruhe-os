/**
 * Baut EInvoiceOutbound aus Rechnung + Stammdaten (ohne I/O, ADR-0022).
 * Validierung liegt in validate-outbound.ts.
 */

import { money, moneyToString, roundMoney, sumMoney } from "@/lib/money";
import type { FirmaRecord, Steuermodus } from "@/lib/pb";
import type { Kontakt } from "@/modules/contacts/types";
import type { Bankkonto } from "@/modules/banking/types";
import { KLEINUNTERNEHMER_HINWEIS } from "@/modules/sales/invariants";
import type {
  Rechnung,
  Rechnungsposition,
  Steuersatz,
} from "@/modules/sales/types";
import type {
  EInvoiceOutbound,
  EInvoiceOutboundLine,
  EInvoiceOutboundParty,
  EInvoiceOutboundTaxSubtotal,
  EInvoiceSendProfil,
  EInvoiceTaxCategory,
} from "./outbound-types";

export const XRECHNUNG_CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";

export const XRECHNUNG_PROFILE_ID =
  "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

export const ZUGFERD_EN16931_GUIDELINE_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931";

/** 0-% unter Regelbesteuerung: nicht als Reverse Charge geraten. */
export const STEUERSATZ_0_HINWEIS =
  "Steuersatz 0 % — Art (Reverse Charge / steuerfrei) nicht automatisch ermittelt.";

const EINHEIT_CODES: Array<{ match: RegExp; code: string }> = [
  { match: /^(stunde|stunden|std\.?|h)$/i, code: "HUR" },
  { match: /^(km|kilometer)$/i, code: "KMT" },
  { match: /^(karton|kartons|kt)$/i, code: "CT" },
  { match: /^(tag|tage|d)$/i, code: "DAY" },
  { match: /^(stück|stueck|stk\.?|st\.?|artikel|pauschal)$/i, code: "C62" },
];

export function mapEinheitToUnece(einheit: string): {
  code: string;
  name: string;
} {
  const name = (einheit ?? "").trim();
  if (!name) return { code: "C62", name: "Stück" };
  for (const row of EINHEIT_CODES) {
    if (row.match.test(name)) return { code: row.code, name };
  }
  return { code: "C62", name };
}

export function parseSendProfil(raw: string): EInvoiceSendProfil | "" {
  if (raw === "xrechnung_ubl" || raw === "zugferd_cii") return raw;
  return "";
}

function partyFromFirma(firma: FirmaRecord): EInvoiceOutboundParty {
  return {
    name: (firma.name ?? "").trim(),
    strasse: (firma.strasse ?? "").trim(),
    plz: (firma.plz ?? "").trim(),
    ort: (firma.ort ?? "").trim(),
    land: ((firma.land ?? "DE").trim().toUpperCase() || "DE").slice(0, 2),
    ust_id: (firma.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
    steuernummer: (firma.steuernummer ?? "").trim(),
    email: (firma.email ?? "").trim(),
    telefon: (firma.telefon ?? "").trim(),
  };
}

function partyFromKontakt(kunde: Kontakt): EInvoiceOutboundParty {
  return {
    name: (kunde.name ?? "").trim(),
    strasse: (kunde.strasse ?? "").trim(),
    plz: (kunde.plz ?? "").trim(),
    ort: (kunde.ort ?? "").trim(),
    land: ((kunde.land ?? "DE").trim().toUpperCase() || "DE").slice(0, 2),
    ust_id: (kunde.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
    steuernummer: "",
    email: (kunde.email ?? "").trim(),
    telefon: (kunde.telefon ?? "").trim(),
  };
}

function lineTax(
  position: Rechnungsposition,
  steuermodus: Steuermodus,
): {
  steuersatz: "0" | "7" | "19";
  tax_category: EInvoiceTaxCategory;
  tax_exemption_reason: string;
} {
  if (steuermodus === "kleinunternehmer") {
    return {
      steuersatz: "0",
      tax_category: "E",
      tax_exemption_reason: KLEINUNTERNEHMER_HINWEIS,
    };
  }

  const satz: Steuersatz | "" = position.steuersatz;
  if (satz === "7" || satz === "19") {
    return {
      steuersatz: satz,
      tax_category: "S",
      tax_exemption_reason: "",
    };
  }

  return {
    steuersatz: "0",
    tax_category: "E",
    tax_exemption_reason: STEUERSATZ_0_HINWEIS,
  };
}

function buildTaxSubtotals(
  lines: EInvoiceOutboundLine[],
  steuermodus: Steuermodus,
): EInvoiceOutboundTaxSubtotal[] {
  const buckets = new Map<
    string,
    {
      category: EInvoiceTaxCategory;
      percent: string;
      basis: ReturnType<typeof money>;
      tax: ReturnType<typeof money>;
      exemption_reason: string;
    }
  >();

  for (const line of lines) {
    const percent = moneyToString(line.steuersatz);
    const key = `${line.tax_category}:${percent}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.basis = existing.basis.plus(money(line.betrag_netto));
      existing.tax = existing.tax.plus(
        roundMoney(
          money(line.betrag_netto).times(money(line.steuersatz)).dividedBy(100),
        ),
      );
    } else {
      buckets.set(key, {
        category: line.tax_category,
        percent,
        basis: money(line.betrag_netto),
        tax: roundMoney(
          money(line.betrag_netto).times(money(line.steuersatz)).dividedBy(100),
        ),
        exemption_reason: line.tax_exemption_reason,
      });
    }
  }

  if (steuermodus === "kleinunternehmer" && buckets.size === 0) {
    return [
      {
        category: "E",
        percent: "0.00",
        basis: "0.00",
        tax: "0.00",
        exemption_reason: KLEINUNTERNEHMER_HINWEIS,
      },
    ];
  }

  return [...buckets.values()].map((b) => ({
    category: b.category,
    percent: moneyToString(b.percent),
    basis: moneyToString(roundMoney(b.basis)),
    tax:
      b.category === "E"
        ? "0.00"
        : moneyToString(roundMoney(b.tax)),
    exemption_reason: b.exemption_reason,
  }));
}

export type BuildOutboundInput = {
  profil: EInvoiceSendProfil;
  rechnung: Rechnung;
  positionen: Rechnungsposition[];
  firma: FirmaRecord;
  kunde: Kontakt;
  bankkonto: Pick<Bankkonto, "iban" | "bic" | "name" | "kontoinhaber"> | null;
};

/** Mappt Stammdaten + Rechnung auf das Versand-DTO (auch unvollständig). */
export function buildEInvoiceOutbound(input: BuildOutboundInput): EInvoiceOutbound {
  const { profil, rechnung, positionen, firma, kunde, bankkonto } = input;
  const steuermodus = rechnung.steuermodus;

  const lines: EInvoiceOutboundLine[] = [...positionen]
    .sort((a, b) => a.sortierung - b.sortierung)
    .map((p, i) => {
      const einheit = mapEinheitToUnece(p.einheit);
      const tax = lineTax(p, steuermodus);
      return {
        id: String(i + 1),
        bezeichnung: p.bezeichnung.trim(),
        menge: p.menge,
        einheit_code: einheit.code,
        einheit_name: einheit.name,
        einzelpreis: p.einzelpreis,
        betrag_netto:
          steuermodus === "kleinunternehmer" ? p.betrag_brutto : p.betrag_netto,
        ...tax,
      };
    });

  const tax_subtotals = buildTaxSubtotals(lines, steuermodus);
  const hinweis =
    steuermodus === "kleinunternehmer" ? KLEINUNTERNEHMER_HINWEIS : "";

  let betrag_netto = rechnung.betrag_netto;
  let betrag_ust = rechnung.betrag_ust;
  let betrag_brutto = rechnung.betrag_brutto;
  if (steuermodus === "kleinunternehmer") {
    betrag_netto = rechnung.betrag_brutto;
    betrag_ust = "0.00";
    betrag_brutto = rechnung.betrag_brutto;
  }

  return {
    profil,
    rechnungsnummer: rechnung.rechnungsnummer.trim(),
    rechnungsdatum: rechnung.rechnungsdatum,
    faellig_am: rechnung.faellig_am,
    leistungszeitraum_von: rechnung.leistungszeitraum_von,
    leistungszeitraum_bis: rechnung.leistungszeitraum_bis,
    waehrung: "EUR",
    kaeuferreferenz: (kunde.leitweg_id ?? "").trim(),
    hinweis,
    steuermodus,
    verkaeufer: partyFromFirma(firma),
    kaeufer: partyFromKontakt(kunde),
    iban: (bankkonto?.iban ?? "").replace(/\s+/g, "").toUpperCase(),
    bic: (bankkonto?.bic ?? "").replace(/\s+/g, "").toUpperCase(),
    kontoinhaber: (
      bankkonto?.kontoinhaber ||
      firma.name ||
      ""
    ).trim(),
    positionen: lines,
    tax_subtotals,
    betrag_netto,
    betrag_ust,
    betrag_brutto,
  };
}

/** Summe der Positionen — für Konsistenzprüfung. */
export function sumOutboundLines(lines: EInvoiceOutboundLine[]): {
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
} {
  const netto = moneyToString(
    roundMoney(lines.reduce((acc, l) => acc.plus(money(l.betrag_netto)), money(0))),
  );
  const ust = moneyToString(
    roundMoney(
      lines.reduce((acc, l) => {
        if (l.tax_category === "E") return acc;
        return acc.plus(
          roundMoney(money(l.betrag_netto).times(money(l.steuersatz)).dividedBy(100)),
        );
      }, money(0)),
    ),
  );
  const brutto = moneyToString(roundMoney(sumMoney(netto, ust)));
  return { betrag_netto: netto, betrag_ust: ust, betrag_brutto: brutto };
}
