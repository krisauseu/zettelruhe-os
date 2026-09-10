/**
 * CSV Import/Export für Kontakte (de-DE-tauglich, Semikolon-Delimiter).
 */

import type {
  Ansprechpartner,
  AnsprechpartnerInput,
  Kontakt,
  KontaktInput,
} from "./types";

export const KONTAKTE_CSV_HEADERS = [
  "name",
  "kontaktnummer",
  "ist_kunde",
  "ist_lieferant",
  "strasse",
  "plz",
  "ort",
  "land",
  "ust_id",
  "leitweg_id",
  "email",
  "telefon",
  "iban",
  "bic",
  "notiz",
  "ansprechpartner_name",
  "ansprechpartner_email",
  "ansprechpartner_telefon",
  "ansprechpartner_position",
  "ansprechpartner_weitere",
] as const;

export type KontakteCsvHeader = (typeof KONTAKTE_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, KontakteCsvHeader> = {
  name: "name",
  firma: "name",
  "name/firma": "name",
  bezeichnung: "name",
  kontaktnummer: "kontaktnummer",
  "kontakt-nr": "kontaktnummer",
  "kontakt-nr.": "kontaktnummer",
  kundennummer: "kontaktnummer",
  "kunden-nr": "kontaktnummer",
  "kunden-nr.": "kontaktnummer",
  kunden_nr: "kontaktnummer",
  knr: "kontaktnummer",
  ist_kunde: "ist_kunde",
  kunde: "ist_kunde",
  "kund:in": "ist_kunde",
  kundin: "ist_kunde",
  ist_lieferant: "ist_lieferant",
  lieferant: "ist_lieferant",
  "lieferant:in": "ist_lieferant",
  strasse: "strasse",
  straße: "strasse",
  plz: "plz",
  ort: "ort",
  land: "land",
  ust_id: "ust_id",
  ustid: "ust_id",
  "ust-idnr": "ust_id",
  "ust-idnr.": "ust_id",
  "ust_idnr": "ust_id",
  vat_id: "ust_id",
  vatid: "ust_id",
  leitweg_id: "leitweg_id",
  leitweg: "leitweg_id",
  "leitweg-id": "leitweg_id",
  kaeuferreferenz: "leitweg_id",
  käuferreferenz: "leitweg_id",
  email: "email",
  "e-mail": "email",
  telefon: "telefon",
  tel: "telefon",
  iban: "iban",
  bic: "bic",
  notiz: "notiz",
  notizen: "notiz",
  ansprechpartner_name: "ansprechpartner_name",
  ansprechpartner: "ansprechpartner_name",
  ansprechpartner_email: "ansprechpartner_email",
  ansprechpartner_telefon: "ansprechpartner_telefon",
  ansprechpartner_position: "ansprechpartner_position",
  ansprechpartner_weitere: "ansprechpartner_weitere",
};

function detectDelimiter(headerLine: string): "," | ";" {
  const semi = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

/** RFC-4180-ähnlich, inkl. Quotes und Delimiter-Erkennung */
export function parseCsvRows(
  text: string,
  delimiter?: "," | ";",
): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

  // letzte Zeile (ohne trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
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

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  return ["1", "true", "ja", "yes", "x", "y"].includes(v);
}

function formatBool(v: boolean): string {
  return v ? "ja" : "nein";
}

export type KontaktCsvItem = KontaktInput & {
  ansprechpartner?: AnsprechpartnerInput;
};

export type CsvParseResult = {
  items: KontaktCsvItem[];
  errors: string[];
  skipped: number;
};

/**
 * Parst CSV-Text zu KontaktInput[].
 * Erste Zeile = Header (de/en Aliase).
 */
export function parseKontakteCsv(text: string): CsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { items: [], errors: ["CSV ist leer."], skipped: 0 };
  }

  const headerCells = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = new Map<KontakteCsvHeader, number>();

  for (let i = 0; i < headerCells.length; i++) {
    const key = HEADER_ALIASES[headerCells[i]];
    if (key && !colIndex.has(key)) {
      colIndex.set(key, i);
    }
  }

  if (!colIndex.has("name")) {
    return {
      items: [],
      errors: [
        'Pflichtspalte "name" fehlt im Header (oder Alias "Firma" / "Name/Firma").',
      ],
      skipped: 0,
    };
  }

  const items: KontaktCsvItem[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const cell = (key: KontakteCsvHeader): string => {
      const idx = colIndex.get(key);
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };

    const name = cell("name");
    if (!name) {
      skipped += 1;
      continue;
    }

    let ist_kunde = parseBool(cell("ist_kunde"));
    const ist_lieferant = parseBool(cell("ist_lieferant"));
    // Wenn keine Rolle gesetzt: Default Kund:in
    if (!ist_kunde && !ist_lieferant) {
      ist_kunde = true;
    }

    const apName = cell("ansprechpartner_name");
    const item: KontaktCsvItem = {
      name,
      kontaktnummer: cell("kontaktnummer") || undefined,
      ist_kunde,
      ist_lieferant,
      strasse: cell("strasse"),
      plz: cell("plz"),
      ort: cell("ort"),
      land: cell("land") || "DE",
      ust_id: cell("ust_id"),
      leitweg_id: cell("leitweg_id"),
      email: cell("email"),
      telefon: cell("telefon"),
      iban: cell("iban"),
      bic: cell("bic"),
      notiz: cell("notiz"),
    };
    if (apName) {
      item.ansprechpartner = {
        name: apName,
        email: cell("ansprechpartner_email"),
        telefon: cell("ansprechpartner_telefon"),
        position: cell("ansprechpartner_position"),
      };
    }
    items.push(item);
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push("Keine gültigen Datenzeilen gefunden.");
  }

  return { items, errors, skipped };
}

function formatWeitere(rest: Ansprechpartner[]): string {
  return rest
    .map((ap) => {
      const bits = [ap.name];
      if (ap.position) bits.push(ap.position);
      if (ap.email) bits.push(ap.email);
      if (ap.telefon) bits.push(ap.telefon);
      return bits.join(", ");
    })
    .join(" | ");
}

/** Serialisiert Kontakte als Semikolon-CSV (Excel de-DE), inkl. Ansprechpartner. */
export function serializeKontakteCsv(
  items: Kontakt[],
  delimiter: ";" | "," = ";",
  ansprechpartnerByKontakt: Map<string, Ansprechpartner[]> = new Map(),
): string {
  const lines: string[] = [];
  lines.push(KONTAKTE_CSV_HEADERS.join(delimiter));

  for (const k of items) {
    const aps = ansprechpartnerByKontakt.get(k.id) ?? [];
    const first = aps[0];
    const weitere = aps.slice(1);
    const values = [
      k.name,
      k.kontaktnummer,
      formatBool(k.ist_kunde),
      formatBool(k.ist_lieferant),
      k.strasse,
      k.plz,
      k.ort,
      k.land,
      k.ust_id,
      k.leitweg_id,
      k.email,
      k.telefon,
      k.iban,
      k.bic,
      k.notiz,
      first?.name ?? "",
      first?.email ?? "",
      first?.telefon ?? "",
      first?.position ?? "",
      formatWeitere(weitere),
    ].map((v) => escapeCsvField(v, delimiter));
    lines.push(values.join(delimiter));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Vorlage-CSV für Import-Hilfe */
export function kontakteCsvTemplate(): string {
  const sample: Kontakt = {
    id: "",
    firma: "",
    name: "Muster GmbH",
    kontaktnummer: "",
    ist_kunde: true,
    ist_lieferant: false,
    strasse: "Beispielstraße 1",
    plz: "10115",
    ort: "Berlin",
    land: "DE",
    ust_id: "",
    leitweg_id: "",
    email: "info@beispiel.de",
    telefon: "+49 30 123456",
    iban: "",
    bic: "",
    notiz: "",
  };
  return serializeKontakteCsv([sample]);
}
