/**
 * Reine Domain-Invarianten Kassenbuch (ohne I/O).
 * Anlegen = Festschreibung; keine stillen Änderungen (ADR-0004).
 * Saldo-Regel v1: negativer Saldo wird abgelehnt.
 */

import {
  money,
  moneyToString,
  roundMoney,
  subMoney,
  sumMoney,
} from "@/lib/money";
import {
  festschreibungsZeitpunktUtc,
  invertRichtung,
  isValidIsoDate,
  normalizeBetraege,
  todayBerlin,
  type NormalizedBetraege,
} from "@/modules/journal/invariants";
import type { JournalBuchungInput } from "@/modules/journal/types";
import type {
  Buchungsrichtung,
  KassenbuchEintrag,
  KassenbuchInput,
} from "./types";

export { isValidIsoDate, todayBerlin, festschreibungsZeitpunktUtc, invertRichtung };

const VALID_RICHTUNG = new Set<Buchungsrichtung>(["einnahme", "ausgabe"]);

/** Produktregel: Kassenbuch-Saldo darf nicht negativ werden. */
export const NEGATIVER_SALDO_ERROR =
  "Der Kassensaldo darf nicht negativ werden. Bitte Betrag oder Richtung prüfen bzw. zuerst eine Bareinnahme erfassen.";

export const IMMUTABLE_ERROR =
  "Festgeschriebene Kassenbuch-Einträge dürfen nicht geändert oder gelöscht werden. Korrektur nur über Storno/Gegenbuchung.";

export const STORNO_BEREITS_ERROR =
  "Dieser Kassenbuch-Eintrag ist bereits storniert.";

export const STORNO_VON_STORNO_ERROR =
  "Eine Storno-Gegenbuchung kann nicht erneut storniert werden.";

export type ValidatedKassenbuchInput = {
  datum: string;
  richtung: Buchungsrichtung;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: KassenbuchEintrag["steuersatz"];
  text: string;
  kategorie: string;
  notiz: string;
  kontakt: string | null;
};

/** Validiert und normalisiert Kassenbuch-Eingabe vor der Festschreibung. */
export function validateKassenbuchInput(
  input: KassenbuchInput,
): ValidatedKassenbuchInput {
  const datum = (input.datum ?? "").trim();
  if (!isValidIsoDate(datum)) {
    throw new Error("Datum muss YYYY-MM-DD sein.");
  }

  if (!VALID_RICHTUNG.has(input.richtung)) {
    throw new Error("Richtung muss Bareinnahme oder Barausgabe sein.");
  }

  const betraege: NormalizedBetraege = normalizeBetraege({
    betrag_netto: input.betrag_netto,
    betrag_ust: input.betrag_ust,
    betrag_brutto: input.betrag_brutto,
    steuersatz: input.steuersatz,
  });

  if (money(betraege.betrag_brutto).isZero() || money(betraege.betrag_brutto).lt(0)) {
    throw new Error("Bruttobetrag muss größer als 0 sein.");
  }

  const text = (input.text ?? "").trim();
  if (!text) {
    throw new Error("Text ist erforderlich.");
  }
  if (text.length > 500) {
    throw new Error("Text ist zu lang (max. 500 Zeichen).");
  }

  const kategorie = (input.kategorie ?? "").trim();
  if (kategorie.length > 120) {
    throw new Error("Kategorie ist zu lang (max. 120 Zeichen).");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  return {
    datum,
    richtung: input.richtung,
    ...betraege,
    text,
    kategorie,
    notiz,
    kontakt: input.kontakt?.trim() || null,
  };
}

/**
 * Sortierschlüssel: Datum aufsteigend, dann id (stabiler Tiebreaker).
 * PB 0.39: system-created nicht sortierbar — id als Ersatz.
 */
export function compareKassenbuchChronologisch(
  a: Pick<KassenbuchEintrag, "datum" | "id">,
  b: Pick<KassenbuchEintrag, "datum" | "id">,
): number {
  if (a.datum < b.datum) return -1;
  if (a.datum > b.datum) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Saldo-Delta eines Eintrags: Einnahme +, Ausgabe − (Brutto).
 */
export function saldoDelta(
  richtung: Buchungsrichtung,
  betragBrutto: string,
): string {
  const b = moneyToString(roundMoney(betragBrutto));
  if (richtung === "einnahme") return b;
  // Ausgabe: negativer Beitrag als String mit Vorzeichen für Summation
  return moneyToString(roundMoney(money(b).negated()));
}

/**
 * Fortlaufenden Saldo berechnen (chronologisch nach datum, id).
 * Gibt Einträge mit saldo_nach zurück und den Endsaldo.
 */
export function computeRunningSaldo<
  T extends Pick<KassenbuchEintrag, "id" | "datum" | "richtung" | "betrag_brutto">,
>(
  entries: T[],
): { items: Array<T & { saldo_nach: string }>; saldo: string } {
  const sorted = [...entries].sort(compareKassenbuchChronologisch);
  let saldo = money(0);
  const items = sorted.map((e) => {
    if (e.richtung === "einnahme") {
      saldo = roundMoney(sumMoney(saldo, e.betrag_brutto));
    } else {
      saldo = roundMoney(subMoney(saldo, e.betrag_brutto));
    }
    return { ...e, saldo_nach: moneyToString(saldo) };
  });
  return { items, saldo: moneyToString(saldo) };
}

/**
 * Prüft, dass nach Einfügen des neuen Eintrags (oder aller Einträge inkl. neu)
 * kein Saldo-Stand negativ wird.
 *
 * @param existing bestehende Einträge (ohne den neuen)
 * @param candidate neuer Eintrag (id darf leer/"new" sein für Sort — wird ans Ende bei gleichem Datum gehängt via id)
 */
export function assertSaldoNichtNegativ(
  existing: Array<
    Pick<KassenbuchEintrag, "id" | "datum" | "richtung" | "betrag_brutto">
  >,
  candidate: Pick<
    KassenbuchEintrag,
    "id" | "datum" | "richtung" | "betrag_brutto"
  >,
): void {
  const { items } = computeRunningSaldo([...existing, candidate]);
  for (const e of items) {
    if (money(e.saldo_nach).lt(0)) {
      throw new Error(NEGATIVER_SALDO_ERROR);
    }
  }
}

/**
 * Buchungstext für Journal aus Kassenbuch-Metadaten.
 */
export function buildBuchungstextFromKasse(entry: {
  text: string;
  kategorie: string;
  belegnummer?: string;
  richtung: Buchungsrichtung;
}): string {
  const parts: string[] = [];
  if (entry.belegnummer) {
    parts.push(`Kasse ${entry.belegnummer}`);
  }
  if (entry.kategorie) {
    parts.push(entry.kategorie);
  }
  if (entry.text) {
    parts.push(entry.text);
  }
  if (parts.length === 0) {
    parts.push(
      entry.richtung === "einnahme" ? "Bareinnahme" : "Barausgabe",
    );
  }
  return parts.join(" — ").slice(0, 500);
}

/**
 * Journal-Eingabe aus festzuschreibendem Kassenbuch-Eintrag.
 */
export function buildJournalInputFromKasse(
  entry: {
    datum: string;
    richtung: Buchungsrichtung;
    betrag_netto: string;
    betrag_ust: string;
    betrag_brutto: string;
    steuersatz: KassenbuchEintrag["steuersatz"];
    text: string;
    kategorie: string;
    kontakt: string | null;
  },
  opts: { eintragId: string; belegnummer: string },
): JournalBuchungInput {
  const buchungstext = buildBuchungstextFromKasse({
    ...entry,
    belegnummer: opts.belegnummer,
  });

  return {
    buchungsdatum: entry.datum,
    belegdatum: entry.datum,
    buchungstext,
    richtung: entry.richtung,
    betrag_netto: entry.betrag_netto,
    betrag_ust: entry.betrag_ust,
    betrag_brutto: entry.betrag_brutto,
    steuersatz: entry.steuersatz,
    kontakt: entry.kontakt,
    quelle_typ: "kasse",
    quelle_id: opts.eintragId,
  };
}

/**
 * Baut die Kassenbuch-Gegenbuchung (Storno) — Beträge absolut, Richtung invertiert.
 */
export function buildKassenbuchStornoInput(
  original: KassenbuchEintrag,
  opts?: { datum?: string; text?: string },
): KassenbuchInput {
  const datum = opts?.datum?.trim() || todayBerlin();
  if (!isValidIsoDate(datum)) {
    throw new Error("Datum der Gegenbuchung muss YYYY-MM-DD sein.");
  }

  const text =
    opts?.text?.trim() ||
    `Storno zu ${original.belegnummer}: ${original.text}`.slice(0, 500);

  return {
    datum,
    richtung: invertRichtung(original.richtung),
    betrag_netto: original.betrag_netto,
    betrag_ust: original.betrag_ust,
    betrag_brutto: original.betrag_brutto,
    steuersatz: original.steuersatz,
    text,
    kategorie: original.kategorie || undefined,
    notiz: original.notiz || undefined,
    kontakt: original.kontakt,
  };
}

export function assertImmutableWriteBlocked(
  operation: "update" | "delete",
): never {
  throw new Error(`${IMMUTABLE_ERROR} (versucht: ${operation})`);
}

export function assertCanStornieren(
  entry: Pick<KassenbuchEintrag, "storno_von">,
  existingStorno: KassenbuchEintrag | null,
): void {
  if (entry.storno_von) {
    throw new Error(STORNO_VON_STORNO_ERROR);
  }
  if (existingStorno) {
    throw new Error(
      `${STORNO_BEREITS_ERROR} (Gegenbuchung ${existingStorno.belegnummer}).`,
    );
  }
}
