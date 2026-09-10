/**
 * CSV Import light für Katalog-Positionen.
 */

import { normalizePreisInput } from "./repository";
import type { KatalogPosition, KatalogPositionInput, Steuersatz } from "./types";

export const KATALOG_CSV_HEADERS = [
  "bezeichnung",
  "einheit",
  "preis",
  "steuersatz",
  "notiz",
  "aktiv",
] as const;

type Header = (typeof KATALOG_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, Header> = {
  bezeichnung: "bezeichnung",
  name: "bezeichnung",
  produkt: "bezeichnung",
  leistung: "bezeichnung",
  einheit: "einheit",
  preis: "preis",
  nettopreis: "preis",
  steuersatz: "steuersatz",
  ust: "steuersatz",
  mwst: "steuersatz",
  notiz: "notiz",
  aktiv: "aktiv",
};

function detectDelimiter(headerLine: string): "," | ";" {
  const semi = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

export function parseCsvRows(text: string, delimiter?: "," | ";"): string[][] {
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

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseBool(raw: string, defaultTrue = true): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return defaultTrue;
  if (["0", "false", "nein", "no", "n"].includes(v)) return false;
  return ["1", "true", "ja", "yes", "x", "y"].includes(v) || defaultTrue;
}

function parseSteuersatz(raw: string): Steuersatz | "" {
  const v = raw.trim().replace(/%/g, "").replace(",", ".");
  if (!v) return "";
  if (v === "0" || v === "0.0" || v === "0.00") return "0";
  if (v === "7" || v === "7.0") return "7";
  if (v === "19" || v === "19.0") return "19";
  return "";
}

export type KatalogCsvParseResult = {
  items: KatalogPositionInput[];
  errors: string[];
  skipped: number;
};

export function parseKatalogCsv(text: string): KatalogCsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { items: [], errors: ["CSV ist leer."], skipped: 0 };
  }

  const headerCells = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = new Map<Header, number>();
  for (let i = 0; i < headerCells.length; i++) {
    const key = HEADER_ALIASES[headerCells[i]];
    if (key && !colIndex.has(key)) colIndex.set(key, i);
  }

  if (!colIndex.has("bezeichnung") || !colIndex.has("preis")) {
    return {
      items: [],
      errors: [
        'Pflichtspalten "bezeichnung" und "preis" fehlen im Header.',
      ],
      skipped: 0,
    };
  }

  const items: KatalogPositionInput[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const cell = (key: Header): string => {
      const idx = colIndex.get(key);
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };

    const bezeichnung = cell("bezeichnung");
    if (!bezeichnung) {
      skipped += 1;
      continue;
    }

    let preis: string;
    try {
      preis = normalizePreisInput(cell("preis") || "0");
    } catch (e) {
      errors.push(
        `Zeile ${r + 1} (${bezeichnung}): ${e instanceof Error ? e.message : "Preis ungültig"}`,
      );
      skipped += 1;
      continue;
    }

    items.push({
      bezeichnung,
      einheit: cell("einheit") || "Stück",
      preis,
      steuersatz: parseSteuersatz(cell("steuersatz")),
      notiz: cell("notiz"),
      aktiv: parseBool(cell("aktiv"), true),
    });
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push("Keine gültigen Datenzeilen gefunden.");
  }

  return { items, errors, skipped };
}

function escapeCsvField(value: string, delimiter: string): string {
  if (
    value.includes('"') ||
    value.includes(delimiter) ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeKatalogCsv(
  items: KatalogPosition[],
  delimiter: ";" | "," = ";",
): string {
  const lines = [KATALOG_CSV_HEADERS.join(delimiter)];
  for (const p of items) {
    const values = [
      p.bezeichnung,
      p.einheit,
      p.preis.replace(".", ","),
      p.steuersatz,
      p.notiz,
      p.aktiv ? "ja" : "nein",
    ].map((v) => escapeCsvField(v, delimiter));
    lines.push(values.join(delimiter));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function katalogCsvTemplate(): string {
  const sample: KatalogPosition = {
    id: "",
    firma: "",
    bezeichnung: "Beratung",
    einheit: "Std.",
    preis: "95.00",
    steuersatz: "19",
    notiz: "",
    aktiv: true,
  };
  return serializeKatalogCsv([sample]);
}
