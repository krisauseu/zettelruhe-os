/**
 * CSV-Parser für Kontoauszüge (de-DE light).
 *
 * Default-Vorlage (Semikolon, de-DE Datum/Betrag):
 *
 *   Datum;Betrag;Verwendungszweck;Gegenkonto;IBAN;Referenz
 *   12.08.2026;119,00;Rechnung R-0001;Muster GmbH;DE89370400440532013000;R-0001
 *   13.08.2026;-25,50;Lastschrift Hosting;Provider AG;;
 *
 * - Delimiter: `;` oder `,` (auto)
 * - Betrag: de-DE (1.234,56) oder Punkt; negativ = Ausgang
 * - Optional: Spalte Richtung / Soll / Haben
 * - MT940: eigener Parser in mt940.ts, nicht hier
 */

import {
  isValidRichtung,
  parseBankDatum,
  parseSignedBetrag,
} from "./invariants";
import type { BankBewegungRichtung, ParsedBankZeile } from "./types";

export const BANK_CSV_HEADERS = [
  "datum",
  "betrag",
  "verwendungszweck",
  "gegenkonto",
  "iban",
  "referenz",
] as const;

/** Dokumentierte Default-Vorlage (Header-Zeile). */
export const BANK_CSV_DEFAULT_HEADER =
  "Datum;Betrag;Verwendungszweck;Gegenkonto;IBAN;Referenz";

type CanonicalField =
  | "datum"
  | "betrag"
  | "verwendungszweck"
  | "gegenkonto"
  | "iban"
  | "referenz"
  | "richtung"
  | "soll"
  | "haben";

const HEADER_ALIASES: Record<string, CanonicalField> = {
  datum: "datum",
  buchungstag: "datum",
  buchungsdatum: "datum",
  valutadatum: "datum",
  valuta: "datum",
  date: "datum",
  betrag: "betrag",
  amount: "betrag",
  umsatz: "betrag",
  "betrag (eur)": "betrag",
  verwendungszweck: "verwendungszweck",
  buchungstext: "verwendungszweck",
  text: "verwendungszweck",
  zweck: "verwendungszweck",
  purpose: "verwendungszweck",
  gegenkonto: "gegenkonto",
  auftraggeber: "gegenkonto",
  empfaenger: "gegenkonto",
  empfänger: "gegenkonto",
  name: "gegenkonto",
  partner: "gegenkonto",
  "name zahlungspflichtiger": "gegenkonto",
  iban: "iban",
  "iban auftraggeber": "iban",
  gegenkonto_iban: "iban",
  referenz: "referenz",
  kundenreferenz: "referenz",
  mandatsreferenz: "referenz",
  endtoendid: "referenz",
  "end-to-end-ref": "referenz",
  richtung: "richtung",
  typ: "richtung",
  soll: "soll",
  debit: "soll",
  haben: "haben",
  credit: "haben",
};

function detectDelimiter(headerLine: string): "," | ";" {
  const semi = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "");
}

/** RFC-4180-ähnlich, inkl. Quotes und Delimiter-Erkennung */
export function parseCsvRows(
  text: string,
  delimiter?: "," | ";",
): string[][] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!normalized.trim()) return [];

  const firstLine = normalized.split("\n")[0] ?? "";
  const delim = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // letzte Zeile
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function mapHeaders(headerRow: string[]): Map<CanonicalField, number> {
  const map = new Map<CanonicalField, number>();
  headerRow.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key && !map.has(key)) {
      map.set(key, i);
    }
  });
  return map;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return (row[idx] ?? "").trim();
}

function parseRichtungCell(raw: string): BankBewegungRichtung | "" {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (
    ["eingang", "gutschrift", "haben", "credit", "cr", "einnahme", "+"].includes(
      t,
    )
  ) {
    return "eingang";
  }
  if (
    ["ausgang", "lastschrift", "soll", "debit", "dr", "ausgabe", "-"].includes(t)
  ) {
    return "ausgang";
  }
  if (isValidRichtung(t)) return t;
  return "";
}

export type CsvParseResult = {
  zeilen: ParsedBankZeile[];
  /** Zeilenindex (1-basiert inkl. Header) + Meldung */
  fehler: Array<{ zeile: number; meldung: string }>;
  delimiter: "," | ";";
};

/**
 * Parst Kontoauszugs-CSV → normalisierte Zeilen.
 * Leere Datenzeilen werden übersprungen; Fehler pro Zeile gesammelt.
 */
export function parseBankCsv(text: string): CsvParseResult {
  const firstLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((l) => l.trim()) ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsvRows(text, delimiter);
  if (rows.length === 0) {
    return { zeilen: [], fehler: [{ zeile: 0, meldung: "CSV ist leer." }], delimiter };
  }

  const headerMap = mapHeaders(rows[0]!);
  if (!headerMap.has("datum")) {
    return {
      zeilen: [],
      fehler: [
        {
          zeile: 1,
          meldung:
            "Spalte „Datum“ fehlt. Erwartet u. a.: Datum;Betrag;Verwendungszweck;…",
        },
      ],
      delimiter,
    };
  }
  const hasBetrag = headerMap.has("betrag");
  const hasSollHaben =
    headerMap.has("soll") || headerMap.has("haben");
  if (!hasBetrag && !hasSollHaben) {
    return {
      zeilen: [],
      fehler: [
        {
          zeile: 1,
          meldung:
            "Spalte „Betrag“ oder „Soll“/„Haben“ fehlt.",
        },
      ],
      delimiter,
    };
  }

  const zeilen: ParsedBankZeile[] = [];
  const fehler: Array<{ zeile: number; meldung: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const lineNo = i + 1;
    // leere Zeile
    if (row.every((c) => !c.trim())) continue;

    try {
      const datumRaw = cell(row, headerMap.get("datum"));
      const datum = parseBankDatum(datumRaw);

      let betrag: string;
      let richtung: BankBewegungRichtung;

      const richtungHint = parseRichtungCell(
        cell(row, headerMap.get("richtung")),
      );

      if (hasBetrag) {
        const parsed = parseSignedBetrag(
          cell(row, headerMap.get("betrag")),
          richtungHint,
        );
        betrag = parsed.betrag;
        richtung = parsed.richtung;
      } else {
        const soll = cell(row, headerMap.get("soll"));
        const haben = cell(row, headerMap.get("haben"));
        if (soll && Number.parseFloat(soll.replace(",", ".")) !== 0) {
          const p = parseSignedBetrag(soll.replace(/^-/, ""), "ausgang");
          betrag = p.betrag;
          richtung = "ausgang";
        } else if (haben) {
          const p = parseSignedBetrag(haben.replace(/^-/, ""), "eingang");
          betrag = p.betrag;
          richtung = "eingang";
        } else {
          throw new Error("Weder Soll noch Haben gesetzt.");
        }
      }

      zeilen.push({
        datum,
        richtung,
        betrag,
        verwendungszweck: cell(row, headerMap.get("verwendungszweck")),
        gegenkonto_name: cell(row, headerMap.get("gegenkonto")),
        gegenkonto_iban: cell(row, headerMap.get("iban"))
          .replace(/\s+/g, "")
          .toUpperCase(),
        referenz: cell(row, headerMap.get("referenz")),
      });
    } catch (e) {
      fehler.push({
        zeile: lineNo,
        meldung: e instanceof Error ? e.message : "Zeile ungültig.",
      });
    }
  }

  return { zeilen, fehler, delimiter };
}
