/**
 * Pflichtfeld- und Steuer-Modus-Prüfung für den Versand (ADR-0022).
 * Kein KoSIT-/Schematron-Claim — de-DE-Fehlerliste.
 */

import { money } from "@/lib/money";
import { isPlausibleIban } from "@/modules/banking/invariants";
import { isFestgeschrieben } from "@/modules/sales/invariants";
import type { Rechnung } from "@/modules/sales/types";
import {
  buildEInvoiceOutbound,
  sumOutboundLines,
  type BuildOutboundInput,
} from "./outbound";
import type {
  EInvoiceOutbound,
  EInvoicePrepareResult,
  EInvoiceSendProfil,
  EInvoiceValidationIssue,
} from "./outbound-types";

export class EInvoiceValidationError extends Error {
  readonly issues: EInvoiceValidationIssue[];

  constructor(issues: EInvoiceValidationIssue[]) {
    super(issues.map((i) => i.message).join(" · "));
    this.name = "EInvoiceValidationError";
    this.issues = issues;
  }
}

export function formatValidationIssues(issues: EInvoiceValidationIssue[]): string {
  return issues.map((i) => i.message).join(" · ").slice(0, 1800);
}

function issue(
  code: string,
  feld: string,
  message: string,
): EInvoiceValidationIssue {
  return { code, feld, message };
}

function isLikelyEmail(raw: string): boolean {
  const e = raw.trim();
  if (e.length < 5 || e.length > 200) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function hasAnschrift(p: {
  strasse: string;
  plz: string;
  ort: string;
  land: string;
}): boolean {
  return Boolean(p.strasse && p.plz && p.ort && p.land.length === 2);
}

/**
 * Prüft den gebauten Entwurf. `erzeugen: true` verlangt Festschreibung + Nummer.
 */
export function validateEInvoiceOutbound(
  draft: EInvoiceOutbound,
  opts: { rechnung: Rechnung; erzeugen: boolean },
): EInvoiceValidationIssue[] {
  const issues: EInvoiceValidationIssue[] = [];
  const { rechnung, erzeugen } = opts;
  const xrechnung = draft.profil === "xrechnung_ubl";

  if (erzeugen) {
    if (!isFestgeschrieben(rechnung)) {
      issues.push(
        issue(
          "RECHNUNG_ENTWURF",
          "rechnung.status",
          "E-Rechnung nur aus einer festgeschriebenen Rechnung. Bitte zuerst festschreiben.",
        ),
      );
    }
    if (!draft.rechnungsnummer) {
      issues.push(
        issue(
          "RECHNUNG_OHNE_NUMMER",
          "rechnung.rechnungsnummer",
          "Ohne Rechnungsnummer keine E-Rechnung (Nummern erst bei Festschreibung).",
        ),
      );
    }
  }

  if (!draft.rechnungsdatum) {
    issues.push(
      issue(
        "RECHNUNG_DATUM",
        "rechnung.rechnungsdatum",
        "Rechnungsdatum fehlt.",
      ),
    );
  }

  if (!draft.verkaeufer.name) {
    issues.push(
      issue("FIRMA_NAME", "firma.name", "Name der Firma fehlt."),
    );
  }
  if (!hasAnschrift(draft.verkaeufer)) {
    issues.push(
      issue(
        "FIRMA_ANSCHRIFT",
        "firma.anschrift",
        "Firma braucht Straße, PLZ, Ort und Land (ISO-2) für die E-Rechnung.",
      ),
    );
  }
  if (!draft.verkaeufer.ust_id && !draft.verkaeufer.steuernummer) {
    issues.push(
      issue(
        "FIRMA_STEUER",
        "firma.steuer",
        "Firma braucht eine Steuernummer oder USt-IdNr. für die E-Rechnung.",
      ),
    );
  }

  if (xrechnung) {
    if (!isLikelyEmail(draft.verkaeufer.email)) {
      issues.push(
        issue(
          "FIRMA_EMAIL",
          "firma.email",
          "XRechnung braucht eine E-Mail der Firma (elektronische Adresse).",
        ),
      );
    }
    if (!draft.kaeuferreferenz) {
      issues.push(
        issue(
          "KUNDE_LEITWEG",
          "kontakt.leitweg_id",
          "XRechnung braucht am Kontakt eine Leitweg-ID (Behörde) oder Käuferreferenz (B2B).",
        ),
      );
    }
    if (!isLikelyEmail(draft.kaeufer.email)) {
      issues.push(
        issue(
          "KUNDE_EMAIL",
          "kontakt.email",
          "XRechnung braucht eine E-Mail der Kund:in (elektronische Adresse).",
        ),
      );
    }
  }

  if (!draft.kaeufer.name) {
    issues.push(issue("KUNDE_NAME", "kontakt.name", "Kund:in fehlt."));
  }
  if (!hasAnschrift(draft.kaeufer)) {
    issues.push(
      issue(
        "KUNDE_ANSCHRIFT",
        "kontakt.anschrift",
        "Kund:in braucht Straße, PLZ, Ort und Land (ISO-2) für die E-Rechnung.",
      ),
    );
  }

  if (!draft.iban) {
    issues.push(
      issue(
        "BANK_IBAN",
        "bankkonto.iban",
        "Für die E-Rechnung ein Bankkonto der Firma mit IBAN wählen.",
      ),
    );
  } else if (!isPlausibleIban(draft.iban)) {
    issues.push(
      issue("BANK_IBAN", "bankkonto.iban", "IBAN des Bankkontos ist ungültig."),
    );
  }

  if (draft.positionen.length === 0) {
    issues.push(
      issue(
        "POSITIONEN",
        "rechnung.positionen",
        "Mindestens eine Position ist erforderlich.",
      ),
    );
  }

  if (draft.steuermodus === "kleinunternehmer") {
    if (money(rechnung.betrag_ust).gt(0)) {
      issues.push(
        issue(
          "STEUER_KLEINUNTERNEHMER",
          "rechnung.betrag_ust",
          "Unter der Kleinunternehmerregelung darf die Rechnung keine USt ausweisen.",
        ),
      );
    }
    for (const line of draft.positionen) {
      if (line.tax_category !== "E" || line.steuersatz !== "0") {
        issues.push(
          issue(
            "STEUER_KLEINUNTERNEHMER",
            "position.steuersatz",
            `Position ${line.id}: unter der Kleinunternehmerregelung keine USt-Zeile.`,
          ),
        );
      }
    }
  } else {
    for (const p of draft.positionen) {
      if (p.tax_category === "S" && p.steuersatz === "0") {
        issues.push(
          issue(
            "STEUER_INKONSISTENT",
            "position.steuersatz",
            `Position ${p.id}: Steuersatz und Kategorie passen nicht zusammen.`,
          ),
        );
      }
    }
  }

  const summed = sumOutboundLines(draft.positionen);
  if (draft.positionen.length > 0) {
    if (!money(summed.betrag_netto).eq(money(draft.betrag_netto))) {
      issues.push(
        issue(
          "BETRAG_INKONSISTENT",
          "rechnung.betrag_netto",
          `Netto der Positionen (${summed.betrag_netto}) weicht vom Rechnungskopf (${draft.betrag_netto}) ab.`,
        ),
      );
    }
    if (!money(summed.betrag_ust).eq(money(draft.betrag_ust))) {
      issues.push(
        issue(
          "BETRAG_INKONSISTENT",
          "rechnung.betrag_ust",
          `USt der Positionen (${summed.betrag_ust}) weicht vom Rechnungskopf (${draft.betrag_ust}) ab.`,
        ),
      );
    }
    if (!money(summed.betrag_brutto).eq(money(draft.betrag_brutto))) {
      issues.push(
        issue(
          "BETRAG_INKONSISTENT",
          "rechnung.betrag_brutto",
          `Brutto der Positionen (${summed.betrag_brutto}) weicht vom Rechnungskopf (${draft.betrag_brutto}) ab.`,
        ),
      );
    }
  }

  return issues;
}

export function prepareEInvoiceOutbound(
  input: BuildOutboundInput,
  opts: { erzeugen: boolean },
): EInvoicePrepareResult {
  const draft = buildEInvoiceOutbound(input);
  const issues = validateEInvoiceOutbound(draft, {
    rechnung: input.rechnung,
    erzeugen: opts.erzeugen,
  });
  return { draft, issues };
}

export function assertOutboundReady(
  result: EInvoicePrepareResult,
): asserts result is EInvoicePrepareResult & { issues: [] } {
  if (result.issues.length > 0) {
    throw new EInvoiceValidationError(result.issues);
  }
}

export function assertKnownProfil(
  raw: string,
): asserts raw is EInvoiceSendProfil {
  if (raw !== "xrechnung_ubl" && raw !== "zugferd_cii") {
    throw new Error("Unbekanntes E-Rechnungs-Profil.");
  }
}
