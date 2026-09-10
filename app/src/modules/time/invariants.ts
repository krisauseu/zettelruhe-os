/**
 * Reine Domain-Invarianten Zeiteinträge (ohne I/O).
 * Dauer-Normalisierung, Status-Übergänge, Kund:in Pflicht.
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
import type {
  Abrechnungsstatus,
  Zeiteintrag,
  ZeiteintragInput,
} from "./types";

export { isValidIsoDate, todayBerlin };

export const VALID_ABRECHNUNGSSTATUS = new Set<Abrechnungsstatus>([
  "abrechenbar",
  "nicht_abrechenbar",
  "abgerechnet",
]);

/** Inhalt nach Abrechnung light immutable (solange rechnung verknüpft). */
export const ABGERECHNET_ERROR =
  "Abgerechnete Zeiteinträge dürfen nicht still geändert werden. Status zurücksetzen, falls noch möglich.";

export type ValidatedZeiteintragInput = {
  kunde: string;
  projekt: string | null;
  datum: string;
  dauer_minuten: number;
  beschreibung: string;
  status: Abrechnungsstatus;
  stundensatz: string;
};

/**
 * Parst de-DE/en Dezimalzahl (Komma oder Punkt) → Decimal-tauglicher String.
 * Leer → null.
 */
export function parseDecimalInput(
  raw: string,
  fieldLabel: string,
): string | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const d = money(normalized);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error(`Ungültiger ${fieldLabel}.`);
  }
  if (d.isNegative()) {
    throw new Error(`${fieldLabel} darf nicht negativ sein.`);
  }
  return normalized;
}

/**
 * Normalisiert Dauer aus Stunden+Minuten und/oder Dezimalstunden → Minuten (≥ 1).
 *
 * Variante klar:
 * 1. Wenn stunden und/oder minuten gesetzt → Minuten = stunden*60 + minuten
 * 2. Sonst wenn dezimal_stunden → runden auf ganze Minuten
 * 3. Sonst Fehler
 */
export function normalizeDauerMinuten(input: {
  stunden?: number | string;
  minuten?: number | string;
  dezimal_stunden?: string;
}): number {
  const hasStunden =
    input.stunden !== undefined &&
    input.stunden !== null &&
    String(input.stunden).trim() !== "";
  const hasMinuten =
    input.minuten !== undefined &&
    input.minuten !== null &&
    String(input.minuten).trim() !== "";
  const hasDezimal = (input.dezimal_stunden ?? "").trim() !== "";

  if (hasStunden || hasMinuten) {
    const stundenRaw = hasStunden ? Number(input.stunden) : 0;
    const minutenRaw = hasMinuten ? Number(input.minuten) : 0;
    if (!Number.isFinite(stundenRaw) || stundenRaw < 0) {
      throw new Error("Stunden müssen ≥ 0 sein.");
    }
    if (!Number.isFinite(minutenRaw) || minutenRaw < 0 || minutenRaw > 59) {
      throw new Error("Minuten müssen zwischen 0 und 59 liegen.");
    }
    if (!Number.isInteger(stundenRaw) || !Number.isInteger(minutenRaw)) {
      // Erlaube "1.5" Stunden-Feld nicht — dann Dezimalstunden nutzen
      if (!Number.isInteger(stundenRaw)) {
        throw new Error(
          "Stunden als ganze Zahl eingeben oder Dezimalstunden nutzen.",
        );
      }
      if (!Number.isInteger(minutenRaw)) {
        throw new Error("Minuten als ganze Zahl eingeben (0–59).");
      }
    }
    const total = Math.trunc(stundenRaw) * 60 + Math.trunc(minutenRaw);
    if (total < 1) {
      throw new Error("Dauer muss mindestens 1 Minute betragen.");
    }
    return total;
  }

  if (hasDezimal) {
    const parsed = parseDecimalInput(
      input.dezimal_stunden ?? "",
      "Dezimalstunden",
    );
    if (!parsed) {
      throw new Error("Dauer ist erforderlich.");
    }
    const hours = money(parsed);
    if (hours.isZero()) {
      throw new Error("Dauer muss mindestens 1 Minute betragen.");
    }
    // Minuten kaufmännisch runden
    const minutes = Math.round(hours.times(60).toNumber());
    if (minutes < 1) {
      throw new Error("Dauer muss mindestens 1 Minute betragen.");
    }
    return minutes;
  }

  throw new Error("Dauer ist erforderlich (Stunden/Minuten oder Dezimalstunden).");
}

/** Minuten → { stunden, minuten } für Form-Defaults */
export function splitDauerMinuten(dauerMinuten: number): {
  stunden: number;
  minuten: number;
} {
  const m = Math.max(0, Math.trunc(dauerMinuten));
  return { stunden: Math.floor(m / 60), minuten: m % 60 };
}

/** Anzeige: "1:30 h" oder "45 min" */
export function formatDauerDe(dauerMinuten: number): string {
  const { stunden, minuten } = splitDauerMinuten(dauerMinuten);
  if (stunden === 0) return `${minuten} min`;
  if (minuten === 0) return `${stunden}:00 h`;
  return `${stunden}:${String(minuten).padStart(2, "0")} h`;
}

/** Minuten → Dezimalstunden-String (2 Stellen, Punkt) für Mengen auf Rechnung */
export function dauerMinutenToDezimalStunden(dauerMinuten: number): string {
  const hours = money(dauerMinuten).dividedBy(60);
  return moneyToString(roundMoney(hours, 2), 2);
}

/** Optionaler Stundensatz → normalisierter Money-String oder leer */
export function normalizeOptionalSatz(
  raw: string | undefined,
  fieldLabel: string,
): string {
  const parsed = parseDecimalInput(raw ?? "", fieldLabel);
  if (parsed === null) return "";
  return moneyToString(roundMoney(money(parsed), 2), 2);
}

export function validateZeiteintragInput(
  input: ZeiteintragInput,
): ValidatedZeiteintragInput {
  const kunde = (input.kunde ?? "").trim();
  if (!kunde) {
    throw new Error("Kund:in ist erforderlich.");
  }

  const projekt = (input.projekt ?? "").trim() || null;

  const datum = (input.datum ?? "").trim();
  if (!isValidIsoDate(datum)) {
    throw new Error("Datum muss YYYY-MM-DD sein.");
  }

  const dauer_minuten = normalizeDauerMinuten({
    stunden: input.stunden,
    minuten: input.minuten,
    dezimal_stunden: input.dezimal_stunden,
  });

  const beschreibung = (input.beschreibung ?? "").trim();
  if (beschreibung.length > 2000) {
    throw new Error("Beschreibung ist zu lang (max. 2000 Zeichen).");
  }

  const statusRaw = input.status ?? "abrechenbar";
  if (!VALID_ABRECHNUNGSSTATUS.has(statusRaw)) {
    throw new Error("Ungültiger Status.");
  }

  const stundensatz = normalizeOptionalSatz(input.stundensatz, "Stundensatz");

  return {
    kunde,
    projekt,
    datum,
    dauer_minuten,
    beschreibung,
    status: statusRaw,
    stundensatz,
  };
}

export function isAbgerechnet(e: Pick<Zeiteintrag, "status">): boolean {
  return e.status === "abgerechnet";
}

export function assertEditable(e: Pick<Zeiteintrag, "status" | "rechnung">): void {
  if (e.status === "abgerechnet" && e.rechnung) {
    throw new Error(ABGERECHNET_ERROR);
  }
}

/**
 * Statuswechsel light:
 * - abrechenbar ↔ nicht_abrechenbar frei
 * - → abgerechnet erlaubt (manuell oder Übernahme)
 * - abgerechnet → abrechenbar/nicht_abrechenbar nur wenn keine rechnung
 */
export function assertCanChangeStatus(
  existing: Pick<Zeiteintrag, "status" | "rechnung">,
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

export function parseAbrechnungsstatus(raw: string): Abrechnungsstatus | "" {
  return VALID_ABRECHNUNGSSTATUS.has(raw as Abrechnungsstatus)
    ? (raw as Abrechnungsstatus)
    : "";
}

/**
 * Positionstext + Menge/Preis für Rechnungsübernahme aus Zeiteintrag.
 */
export function buildRechnungspositionFromZeit(e: {
  datum: string;
  beschreibung: string;
  dauer_minuten: number;
  stundensatz: string;
}): {
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
} {
  const datePart = e.datum; // YYYY-MM-DD; UI formatiert separat
  const desc = e.beschreibung.trim() || "Arbeitszeit";
  const bezeichnung = `${datePart}: ${desc}`.slice(0, 500);
  const menge = dauerMinutenToDezimalStunden(e.dauer_minuten);
  const einzelpreis = e.stundensatz || "0.00";
  return {
    bezeichnung,
    menge,
    einheit: "Std.",
    einzelpreis,
  };
}

/** Netto aus Dauer × Stundensatz (light, für Anzeige) */
export function estimateNettoZeit(e: {
  dauer_minuten: number;
  stundensatz: string;
}): string {
  if (!e.stundensatz) return "0.00";
  const hours = money(e.dauer_minuten).dividedBy(60);
  return moneyToString(roundMoney(mulMoney(hours, e.stundensatz), 2), 2);
}
