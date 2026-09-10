/**
 * § 19 UStG — Grenzen der Kleinunternehmerregelung.
 * Staffel nach Geltungsbeginn; keine geratenen Defaults.
 *
 * Quelle (Stand 2026-08-17):
 * https://www.gesetze-im-internet.de/ustg_1980/__19.html
 * § 19 Abs. 1 Satz 1: Gesamtumsatz vorangegangenes Kalenderjahr 25 000 €
 * nicht überschritten und laufendes Kalenderjahr 100 000 € nicht überschreitet.
 * Abs. 2: Gesamtumsatz nach vereinnahmten Entgelten (passt zur Zufluss-Logik),
 * abzüglich bestimmter Steuerbefreiungen und ohne Anlagevermögen.
 * Das Widget zeigt Jahresumsatz light aus dem Journal, nicht den amtlichen
 * Gesamtumsatz nach Abs. 2.
 */

import { formatMoneyDe, money, moneyToString } from "@/lib/money";
import { isValidIsoDate } from "@/modules/journal/invariants";
import type { Steuermodus } from "@/lib/pb";

export type Par19Grenze = {
  geltung_ab: string;
  vorjahr_euro: string;
  laufend_euro: string;
  quelle: string;
};

export type Par19Ampel = "entspannt" | "achtung" | "nahe_der_grenze";

export type Par19Waechter = {
  kalenderjahr: number;
  umsatz_brutto: string;
  grenze_vorjahr: string;
  grenze_laufend: string;
  geltung_ab: string;
  quelle: string;
  /** Anteil an der Vorjahresgrenze (kann > 1 sein). */
  anteil_vorjahr: number;
  anteil_laufend: number;
  ampel: Par19Ampel;
  hinweis: string;
};

/** Neueste zuerst. */
export const PAR19_GRENZEN: readonly Par19Grenze[] = [
  {
    geltung_ab: "2025-01-01",
    vorjahr_euro: "25000.00",
    laufend_euro: "100000.00",
    quelle: "§ 19 Abs. 1 Satz 1 UStG",
  },
  {
    geltung_ab: "2020-01-01",
    vorjahr_euro: "22000.00",
    laufend_euro: "50000.00",
    quelle: "§ 19 Abs. 1 UStG a.F. (bis 31.12.2024)",
  },
];

/** Anteil der Vorjahresgrenze: ab hier „Achtung“. */
export const PAR19_AMPEL_ACHTUNG = 0.7;
/** Anteil der Vorjahresgrenze: ab hier „nahe der Grenze“. */
export const PAR19_AMPEL_NAHE = 0.9;

const HINWEIS_LIGHT =
  "Jahresumsatz light aus dem Buchungsjournal nach Zufluss. Kein amtlicher Gesamtumsatz nach § 19 Abs. 2 (u. a. ohne Abzug von Anlagevermögen).";

export function par19GrenzeAm(ymd: string): Par19Grenze {
  if (!isValidIsoDate(ymd)) {
    throw new Error(`Ungültiges Datum für §-19-Staffel: ${ymd}`);
  }
  const match = PAR19_GRENZEN.find((g) => ymd >= g.geltung_ab);
  if (!match) {
    throw new Error(`Keine §-19-Staffel für ${ymd}.`);
  }
  return match;
}

export function par19Ampel(
  umsatz: string,
  grenzeVorjahr: string,
  grenzeLaufend: string,
): Par19Ampel {
  const u = money(umsatz);
  const vorjahr = money(grenzeVorjahr);
  const laufend = money(grenzeLaufend);
  if (u.gte(laufend) || u.gte(vorjahr.times(PAR19_AMPEL_NAHE))) {
    return "nahe_der_grenze";
  }
  if (u.gte(vorjahr.times(PAR19_AMPEL_ACHTUNG))) {
    return "achtung";
  }
  return "entspannt";
}

function par19Hinweis(
  umsatz: string,
  grenzeVorjahr: string,
  grenzeLaufend: string,
  ampel: Par19Ampel,
): string {
  const u = money(umsatz);
  const vorjahr = money(grenzeVorjahr);
  const laufend = money(grenzeLaufend);
  if (u.gte(laufend)) {
    return `Höchstgrenze des laufenden Kalenderjahrs überschritten. ${HINWEIS_LIGHT}`;
  }
  if (u.gte(vorjahr)) {
    return `Vorjahresgrenze überschritten (maßgeblich für das Folgejahr). Höchstgrenze im laufenden Kalenderjahr: ${formatMoneyDe(grenzeLaufend, { currency: true })}. ${HINWEIS_LIGHT}`;
  }
  if (ampel === "nahe_der_grenze") {
    return `Nahe der Vorjahresgrenze von ${formatMoneyDe(grenzeVorjahr, { currency: true })} (maßgeblich für das Folgejahr). ${HINWEIS_LIGHT}`;
  }
  if (ampel === "achtung") {
    return `Annäherung an die Vorjahresgrenze von ${formatMoneyDe(grenzeVorjahr, { currency: true })} (maßgeblich für das Folgejahr). ${HINWEIS_LIGHT}`;
  }
  return HINWEIS_LIGHT;
}

/**
 * Nur Kleinunternehmerregelung — sonst null (keine tote Karte).
 */
export function buildPar19Waechter(opts: {
  steuermodus: Steuermodus;
  umsatz_brutto: string;
  kalenderjahr: number;
  refYmd: string;
}): Par19Waechter | null {
  if (opts.steuermodus !== "kleinunternehmer") return null;
  const grenze = par19GrenzeAm(opts.refYmd);
  const vorjahr = money(grenze.vorjahr_euro);
  const laufend = money(grenze.laufend_euro);
  const umsatz = money(opts.umsatz_brutto);
  const anteil_vorjahr = vorjahr.isZero()
    ? 0
    : umsatz.dividedBy(vorjahr).toNumber();
  const anteil_laufend = laufend.isZero()
    ? 0
    : umsatz.dividedBy(laufend).toNumber();
  const ampel = par19Ampel(
    opts.umsatz_brutto,
    grenze.vorjahr_euro,
    grenze.laufend_euro,
  );
  return {
    kalenderjahr: opts.kalenderjahr,
    umsatz_brutto: moneyToString(umsatz),
    grenze_vorjahr: grenze.vorjahr_euro,
    grenze_laufend: grenze.laufend_euro,
    geltung_ab: grenze.geltung_ab,
    quelle: grenze.quelle,
    anteil_vorjahr,
    anteil_laufend,
    ampel,
    hinweis: par19Hinweis(
      opts.umsatz_brutto,
      grenze.vorjahr_euro,
      grenze.laufend_euro,
      ampel,
    ),
  };
}
