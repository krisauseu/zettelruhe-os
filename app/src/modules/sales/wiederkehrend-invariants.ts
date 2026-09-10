/**
 * Reine Domain-Invarianten: Wiederkehrende Rechnungen (ohne I/O).
 * Rhythmus / nächstes Datum Europe/Berlin-Kalender (ADR-0016).
 * Erzeugung → Rechnungs-Entwurf über Sales-Pfade (kein Auto-Festschreiben).
 */

import type { Steuermodus } from "@/lib/pb";
import {
  isValidIsoDate,
  todayBerlin,
  validatePositionInput,
  sumPositionen,
  type ValidatedPosition,
} from "./invariants";
import type { RechnungspositionInput, Steuersatz } from "./types";
import type {
  WiederkehrendeRechnung,
  WiederkehrInput,
  WiederkehrPosition,
  WiederkehrRhythmus,
} from "./wiederkehrend-types";

export { isValidIsoDate, todayBerlin };

const VALID_RHYTHMUS = new Set<WiederkehrRhythmus>([
  "monatlich",
  "quartalsweise",
  "jaehrlich",
  "tage",
]);

const VALID_STEUERMODUS = new Set<Steuermodus>([
  "kleinunternehmer",
  "regelbesteuerung_ist",
]);

export const DEFAULT_ZAHLUNGSZIEL_TAGE = 14;

/** Max. Nachhol-Erzeugungen pro Vorlage pro Tick (Catch-up) */
export const MAX_CATCHUP_PRO_VORLAGE = 12;

export type ValidatedWiederkehrInput = {
  bezeichnung: string;
  kunde: string | null;
  naechstes_datum: string;
  rhythmus: WiederkehrRhythmus;
  intervall_tage: number;
  zahlungsziel_tage: number;
  aktiv: boolean;
  notiz: string;
  positionen: ValidatedPosition[];
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

export function parseRhythmus(raw: string): WiederkehrRhythmus | "" {
  return VALID_RHYTHMUS.has(raw as WiederkehrRhythmus)
    ? (raw as WiederkehrRhythmus)
    : "";
}

/**
 * Addiert Kalendertage zu YYYY-MM-DD (UTC-Datumsteile = Kalendertag, ADR-0016).
 */
export function addDaysIso(isoDate: string, days: number): string {
  if (!isValidIsoDate(isoDate)) {
    throw new Error("Ungültiges Datum.");
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcYmd(dt);
}

/**
 * Addiert Monate zu YYYY-MM-DD; klemmt auf letzten Tag des Zielmonats
 * (31.01 + 1 Monat → 28./29.02).
 */
export function addMonthsIso(isoDate: string, months: number): string {
  if (!isValidIsoDate(isoDate)) {
    throw new Error("Ungültiges Datum.");
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  target.setUTCDate(day);
  return formatUtcYmd(target);
}

function formatUtcYmd(dt: Date): string {
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Nächstes Ausstellungsdatum nach einem Lauf.
 * - monatlich: +1 Monat
 * - quartalsweise: +3 Monate
 * - jaehrlich: +12 Monate
 * - tage: +intervall_tage (min. 1)
 */
export function nextNaechstesDatum(
  current: string,
  rhythmus: WiederkehrRhythmus,
  intervallTage: number,
): string {
  switch (rhythmus) {
    case "monatlich":
      return addMonthsIso(current, 1);
    case "quartalsweise":
      return addMonthsIso(current, 3);
    case "jaehrlich":
      return addMonthsIso(current, 12);
    case "tage": {
      const n = Math.max(1, Math.floor(intervallTage) || 1);
      return addDaysIso(current, n);
    }
    default:
      throw new Error("Unbekannter Rhythmus.");
  }
}

/** Fälligkeit = Rechnungsdatum + Zahlungsziel-Tage */
export function faelligAmFromZahlungsziel(
  rechnungsdatum: string,
  zahlungszielTage: number,
): string {
  const days =
    Number.isFinite(zahlungszielTage) && zahlungszielTage >= 0
      ? Math.floor(zahlungszielTage)
      : DEFAULT_ZAHLUNGSZIEL_TAGE;
  return addDaysIso(rechnungsdatum, days);
}

/** Vorlage ist fällig, wenn aktiv und naechstes_datum ≤ heute (Berlin). */
export function isVorlageFaellig(
  vorlage: Pick<WiederkehrendeRechnung, "aktiv" | "naechstes_datum">,
  heute: string = todayBerlin(),
): boolean {
  if (!vorlage.aktiv) return false;
  if (!isValidIsoDate(vorlage.naechstes_datum) || !isValidIsoDate(heute)) {
    return false;
  }
  return vorlage.naechstes_datum <= heute;
}

/** Validiert Vorlage inkl. Positionen (Summen wie Rechnung). */
export function validateWiederkehrInput(
  input: WiederkehrInput,
  steuermodus: Steuermodus,
): ValidatedWiederkehrInput {
  if (!VALID_STEUERMODUS.has(steuermodus)) {
    throw new Error("Ungültiger Steuer-Modus.");
  }

  const bezeichnung = (input.bezeichnung ?? "").trim();
  if (!bezeichnung) {
    throw new Error("Bezeichnung der Vorlage ist erforderlich.");
  }
  if (bezeichnung.length > 200) {
    throw new Error("Bezeichnung ist zu lang (max. 200 Zeichen).");
  }

  const naechstes_datum = (input.naechstes_datum ?? "").trim();
  if (!isValidIsoDate(naechstes_datum)) {
    throw new Error("Nächstes Datum muss YYYY-MM-DD sein.");
  }

  const rhythmus = parseRhythmus(String(input.rhythmus ?? ""));
  if (!rhythmus) {
    throw new Error(
      "Rhythmus muss monatlich, quartalsweise, jährlich oder Tage sein.",
    );
  }

  let intervall_tage = 0;
  if (rhythmus === "tage") {
    const raw = input.intervall_tage;
    const n =
      typeof raw === "number"
        ? raw
        : Number.parseInt(String(raw ?? "").trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error("Intervall in Tagen muss mindestens 1 sein.");
    }
    if (n > 3650) {
      throw new Error("Intervall in Tagen ist zu groß (max. 3650).");
    }
    intervall_tage = Math.floor(n);
  }

  let zahlungsziel_tage = DEFAULT_ZAHLUNGSZIEL_TAGE;
  if (
    input.zahlungsziel_tage !== undefined &&
    input.zahlungsziel_tage !== null &&
    String(input.zahlungsziel_tage).trim() !== ""
  ) {
    const z =
      typeof input.zahlungsziel_tage === "number"
        ? input.zahlungsziel_tage
        : Number.parseInt(String(input.zahlungsziel_tage).trim(), 10);
    if (!Number.isFinite(z) || z < 0) {
      throw new Error("Zahlungsziel (Tage) muss ≥ 0 sein.");
    }
    if (z > 365) {
      throw new Error("Zahlungsziel (Tage) ist zu groß (max. 365).");
    }
    zahlungsziel_tage = Math.floor(z);
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const kunde = input.kunde?.trim() || null;

  const rawPos = Array.isArray(input.positionen) ? input.positionen : [];
  const filtered = rawPos.filter(
    (p) =>
      (p.bezeichnung ?? "").trim() ||
      (p.einzelpreis ?? "").trim() ||
      (p.menge ?? "").trim(),
  );
  if (filtered.length === 0) {
    throw new Error("Mindestens eine Position ist erforderlich.");
  }

  const positionen: ValidatedPosition[] = filtered.map((p, i) =>
    validatePositionInput(p, steuermodus, i + 1),
  );
  const sums = sumPositionen(positionen);

  return {
    bezeichnung,
    kunde,
    naechstes_datum,
    rhythmus,
    intervall_tage,
    zahlungsziel_tage,
    aktiv: input.aktiv !== false,
    notiz,
    positionen,
    ...sums,
  };
}

/** Erzeugung nur wenn Kund:in + ≥1 Position. */
export function assertCanErzeugen(
  vorlage: WiederkehrendeRechnung,
  positionen: WiederkehrPosition[],
): void {
  if (!vorlage.aktiv) {
    throw new Error("Vorlage ist pausiert.");
  }
  if (!vorlage.kunde) {
    throw new Error("Kund:in ist für die Erzeugung erforderlich.");
  }
  if (!positionen.length) {
    throw new Error("Vorlage hat keine Positionen.");
  }
  if (!isValidIsoDate(vorlage.naechstes_datum)) {
    throw new Error("Nächstes Datum der Vorlage ist ungültig.");
  }
}

/**
 * Mappt Vorlage → RechnungInput (Entwurf) für createRechnung.
 * Rechnungsdatum = naechstes_datum (bzw. override); Fälligkeit aus Zahlungsziel.
 */
export function mapVorlageToRechnungInput(
  vorlage: WiederkehrendeRechnung,
  positionen: WiederkehrPosition[],
  opts?: { rechnungsdatum?: string },
): {
  kunde: string | null;
  rechnungsdatum: string;
  faellig_am: string;
  notiz: string;
  positionen: RechnungspositionInput[];
} {
  assertCanErzeugen(vorlage, positionen);
  const rechnungsdatum =
    opts?.rechnungsdatum && isValidIsoDate(opts.rechnungsdatum)
      ? opts.rechnungsdatum
      : vorlage.naechstes_datum;

  const faellig_am = faelligAmFromZahlungsziel(
    rechnungsdatum,
    vorlage.zahlungsziel_tage,
  );

  const notizParts: string[] = [];
  if (vorlage.notiz) notizParts.push(vorlage.notiz);
  notizParts.push(
    `Erzeugt aus Wiederkehrende Rechnung „${vorlage.bezeichnung}“.`,
  );

  return {
    kunde: vorlage.kunde,
    rechnungsdatum,
    faellig_am,
    notiz: notizParts.join("\n"),
    positionen: positionen.map((p) => ({
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      steuersatz: (p.steuersatz || "") as Steuersatz | "",
      katalog_position: p.katalog_position,
    })),
  };
}
