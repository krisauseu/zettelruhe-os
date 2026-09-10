/**
 * Reine Domain-Invarianten des Buchungsjournals (ohne I/O).
 * GoBD: Anlegen = Festschreibung; keine stillen Änderungen (ADR-0004).
 */

import {
  money,
  moneyToString,
  percentOf,
  roundMoney,
  sumMoney,
  type MoneyInput,
} from "@/lib/money";
import type {
  Buchungsrichtung,
  JournalBuchungInput,
  QuelleTyp,
  Steuersatz,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RICHTUNG = new Set<Buchungsrichtung>(["einnahme", "ausgabe"]);
const VALID_QUELLE = new Set<QuelleTyp>([
  "manuell",
  "beleg",
  "rechnung",
  "zahlung",
  "kasse",
  "storno",
  "system",
]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

/** Heutiges Kalenderdatum in Europe/Berlin als YYYY-MM-DD (ADR-0016) */
export function todayBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ISO-8601 UTC für Festschreibungszeitpunkt */
export function festschreibungsZeitpunktUtc(now: Date = new Date()): string {
  return now.toISOString();
}

export function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Normalisiert Geldeingabe (de-DE Komma oder Punkt) → "12.34".
 * Negativ und NaN werden abgelehnt (Beträge absolut; Richtung separat).
 */
export function normalizeBetragInput(raw: string, fieldLabel = "Betrag"): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    throw new Error(`${fieldLabel} ist erforderlich.`);
  }
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
  return moneyToString(d);
}

export type NormalizedBetraege = {
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
};

/**
 * Beträge konsistent machen:
 * - wenn netto + ust/satz → brutto
 * - wenn nur brutto + satz → netto + ust
 * - wenn netto + brutto ohne ust → ust = brutto − netto
 */
export function normalizeBetraege(input: {
  betrag_netto?: string;
  betrag_ust?: string;
  betrag_brutto?: string;
  steuersatz?: Steuersatz | "";
}): NormalizedBetraege {
  const steuersatz =
    input.steuersatz && VALID_STEUERSATZ.has(input.steuersatz)
      ? (input.steuersatz as Steuersatz)
      : "";

  const hasNetto = Boolean(input.betrag_netto?.trim());
  const hasUst = Boolean(input.betrag_ust?.trim());
  const hasBrutto = Boolean(input.betrag_brutto?.trim());

  if (!hasNetto && !hasBrutto) {
    throw new Error("Netto- oder Bruttobetrag ist erforderlich.");
  }

  let netto: MoneyInput;
  let ust: MoneyInput;
  let brutto: MoneyInput;

  if (hasNetto && hasBrutto) {
    netto = normalizeBetragInput(input.betrag_netto!, "Netto");
    brutto = normalizeBetragInput(input.betrag_brutto!, "Brutto");
    if (hasUst) {
      ust = normalizeBetragInput(input.betrag_ust!, "USt");
    } else {
      ust = moneyToString(roundMoney(money(brutto).minus(money(netto))));
    }
  } else if (hasNetto) {
    netto = normalizeBetragInput(input.betrag_netto!, "Netto");
    if (hasUst) {
      ust = normalizeBetragInput(input.betrag_ust!, "USt");
    } else if (steuersatz) {
      ust = moneyToString(roundMoney(percentOf(netto, steuersatz)));
    } else {
      ust = "0.00";
    }
    brutto = moneyToString(roundMoney(sumMoney(netto, ust)));
  } else {
    // nur Brutto
    brutto = normalizeBetragInput(input.betrag_brutto!, "Brutto");
    if (steuersatz && steuersatz !== "0") {
      const rate = money(steuersatz);
      // netto = brutto / (1 + rate/100)
      netto = moneyToString(
        roundMoney(money(brutto).dividedBy(rate.dividedBy(100).plus(1))),
      );
      ust = moneyToString(roundMoney(money(brutto).minus(money(netto))));
    } else if (hasUst) {
      ust = normalizeBetragInput(input.betrag_ust!, "USt");
      netto = moneyToString(roundMoney(money(brutto).minus(money(ust))));
    } else {
      netto = brutto;
      ust = "0.00";
    }
  }

  // Konsistenz: netto + ust ≈ brutto (1 Cent Toleranz)
  const sum = roundMoney(sumMoney(netto, ust));
  const b = roundMoney(brutto);
  if (sum.minus(b).abs().greaterThan(0.01)) {
    throw new Error(
      `Beträge inkonsistent: Netto (${moneyToString(netto)}) + USt (${moneyToString(ust)}) ≠ Brutto (${moneyToString(brutto)}).`,
    );
  }

  return {
    betrag_netto: moneyToString(netto),
    betrag_ust: moneyToString(ust),
    betrag_brutto: moneyToString(b),
    steuersatz,
  };
}

export type ValidatedBuchung = {
  buchungsdatum: string;
  belegdatum: string;
  buchungstext: string;
  richtung: Buchungsrichtung;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
  konto: string;
  kontakt: string | null;
  quelle_typ: QuelleTyp;
  quelle_id: string;
  storno_von: string | null;
};

/** Validiert und normalisiert eine Buchungs-Eingabe vor der Festschreibung. */
export function validateBuchungInput(input: JournalBuchungInput): ValidatedBuchung {
  if (("rc" in input && input.rc != null) || ("rc_steuerdatum" in input && input.rc_steuerdatum) || ("rc_vorgang" in input && input.rc_vorgang)) throw new Error("RC-Journalbuchungen benötigen die atomare RC-Finanzoperation.");
  const buchungsdatum = (input.buchungsdatum ?? "").trim();
  if (!isValidIsoDate(buchungsdatum)) {
    throw new Error("Buchungsdatum muss YYYY-MM-DD sein.");
  }

  const belegdatum = (input.belegdatum ?? "").trim();
  if (belegdatum && !isValidIsoDate(belegdatum)) {
    throw new Error("Belegdatum muss YYYY-MM-DD sein.");
  }

  const buchungstext = (input.buchungstext ?? "").trim();
  if (!buchungstext) {
    throw new Error("Buchungstext ist erforderlich.");
  }
  if (buchungstext.length > 500) {
    throw new Error("Buchungstext ist zu lang (max. 500 Zeichen).");
  }

  if (!VALID_RICHTUNG.has(input.richtung)) {
    throw new Error("Richtung muss Einnahme oder Ausgabe sein.");
  }

  const betraege = normalizeBetraege({
    betrag_netto: input.betrag_netto,
    betrag_ust: input.betrag_ust,
    betrag_brutto: input.betrag_brutto,
    steuersatz: input.steuersatz,
  });

  // Nullbetrag ablehnen (außer explizit 0.00 bei System — hier strikt)
  if (money(betraege.betrag_brutto).isZero()) {
    throw new Error("Bruttobetrag muss größer als 0 sein.");
  }

  const quelle_typ = input.quelle_typ ?? "manuell";
  if (!VALID_QUELLE.has(quelle_typ)) {
    throw new Error("Ungültiger Quelle-Typ.");
  }

  const storno_von = input.storno_von?.trim() || null;
  if (quelle_typ === "storno" && !storno_von) {
    throw new Error("Storno-Buchung braucht Verweis auf den stornierten Eintrag.");
  }
  if (storno_von && quelle_typ !== "storno") {
    throw new Error("storno_von nur bei Quelle-Typ storno erlaubt.");
  }

  return {
    buchungsdatum,
    belegdatum,
    buchungstext,
    richtung: input.richtung,
    ...betraege,
    konto: (input.konto ?? "").trim(),
    kontakt: input.kontakt?.trim() || null,
    quelle_typ,
    quelle_id: (input.quelle_id ?? "").trim(),
    storno_von,
  };
}

/** Gegenrichtung für Storno/Gegenbuchung */
export function invertRichtung(r: Buchungsrichtung): Buchungsrichtung {
  return r === "einnahme" ? "ausgabe" : "einnahme";
}

/**
 * Baut die Gegenbuchung zu einem festgeschriebenen Eintrag.
 * Beträge bleiben absolut; Richtung wird invertiert.
 */
export function buildStornoInput(
  original: {
    buchungsdatum: string;
    buchungstext: string;
    richtung: Buchungsrichtung;
    betrag_netto: string;
    betrag_ust: string;
    betrag_brutto: string;
    steuersatz: Steuersatz | "";
    konto: string;
    kontakt: string | null;
    id: string;
  },
  opts?: { buchungsdatum?: string; buchungstext?: string },
): JournalBuchungInput {
  const datum = opts?.buchungsdatum?.trim() || todayBerlin();
  if (!isValidIsoDate(datum)) {
    throw new Error("Buchungsdatum der Gegenbuchung muss YYYY-MM-DD sein.");
  }

  return {
    buchungsdatum: datum,
    belegdatum: original.buchungsdatum,
    buchungstext:
      opts?.buchungstext?.trim() ||
      `Storno zu Nr. ${original.id}: ${original.buchungstext}`.slice(0, 500),
    richtung: invertRichtung(original.richtung),
    betrag_netto: original.betrag_netto,
    betrag_ust: original.betrag_ust,
    betrag_brutto: original.betrag_brutto,
    steuersatz: original.steuersatz,
    konto: original.konto,
    kontakt: original.kontakt,
    quelle_typ: "storno",
    quelle_id: original.id,
    storno_von: original.id,
  };
}

/** Fehlermeldung, wenn Update/Delete versucht wird (Invariante) */
export const IMMUTABLE_ERROR =
  "Festgeschriebene Journal-Einträge dürfen nicht geändert oder gelöscht werden. Korrektur nur über Storno/Gegenbuchung.";

export function assertImmutableWriteBlocked(
  operation: "update" | "delete",
): never {
  throw new Error(
    `${IMMUTABLE_ERROR} (versucht: ${operation})`,
  );
}
