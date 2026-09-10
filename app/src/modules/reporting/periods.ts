/**
 * Periodenlogik Europe/Berlin (ADR-0016).
 * Steuerliche Tagesgrenzen = Kalendertag Berlin, nicht UTC-Mitternacht.
 */

import { isValidIsoDate, todayBerlin } from "@/modules/journal/invariants";
import type { Zeitraum, ZeitraumPreset } from "./types";

export { isValidIsoDate, todayBerlin };

/** YYYY-MM-DD in Europe/Berlin aus Date (oder „jetzt“) */
export function dateToBerlinYmd(d: Date = new Date()): string {
  return todayBerlin(d);
}

/**
 * Teile YYYY-MM-DD in Jahr/Monat/Tag (keine TZ-Umrechnung — bereits Kalendertag).
 */
export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  if (!isValidIsoDate(ymd)) {
    throw new Error(`Ungültiges Datum: ${ymd}`);
  }
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Kalendermonate verschieben (Monat 1–12, Jahr kann springen). */
export function addCalendarMonths(
  y: number,
  m: number,
  delta: number,
): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  return { y: ny, m: idx - ny * 12 + 1 };
}

/** Kalendertage auf YYYY-MM-DD (UTC-Datumskonstruktion, keine Uhrzeit). */
export function addDaysYmd(iso: string, days: number): string {
  const { y, m, d } = parseYmd(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Ganze Kalendertage von `from` bis `to` (kann negativ sein). */
export function daysBetweenYmd(from: string, to: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  const da = Date.UTC(a.y, a.m - 1, a.d);
  const db = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((db - da) / 86_400_000);
}

/**
 * Die letzten `n` Kalendermonate inkl. Referenzmonat
 * (n=12 → von Monat−11 bis Monatsende).
 */
export function periodLastNMonths(n: number, refYmd?: string): Zeitraum {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("Anzahl Monate muss eine ganze Zahl ≥ 1 sein.");
  }
  const ref = refYmd ?? todayBerlin();
  const { y, m } = parseYmd(ref);
  const start = addCalendarMonths(y, m, -(n - 1));
  return {
    von: ymd(start.y, start.m, 1),
    bis: ymd(y, m, lastDayOfMonth(y, m)),
  };
}

/** Kalendermonate im Zeitraum (jeweils 1. bis letzter Tag). */
export function monthsInZeitraum(z: Zeitraum): {
  von: string;
  bis: string;
  key: string;
  jahr: number;
  monat: number;
}[] {
  const valid = validateZeitraum(z);
  const start = parseYmd(valid.von);
  const end = parseYmd(valid.bis);
  const out: {
    von: string;
    bis: string;
    key: string;
    jahr: number;
    monat: number;
  }[] = [];
  let y = start.y;
  let m = start.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    out.push({
      von: ymd(y, m, 1),
      bis: ymd(y, m, lastDayOfMonth(y, m)),
      key: `${y}-${pad2(m)}`,
      jahr: y,
      monat: m,
    });
    const next = addCalendarMonths(y, m, 1);
    y = next.y;
    m = next.m;
  }
  return out;
}

/** Letzter Kalendertag des Monats (1–12) */
export function lastDayOfMonth(y: number, m: number): number {
  // Tag 0 des Folgemonats = letzter des aktuellen (UTC-Datumskonstruktion ok für Kalenderarithmetik)
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Quartal 1–4 aus Monat 1–12 */
export function quarterOfMonth(m: number): 1 | 2 | 3 | 4 {
  return (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Zeitraum: ganzer Kalendermonat (Europe/Berlin-Tag „heute“ oder übergeben) */
export function periodMonth(refYmd?: string): Zeitraum {
  const ref = refYmd ?? todayBerlin();
  const { y, m } = parseYmd(ref);
  return {
    von: ymd(y, m, 1),
    bis: ymd(y, m, lastDayOfMonth(y, m)),
  };
}

/** Zeitraum: Kalenderquartal */
export function periodQuarter(refYmd?: string): Zeitraum {
  const ref = refYmd ?? todayBerlin();
  const { y, m } = parseYmd(ref);
  const q = quarterOfMonth(m);
  const startM = (q - 1) * 3 + 1;
  const endM = startM + 2;
  return {
    von: ymd(y, startM, 1),
    bis: ymd(y, endM, lastDayOfMonth(y, endM)),
  };
}

/** Zeitraum: Kalenderjahr */
export function periodYear(refYmd?: string): Zeitraum {
  const ref = refYmd ?? todayBerlin();
  const { y } = parseYmd(ref);
  return {
    von: ymd(y, 1, 1),
    bis: ymd(y, 12, 31),
  };
}

/** Default für EÜR, Auswertungen und die KPI-Karten unter `/app`. */
export const DEFAULT_AUSWERTUNG_PRESET: ZeitraumPreset = "jahr";

export function periodFromPreset(
  preset: ZeitraumPreset,
  refYmd?: string,
  custom?: { von?: string; bis?: string },
): Zeitraum {
  if (preset === "monat") return periodMonth(refYmd);
  if (preset === "quartal") return periodQuarter(refYmd);
  if (preset === "jahr") return periodYear(refYmd);
  return validateZeitraum({
    von: custom?.von ?? periodMonth(refYmd).von,
    bis: custom?.bis ?? periodMonth(refYmd).bis,
  });
}

export function normalizeZeitraumPreset(
  raw: string | undefined,
  fallback: ZeitraumPreset = "monat",
): ZeitraumPreset {
  const v = (raw ?? fallback).trim().toLowerCase();
  if (v === "monat" || v === "quartal" || v === "jahr" || v === "custom") {
    return v;
  }
  return fallback;
}

/**
 * Validiert inklusiven Zeitraum (von ≤ bis, beide gültige ISO-Tage).
 */
export function validateZeitraum(z: Zeitraum): Zeitraum {
  const von = z.von.trim();
  const bis = z.bis.trim();
  if (!isValidIsoDate(von)) {
    throw new Error("Zeitraum „von“ muss YYYY-MM-DD sein.");
  }
  if (!isValidIsoDate(bis)) {
    throw new Error("Zeitraum „bis“ muss YYYY-MM-DD sein.");
  }
  if (von > bis) {
    throw new Error("Zeitraum „von“ darf nicht nach „bis“ liegen.");
  }
  return { von, bis };
}

/**
 * Query-Params → Zeitraum.
 * preset=monat|quartal|jahr|custom; bei custom: von/bis.
 * Default ohne preset: aktueller Monat; Auswertungen übergeben DEFAULT_AUSWERTUNG_PRESET (Jahr).
 */
export function zeitraumFromSearchParams(
  sp: {
    preset?: string;
    von?: string;
    bis?: string;
    ref?: string;
  },
  defaultPreset: ZeitraumPreset = "monat",
): Zeitraum {
  const preset = normalizeZeitraumPreset(sp.preset, defaultPreset);

  const ref = sp.ref?.trim();
  if (ref && !isValidIsoDate(ref)) {
    throw new Error("Referenzdatum muss YYYY-MM-DD sein.");
  }

  if (preset === "custom") {
    const von = sp.von?.trim();
    const bis = sp.bis?.trim();
    if (!von || !bis) {
      // Fallback Monat wenn custom unvollständig
      return periodMonth(ref);
    }
    return validateZeitraum({ von, bis });
  }

  return periodFromPreset(preset, ref);
}

/** Inklusiv: buchungsdatum im [von, bis] (lexikographisch ok für YYYY-MM-DD) */
export function isDateInZeitraum(ymdDate: string, z: Zeitraum): boolean {
  if (!ymdDate || ymdDate.length < 10) return false;
  const d = ymdDate.slice(0, 10);
  return d >= z.von && d <= z.bis;
}
