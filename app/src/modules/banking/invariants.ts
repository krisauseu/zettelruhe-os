/**
 * Reine Domain-Invarianten Banking (ohne I/O).
 * Idempotenz-Schlüssel, IBAN light, Match-Score, Betrags-/Datums-Normalisierung.
 */

import { createHash } from "node:crypto";
import { money, moneyToString, roundMoney } from "@/lib/money";
import {
  isValidIsoDate,
  normalizeBetragInput,
  todayBerlin,
} from "@/modules/journal/invariants";
import type {
  BankBewegungRichtung,
  BankBewegungStatus,
  BankkontoInput,
  ParsedBankZeile,
} from "./types";

export { isValidIsoDate, todayBerlin, normalizeBetragInput };

const VALID_RICHTUNG = new Set<BankBewegungRichtung>(["eingang", "ausgang"]);
const VALID_STATUS = new Set<BankBewegungStatus>([
  "offen",
  "gematcht",
  "ignoriert",
]);

export const BANK_MATCH_NICHT_EINGANG_ERROR =
  "Nur Zahlungseingänge können einer Rechnung zugeordnet werden.";

export const BANK_MATCH_NICHT_OFFEN_ERROR =
  "Diese Auszugszeile ist bereits zugeordnet oder ignoriert.";

export const BANK_MATCH_BETRAG_ERROR =
  "Der Betrag der Auszugszeile übersteigt den offenen Rechnungsbetrag.";

/** Validiert Bankkonto-Stammdaten. */
export function validateBankkontoInput(input: BankkontoInput): {
  name: string;
  iban: string;
  bic: string;
  kontoinhaber: string;
  aktiv: boolean;
  notiz: string;
} {
  const name = (input.name ?? "").trim();
  if (!name) {
    throw new Error("Name des Bankkontos ist erforderlich.");
  }
  if (name.length > 120) {
    throw new Error("Name ist zu lang (max. 120 Zeichen).");
  }

  const iban = normalizeIban(input.iban ?? "");
  if (iban && !isPlausibleIban(iban)) {
    throw new Error("IBAN ist ungültig (Format).");
  }

  const bic = (input.bic ?? "").trim().replace(/\s+/g, "").toUpperCase();
  if (bic && (bic.length < 8 || bic.length > 11)) {
    throw new Error("BIC muss 8–11 Zeichen haben.");
  }

  const kontoinhaber = (input.kontoinhaber ?? "").trim();
  if (kontoinhaber.length > 120) {
    throw new Error("Kontoinhaber ist zu lang (max. 120 Zeichen).");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const aktiv = input.aktiv !== false;

  return { name, iban, bic, kontoinhaber, aktiv, notiz };
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Light IBAN-Check: Länge + Ländercode + alphanumerisch (kein Mod-97-Vollcheck nötig). */
export function isPlausibleIban(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;
  return true;
}

/**
 * Normalisiert Geldeingabe inkl. Vorzeichen → absoluter Betrag + Richtung.
 * Negativ / Soll → ausgang; positiv / Haben → eingang.
 * Optional: explizite Richtung überschreibt das Vorzeichen (Betrag absolut).
 */
export function parseSignedBetrag(
  raw: string,
  richtungHint?: BankBewegungRichtung | "",
): { betrag: string; richtung: BankBewegungRichtung } {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    throw new Error("Betrag ist erforderlich.");
  }

  let s = trimmed;
  // de-DE: 1.234,56 vs 1234.56
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  // Vorzeichen / Klammern
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("+")) {
    s = s.slice(1);
  } else if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  const d = money(s);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error("Ungültiger Betrag.");
  }
  if (d.lte(0) && !negative && !richtungHint) {
    // 0 abgelehnt; negatives Vorzeichen bereits abgezogen
    if (d.eq(0)) {
      throw new Error("Betrag muss ungleich 0 sein.");
    }
  }
  const abs = d.abs();
  if (abs.lte(0)) {
    throw new Error("Betrag muss ungleich 0 sein.");
  }

  const betrag = moneyToString(roundMoney(abs));
  if (richtungHint === "eingang" || richtungHint === "ausgang") {
    return { betrag, richtung: richtungHint };
  }
  return { betrag, richtung: negative ? "ausgang" : "eingang" };
}

/**
 * Datum aus de-DE (TT.MM.JJJJ) oder ISO (YYYY-MM-DD) → ISO.
 */
export function parseBankDatum(raw: string): string {
  const t = raw.trim();
  if (!t) {
    throw new Error("Datum ist erforderlich.");
  }
  if (isValidIsoDate(t)) {
    return t;
  }
  // TT.MM.JJJJ oder TT.MM.JJ
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const dd = m[1]!.padStart(2, "0");
    const mm = m[2]!.padStart(2, "0");
    let yyyy = m[3]!;
    if (yyyy.length === 2) {
      const n = Number.parseInt(yyyy, 10);
      yyyy = n >= 70 ? `19${yyyy}` : `20${yyyy.padStart(2, "0")}`;
    }
    const iso = `${yyyy}-${mm}-${dd}`;
    if (!isValidIsoDate(iso)) {
      throw new Error(`Ungültiges Datum: ${raw}`);
    }
    return iso;
  }
  throw new Error(`Ungültiges Datum: ${raw}`);
}

/** Whitespace/Case-Normalisierung für Idempotenz und Matching. */
export function normalizeTextKey(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Idempotenz-Schlüssel einer Auszugszeile.
 * Dokumentiert: SHA-256 hex der kanonischen Felder
 *   bankkonto|datum|richtung|betrag|verwendungszweck|gegenkonto_iban|referenz
 * (normalisiert). Gleicher Import → gleicher Schlüssel → kein Doppel-Eintrag.
 */
export function buildIdempotenzSchluessel(
  bankkontoId: string,
  zeile: Pick<
    ParsedBankZeile,
    | "datum"
    | "richtung"
    | "betrag"
    | "verwendungszweck"
    | "gegenkonto_iban"
    | "referenz"
  >,
): string {
  const canonical = [
    bankkontoId,
    zeile.datum,
    zeile.richtung,
    moneyToString(roundMoney(zeile.betrag)),
    normalizeTextKey(zeile.verwendungszweck ?? ""),
    normalizeIban(zeile.gegenkonto_iban ?? ""),
    normalizeTextKey(zeile.referenz ?? ""),
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function isValidRichtung(v: string): v is BankBewegungRichtung {
  return VALID_RICHTUNG.has(v as BankBewegungRichtung);
}

export function isValidStatus(v: string): v is BankBewegungStatus {
  return VALID_STATUS.has(v as BankBewegungStatus);
}

/**
 * Extrahiert mögliche Rechnungsnummern aus Verwendungszweck/Referenz.
 * Light: Muster R-0001, RE-2024-12, RE2024001, #1234, reine Nummern mit Präfix.
 */
export function extractRechnungsnummernCandidates(text: string): string[] {
  const t = text ?? "";
  const found = new Set<string>();

  // Präfix + Ziffern (R-0001, RE-2024-0001, RG 123)
  const re1 =
    /\b((?:RE|RG|RECHNUNG|R)[\s\-./]*\d{1,4}(?:[\s\-./]*\d{1,6})?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(t)) !== null) {
    found.add(normalizeRechnungsnummer(m[1]!));
  }

  // Explizit "Rechnung 123" / "Rechnung Nr. 123"
  const re2 = /\brechnung(?:\s*nr\.?)?\s*[:#]?\s*([A-Z0-9\-./]{2,20})\b/gi;
  while ((m = re2.exec(t)) !== null) {
    found.add(normalizeRechnungsnummer(m[1]!));
  }

  return [...found].filter(Boolean);
}

export function normalizeRechnungsnummer(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "-")
    .replace(/\/+/g, "-");
}

/**
 * Match-Score light (0–100) für Eingang → offene Rechnung.
 * - Betrag exakt = offener Rest: +50
 * - Betrag exakt = Brutto: +40
 * - Rechnungsnummer im Verwendungszweck/Referenz: +40
 * - Teilstring Nummer: +25
 * - Datum nah (±14 Tage): +10
 */
export function scoreMatch(opts: {
  bewegungBetrag: string;
  bewegungDatum: string;
  verwendungszweck: string;
  referenz: string;
  rechnungsnummer: string;
  offen: string;
  brutto: string;
  rechnungsdatum: string;
}): { score: number; gruende: string[] } {
  const gruende: string[] = [];
  let score = 0;

  const bBetrag = money(opts.bewegungBetrag);
  const offen = money(opts.offen);
  const brutto = money(opts.brutto);

  if (bBetrag.eq(offen) && offen.gt(0)) {
    score += 50;
    gruende.push("Betrag = offener Rest");
  } else if (bBetrag.eq(brutto) && brutto.gt(0)) {
    score += 40;
    gruende.push("Betrag = Rechnungsbetrag");
  } else if (bBetrag.gt(0) && bBetrag.lte(offen)) {
    score += 15;
    gruende.push("Betrag ≤ offener Rest (Teilzahlung möglich)");
  }

  const hay = normalizeTextKey(
    `${opts.verwendungszweck} ${opts.referenz}`,
  );
  const nr = (opts.rechnungsnummer ?? "").trim();
  if (nr) {
    const nrNorm = normalizeRechnungsnummer(nr);
    const nrLoose = nrNorm.replace(/-/g, "");
    const candidates = extractRechnungsnummernCandidates(
      `${opts.verwendungszweck} ${opts.referenz}`,
    );
    if (
      candidates.some(
        (c) => c === nrNorm || c.replace(/-/g, "") === nrLoose,
      )
    ) {
      score += 40;
      gruende.push("Rechnungsnummer im Verwendungszweck");
    } else if (
      hay.includes(normalizeTextKey(nr)) ||
      hay.includes(nrLoose.toLowerCase())
    ) {
      score += 25;
      gruende.push("Rechnungsnummer als Teilstring");
    }
  }

  if (
    isValidIsoDate(opts.bewegungDatum) &&
    isValidIsoDate(opts.rechnungsdatum)
  ) {
    const d1 = Date.parse(`${opts.bewegungDatum}T12:00:00Z`);
    const d2 = Date.parse(`${opts.rechnungsdatum}T12:00:00Z`);
    if (Number.isFinite(d1) && Number.isFinite(d2)) {
      const days = Math.abs(d1 - d2) / (86400 * 1000);
      if (days <= 14) {
        score += 10;
        gruende.push("Datum nahe am Rechnungsdatum");
      }
    }
  }

  return { score: Math.min(100, score), gruende };
}

/** Mindest-Score für Auto-Vorschlag in der UI (Bestätigung nötig). */
export const MATCH_VORSCHLAG_MIN_SCORE = 40;
