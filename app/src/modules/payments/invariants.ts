/**
 * Reine Domain-Invarianten Zahlungen (ohne I/O).
 * Teilzahlung: Summe der Zahlungen ≤ Rechnungs-Brutto.
 * Status light aus Zahlungen + Fälligkeit ableiten.
 * Journal: Zufluss je Zahlung (ADR-0024), anteilig nach Steuerstaffel.
 */

import {
  money,
  moneyToString,
  roundMoney,
  subMoney,
  sumMoney,
} from "@/lib/money";
import type { JournalBuchungInput, Steuersatz } from "@/modules/journal/types";
import {
  isValidIsoDate,
  normalizeBetragInput,
  todayBerlin,
} from "@/modules/journal/invariants";
import {
  einheitlicherSteuersatz,
  ustStaffelAusPositionen,
} from "@/modules/sales/invariants";
import type {
  Rechnung,
  RechnungStatus,
  Rechnungsposition,
} from "@/modules/sales/types";
import type { Zahlung, ZahlungInput, Zahlungsweg } from "./types";

export { isValidIsoDate, todayBerlin, normalizeBetragInput };

const VALID_ZAHLUNGSWEG = new Set<Zahlungsweg>([
  "bar",
  "ueberweisung",
  "sonstiges",
]);

/** Status, auf die eine Zahlung gebucht werden darf */
export const ZAHLUNGSFAEHIGE_STATUS = new Set<RechnungStatus>([
  "offen",
  "teilbezahlt",
  "ueberfaellig",
]);

export const ZAHLUNG_UEBERZAHLUNG_ERROR =
  "Zahlung würde den Rechnungsbetrag überschreiten (Überzahlung nicht erlaubt).";

export const ZAHLUNG_ENTWURF_ERROR =
  "Zahlungen sind nur auf festgeschriebene Rechnungen möglich.";

export const ZAHLUNG_BEZAHLT_ERROR =
  "Die Rechnung ist bereits vollständig bezahlt.";

export const ZAHLUNG_STORNIERT_ERROR =
  "Auf stornierte Rechnungen können keine Zahlungen erfasst werden.";

export type ValidatedZahlungInput = {
  rechnung: string;
  datum: string;
  betrag: string;
  zahlungsweg: Zahlungsweg | "";
  notiz: string;
};

/** Validiert und normalisiert eine Zahlungseingabe (ohne Rechnungs-Kontext). */
export function validateZahlungInput(input: ZahlungInput): ValidatedZahlungInput {
  const rechnung = (input.rechnung ?? "").trim();
  if (!rechnung) {
    throw new Error("Rechnung ist erforderlich.");
  }

  const datum = (input.datum ?? "").trim();
  if (!isValidIsoDate(datum)) {
    throw new Error("Zahlungsdatum muss YYYY-MM-DD sein.");
  }

  const betrag = normalizeBetragInput(input.betrag ?? "", "Betrag");
  if (money(betrag).lte(0)) {
    throw new Error("Betrag muss größer als 0 sein.");
  }

  let zahlungsweg: Zahlungsweg | "" = "";
  const rawWeg = (input.zahlungsweg ?? "").trim();
  if (rawWeg) {
    if (!VALID_ZAHLUNGSWEG.has(rawWeg as Zahlungsweg)) {
      throw new Error("Ungültiger Zahlungsweg.");
    }
    zahlungsweg = rawWeg as Zahlungsweg;
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  return { rechnung, datum, betrag, zahlungsweg, notiz };
}

/** Summe der Zahlungsbeträge (Decimal-String, 2 Stellen). */
export function sumZahlungen(
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): string {
  return moneyToString(
    roundMoney(
      zahlungen.reduce((acc, z) => acc.plus(money(z.betrag)), money(0)),
    ),
  );
}

/**
 * Offener Restbetrag = Brutto − Summe Zahlungen (min. 0).
 * Negativ wird nicht zurückgegeben (Überzahlung wird vorher abgelehnt).
 */
export function offenerBetrag(
  betragBrutto: string,
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): string {
  const bezahlt = sumZahlungen(zahlungen);
  const rest = subMoney(betragBrutto, bezahlt);
  if (rest.lte(0)) {
    return "0.00";
  }
  return moneyToString(roundMoney(rest));
}

/**
 * Prüft, ob eine neue Zahlung (oder alle inkl. candidate) den Brutto nicht übersteigt.
 */
export function assertKeineUeberzahlung(
  betragBrutto: string,
  bestehende: Array<Pick<Zahlung, "betrag">>,
  neuerBetrag: string,
): void {
  const summe = moneyToString(
    roundMoney(sumMoney(sumZahlungen(bestehende), neuerBetrag)),
  );
  if (money(summe).gt(money(betragBrutto))) {
    throw new Error(ZAHLUNG_UEBERZAHLUNG_ERROR);
  }
}

/**
 * Rechnung muss zahlungsfähig sein (festgeschrieben, nicht bezahlt/storniert).
 */
export function assertRechnungZahlungsfaehig(
  rechnung: Pick<Rechnung, "status" | "betrag_brutto">,
): void {
  if (rechnung.status === "entwurf") {
    throw new Error(ZAHLUNG_ENTWURF_ERROR);
  }
  if (rechnung.status === "storniert") {
    throw new Error(ZAHLUNG_STORNIERT_ERROR);
  }
  if (rechnung.status === "bezahlt") {
    throw new Error(ZAHLUNG_BEZAHLT_ERROR);
  }
  if (!ZAHLUNGSFAEHIGE_STATUS.has(rechnung.status)) {
    // Fallback für unbekannte/erweiterte Status
    throw new Error(ZAHLUNG_ENTWURF_ERROR);
  }
}

/**
 * Leitet Rechnungsstatus aus Zahlungen + Fälligkeit ab.
 *
 * - bezahlt: offener Betrag = 0
 * - teilbezahlt: 0 < bezahlt < brutto (auch wenn überfällig — Teilzahlung priorisieren)
 * - ueberfaellig: nichts bezahlt und faellig_am < heute
 * - offen: nichts bezahlt und (kein Fälligkeitsdatum oder noch nicht fällig)
 * - storniert/entwurf: unverändert (nicht aus Zahlungen ableiten)
 */
export function deriveRechnungStatus(opts: {
  currentStatus: RechnungStatus;
  betragBrutto: string;
  zahlungen: Array<Pick<Zahlung, "betrag">>;
  faellig_am?: string;
  /** Referenzdatum YYYY-MM-DD (Europe/Berlin), Default: heute */
  heute?: string;
}): RechnungStatus {
  const { currentStatus, betragBrutto, zahlungen } = opts;
  if (currentStatus === "entwurf" || currentStatus === "storniert") {
    return currentStatus;
  }

  const bezahlt = money(sumZahlungen(zahlungen));
  const brutto = money(betragBrutto);
  const offen = brutto.minus(bezahlt);

  if (offen.lte(0) || bezahlt.gte(brutto)) {
    return "bezahlt";
  }

  if (bezahlt.gt(0)) {
    return "teilbezahlt";
  }

  const heute = opts.heute ?? todayBerlin();
  const faellig = (opts.faellig_am ?? "").trim();
  if (faellig && isValidIsoDate(faellig) && faellig < heute) {
    return "ueberfaellig";
  }

  return "offen";
}

export function parseZahlungsweg(raw: string): Zahlungsweg | "" {
  return VALID_ZAHLUNGSWEG.has(raw as Zahlungsweg)
    ? (raw as Zahlungsweg)
    : "";
}

/** Steueranteil einer Zahlung (eine Journal-Zeile). */
export type ZahlungSteueranteil = {
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

const ZAHLUNGSWEG_TEXT: Record<Zahlungsweg, string> = {
  bar: "Bar",
  ueberweisung: "Überweisung",
  sonstiges: "Sonstiges",
};

function staffelMitBrutto(
  rows: Array<{
    steuersatz: Steuersatz | "";
    betrag_netto: string;
    betrag_ust: string;
    betrag_brutto?: string;
  }>,
): ZahlungSteueranteil[] {
  return rows.map((r) => ({
    steuersatz: r.steuersatz,
    betrag_netto: moneyToString(roundMoney(money(r.betrag_netto))),
    betrag_ust: moneyToString(roundMoney(money(r.betrag_ust))),
    betrag_brutto: moneyToString(
      roundMoney(
        r.betrag_brutto != null && r.betrag_brutto !== ""
          ? money(r.betrag_brutto)
          : sumMoney(r.betrag_netto, r.betrag_ust),
      ),
    ),
  }));
}

/** Rechnungs-Staffel für die Zahlungsaufteilung (Positionen, sonst Kopf). */
export function rechnungStaffelFuerZahlung(
  rechnung: Pick<
    Rechnung,
    "betrag_netto" | "betrag_ust" | "betrag_brutto" | "steuermodus"
  >,
  positionen: Array<
    Pick<Rechnungsposition, "steuersatz" | "betrag_netto" | "betrag_ust">
  >,
): ZahlungSteueranteil[] {
  if (positionen.length > 0) {
    return staffelMitBrutto(ustStaffelAusPositionen(positionen));
  }
  return staffelMitBrutto([
    {
      steuersatz: einheitlicherSteuersatz([], rechnung.steuermodus),
      betrag_netto: rechnung.betrag_netto,
      betrag_ust: rechnung.betrag_ust,
      betrag_brutto: rechnung.betrag_brutto,
    },
  ]);
}

function summiereAnteile(
  lines: ZahlungSteueranteil[],
): Map<string, ZahlungSteueranteil> {
  const map = new Map<
    string,
    { netto: ReturnType<typeof money>; ust: ReturnType<typeof money>; brutto: ReturnType<typeof money> }
  >();
  for (const l of lines) {
    const cur = map.get(l.steuersatz) ?? {
      netto: money(0),
      ust: money(0),
      brutto: money(0),
    };
    cur.netto = cur.netto.plus(money(l.betrag_netto));
    cur.ust = cur.ust.plus(money(l.betrag_ust));
    cur.brutto = cur.brutto.plus(money(l.betrag_brutto));
    map.set(l.steuersatz, cur);
  }
  const out = new Map<string, ZahlungSteueranteil>();
  for (const [satz, v] of map) {
    out.set(satz, {
      steuersatz: satz as Steuersatz | "",
      betrag_netto: moneyToString(roundMoney(v.netto)),
      betrag_ust: moneyToString(roundMoney(v.ust)),
      betrag_brutto: moneyToString(roundMoney(v.brutto)),
    });
  }
  return out;
}

/**
 * Teilt einen Zahlungs-Bruttobetrag auf die offene Steuerstaffel.
 * Letzte Zahlung (vollstaendig) nimmt den Rest je Satz — kein Cent-Drift.
 */
export function allocateZahlungAufStaffel(opts: {
  zahlungsbetrag: string;
  rechnungStaffel: ZahlungSteueranteil[];
  bereits: ZahlungSteueranteil[];
  vollstaendig: boolean;
}): ZahlungSteueranteil[] {
  const invoice = staffelMitBrutto(opts.rechnungStaffel);
  if (invoice.length === 0) {
    throw new Error("Keine Steuerstaffel für die Zahlung.");
  }

  const already = summiereAnteile(opts.bereits);
  const remaining: ZahlungSteueranteil[] = [];
  for (const row of invoice) {
    const done = already.get(row.steuersatz);
    const netto = money(row.betrag_netto).minus(money(done?.betrag_netto ?? 0));
    const ust = money(row.betrag_ust).minus(money(done?.betrag_ust ?? 0));
    const brutto = money(row.betrag_brutto).minus(money(done?.betrag_brutto ?? 0));
    if (netto.lte(0) && ust.lte(0) && brutto.lte(0)) continue;
    remaining.push({
      steuersatz: row.steuersatz,
      betrag_netto: moneyToString(roundMoney(netto)),
      betrag_ust: moneyToString(roundMoney(ust)),
      betrag_brutto: moneyToString(roundMoney(brutto)),
    });
  }

  const remainingBrutto = remaining.reduce(
    (acc, r) => acc.plus(money(r.betrag_brutto)),
    money(0),
  );
  const pay = money(opts.zahlungsbetrag);
  if (remaining.length === 0 || remainingBrutto.lte(0)) {
    throw new Error("Keine offene Steuerstaffel für die Zahlung.");
  }

  if (opts.vollstaendig || pay.gte(remainingBrutto)) {
    return remaining.filter((r) => money(r.betrag_brutto).gt(0));
  }

  const result: ZahlungSteueranteil[] = [];
  let allocatedBrutto = money(0);
  for (let i = 0; i < remaining.length; i++) {
    const row = remaining[i]!;
    const isLast = i === remaining.length - 1;
    const brutto = isLast
      ? roundMoney(pay.minus(allocatedBrutto))
      : roundMoney(
          money(row.betrag_brutto).times(pay).dividedBy(remainingBrutto),
        );
    if (!isLast) {
      allocatedBrutto = allocatedBrutto.plus(brutto);
    }
    if (brutto.lte(0)) continue;

    const rowBrutto = money(row.betrag_brutto);
    const netto = rowBrutto.isZero()
      ? money(0)
      : roundMoney(money(row.betrag_netto).times(brutto).dividedBy(rowBrutto));
    const ust = roundMoney(brutto.minus(netto));
    result.push({
      steuersatz: row.steuersatz,
      betrag_netto: moneyToString(netto),
      betrag_ust: moneyToString(ust),
      betrag_brutto: moneyToString(brutto),
    });
  }
  return result;
}

export function buildBuchungstextFromZahlung(opts: {
  rechnungsnummer: string;
  zahlungsweg?: Zahlungsweg | "";
  steuersatz?: Steuersatz | "";
  mehrereSaetze?: boolean;
}): string {
  const nr = opts.rechnungsnummer.trim() || "Rechnung";
  const weg =
    opts.zahlungsweg && opts.zahlungsweg in ZAHLUNGSWEG_TEXT
      ? ZAHLUNGSWEG_TEXT[opts.zahlungsweg]
      : "";
  const kopf = weg ? `Zahlung (${weg}) zu Rechnung ${nr}` : `Zahlung zu Rechnung ${nr}`;
  if (opts.mehrereSaetze && opts.steuersatz) {
    return `${kopf} — ${opts.steuersatz} %`.slice(0, 500);
  }
  return kopf.slice(0, 500);
}

/** Journal-Eingaben einer Zahlung (eine Zeile je offenem Steuersatz). */
export function buildJournalInputsFromZahlung(opts: {
  zahlung: Pick<Zahlung, "id" | "datum" | "betrag" | "zahlungsweg">;
  rechnung: Pick<
    Rechnung,
    | "rechnungsnummer"
    | "rechnungsdatum"
    | "kunde"
    | "betrag_netto"
    | "betrag_ust"
    | "betrag_brutto"
    | "steuermodus"
  >;
  positionen: Array<
    Pick<Rechnungsposition, "steuersatz" | "betrag_netto" | "betrag_ust">
  >;
  bereits: ZahlungSteueranteil[];
  vollstaendig: boolean;
}): JournalBuchungInput[] {
  const staffel = rechnungStaffelFuerZahlung(opts.rechnung, opts.positionen);
  const anteile = allocateZahlungAufStaffel({
    zahlungsbetrag: opts.zahlung.betrag,
    rechnungStaffel: staffel,
    bereits: opts.bereits,
    vollstaendig: opts.vollstaendig,
  });
  const mehrere = anteile.length > 1;
  return anteile.map((a) => ({
    buchungsdatum: opts.zahlung.datum,
    belegdatum: opts.rechnung.rechnungsdatum,
    buchungstext: buildBuchungstextFromZahlung({
      rechnungsnummer: opts.rechnung.rechnungsnummer,
      zahlungsweg: opts.zahlung.zahlungsweg,
      steuersatz: a.steuersatz,
      mehrereSaetze: mehrere,
    }),
    richtung: "einnahme" as const,
    betrag_netto: a.betrag_netto,
    betrag_ust: a.betrag_ust,
    betrag_brutto: a.betrag_brutto,
    steuersatz: a.steuersatz,
    kontakt: opts.rechnung.kunde,
    quelle_typ: "zahlung",
    quelle_id: opts.zahlung.id,
  }));
}
