/**
 * Reine Domain-Invarianten Fahrten (ohne I/O).
 * km > 0, Kund:in Pflicht, Status light.
 */

import {
  money,
  moneyToString,
  mulMoney,
  roundMoney,
} from "@/lib/money";
import {
  isValidIsoDate,
  todayBerlin,
} from "@/modules/journal/invariants";
import {
  parseAbrechnungsstatus,
  parseDecimalInput,
  VALID_ABRECHNUNGSSTATUS,
} from "@/modules/time/invariants";
import type { Abrechnungsstatus } from "@/modules/time/types";
import type { Fahrt, FahrtInput } from "./types";

export {
  isValidIsoDate,
  todayBerlin,
  parseAbrechnungsstatus,
  VALID_ABRECHNUNGSSTATUS,
};
export type { Abrechnungsstatus };

export const ABGERECHNET_FAHRT_ERROR =
  "Abgerechnete Fahrten dürfen nicht still geändert werden. Status zurücksetzen, falls noch möglich.";

export type ValidatedFahrtInput = {
  kunde: string;
  projekt: string | null;
  datum: string;
  km: string;
  strecke: string;
  status: Abrechnungsstatus;
  steuerlich_relevant: boolean;
  steuer_notiz: string;
  km_satz: string;
};

/** Normalisiert km → String mit sinnvollen Nachkommastellen, muss > 0 */
export function normalizeKm(raw: string): string {
  const parsed = parseDecimalInput(raw, "Kilometer");
  if (parsed === null) {
    throw new Error("Kilometer sind erforderlich.");
  }
  const d = money(parsed);
  if (d.lte(0)) {
    throw new Error("Kilometer müssen größer als 0 sein.");
  }
  // Bis 2 Nachkommastellen (km-Genauigkeit light)
  return moneyToString(roundMoney(d, 2), 2);
}

function normalizeOptionalSatz(
  raw: string | undefined,
  fieldLabel: string,
): string {
  const parsed = parseDecimalInput(raw ?? "", fieldLabel);
  if (parsed === null) return "";
  return moneyToString(roundMoney(money(parsed), 2), 2);
}

export function validateFahrtInput(input: FahrtInput): ValidatedFahrtInput {
  const kunde = (input.kunde ?? "").trim();
  if (!kunde) {
    throw new Error("Kund:in ist erforderlich.");
  }

  const projekt = (input.projekt ?? "").trim() || null;

  const datum = (input.datum ?? "").trim();
  if (!isValidIsoDate(datum)) {
    throw new Error("Datum muss YYYY-MM-DD sein.");
  }

  const km = normalizeKm(input.km ?? "");

  const strecke = (input.strecke ?? "").trim();
  if (strecke.length > 500) {
    throw new Error("Strecke/Zweck ist zu lang (max. 500 Zeichen).");
  }

  const statusRaw = input.status ?? "abrechenbar";
  if (!VALID_ABRECHNUNGSSTATUS.has(statusRaw)) {
    throw new Error("Ungültiger Status.");
  }

  const steuer_notiz = (input.steuer_notiz ?? "").trim();
  if (steuer_notiz.length > 500) {
    throw new Error("Steuer-Notiz ist zu lang (max. 500 Zeichen).");
  }

  const km_satz = normalizeOptionalSatz(input.km_satz, "km-Satz");

  return {
    kunde,
    projekt,
    datum,
    km,
    strecke,
    status: statusRaw,
    steuerlich_relevant: Boolean(input.steuerlich_relevant),
    steuer_notiz,
    km_satz,
  };
}

export function isFahrtAbgerechnet(e: Pick<Fahrt, "status">): boolean {
  return e.status === "abgerechnet";
}

export function assertFahrtEditable(
  e: Pick<Fahrt, "status" | "rechnung">,
): void {
  if (e.status === "abgerechnet" && e.rechnung) {
    throw new Error(ABGERECHNET_FAHRT_ERROR);
  }
}

export function assertCanChangeFahrtStatus(
  existing: Pick<Fahrt, "status" | "rechnung">,
  ziel: Abrechnungsstatus,
): void {
  if (!VALID_ABRECHNUNGSSTATUS.has(ziel)) {
    throw new Error("Ungültiger Ziel-Status.");
  }
  if (existing.status === ziel) return;

  if (existing.status === "abgerechnet" && existing.rechnung) {
    throw new Error(
      "Status abgerechnet mit verknüpfter Rechnung kann nicht manuell geändert werden.",
    );
  }
}

/**
 * Positionstext + Menge/Preis für Rechnungsübernahme aus Fahrt.
 */
export function buildRechnungspositionFromFahrt(e: {
  datum: string;
  strecke: string;
  km: string;
  km_satz: string;
}): {
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
} {
  const desc = e.strecke.trim() || "Fahrt";
  const bezeichnung = `${e.datum}: ${desc}`.slice(0, 500);
  return {
    bezeichnung,
    menge: e.km,
    einheit: "km",
    einzelpreis: e.km_satz || "0.00",
  };
}

export function estimateNettoFahrt(e: {
  km: string;
  km_satz: string;
}): string {
  if (!e.km_satz) return "0.00";
  return moneyToString(roundMoney(mulMoney(e.km, e.km_satz), 2), 2);
}

/** Anzeige km de-DE */
export function formatKmDe(km: string): string {
  const d = money(km || 0);
  if (d.isNaN()) return km;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(d.toNumber());
}
