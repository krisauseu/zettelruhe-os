/**
 * EPC-QR / GiroCode-Nutzdaten (EPC069-12, Version 002).
 * Kein I/O — die Grafik erzeugt girocode-qr.ts.
 */

import { money, moneyToString } from "@/lib/money";
import {
  isPlausibleIban,
  normalizeIban,
} from "@/modules/banking/invariants";

export type GirocodeInput = {
  /** Zahlungsempfänger:in (Firma), max. 70 Zeichen */
  empfaenger: string;
  iban: string;
  bic?: string;
  /** Dezimalstring, z. B. 3105.90 */
  betrag?: string;
  /** Unstrukturierter Verwendungszweck, max. 140 Zeichen */
  verwendungszweck?: string;
};

/** Baut den EPC-Payload oder null, wenn IBAN/Name fehlen. */
export function buildGirocodePayload(input: GirocodeInput): string | null {
  const iban = normalizeIban(input.iban ?? "");
  if (!iban || !isPlausibleIban(iban)) return null;

  const name = (input.empfaenger ?? "").trim().replace(/\s+/g, " ").slice(0, 70);
  if (!name) return null;

  const bic = (input.bic ?? "").replace(/\s+/g, "").toUpperCase();

  let amount = "";
  const rawBetrag = (input.betrag ?? "").trim();
  if (rawBetrag) {
    try {
      const n = money(rawBetrag);
      if (n.gt(0)) {
        amount = `EUR${moneyToString(n)}`;
      }
    } catch {
      /* Betrag weglassen */
    }
  }

  const zweck = (input.verwendungszweck ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);

  return [
    "BCD",
    "002",
    "1",
    "SCT",
    bic,
    name,
    iban,
    amount,
    "",
    zweck,
    "",
  ].join("\n");
}
