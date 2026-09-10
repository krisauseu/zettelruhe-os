/**
 * Reine Domain-Invarianten E-Rechnung Empfang (ohne I/O).
 */

import type {
  EInvoiceFormat,
  EInvoiceParseStatus,
  ERechnungEmpfangStatus,
  ParsedEInvoice,
} from "./types";

/** Erlaubte MIME für Empfang (XML + PDF/ZUGFeRD) */
export const ERECHNUNG_DATEI_MIME = new Set([
  "application/xml",
  "text/xml",
  "application/pdf",
  "application/octet-stream",
  // Browser-Varianten
  "text/plain",
]);

/** Max. Dateigröße 15 MiB (analog Belege) */
export const ERECHNUNG_DATEI_MAX_BYTES = 15 * 1024 * 1024;

export const BELEG_BEREITS_ERSTELLT_ERROR =
  "Für diese E-Rechnung wurde bereits ein Beleg-Entwurf angelegt.";

export const PARSE_FEHLER_BELEG_ERROR =
  "Ohne erfolgreichen Parse kann kein Beleg-Entwurf vorbefüllt werden. Original ist archiviert — Beleg manuell anlegen.";

export const ORIGINAL_IMMUTABLE_ERROR =
  "Das E-Rechnungs-Original ist revisionssicher archiviert und wird nicht überschrieben (ADR-0012).";

const VALID_FORMAT = new Set<EInvoiceFormat>([
  "xrechnung_ubl",
  "zugferd_cii",
  "unbekannt",
]);
const VALID_PARSE = new Set<EInvoiceParseStatus>(["ok", "fehler"]);
const VALID_STATUS = new Set<ERechnungEmpfangStatus>([
  "neu",
  "beleg_erstellt",
  "archiviert",
]);

/** Validiert Upload (MIME light + Größe + Endung). */
export function validateERechnungDatei(file: {
  type: string;
  size: number;
  name?: string;
}): void {
  if (!file || file.size <= 0) {
    throw new Error("Datei ist leer.");
  }
  if (file.size > ERECHNUNG_DATEI_MAX_BYTES) {
    throw new Error("Datei ist zu groß (max. 15 MB).");
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !ERECHNUNG_DATEI_MIME.has(mime)) {
    throw new Error(
      "Ungültiger Dateityp. Erlaubt: XML (XRechnung) oder PDF (ZUGFeRD).",
    );
  }

  if (file.name) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".xml") ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".zugferd") ||
      lower.endsWith(".factur-x");
    if (!ok && mime === "application/octet-stream") {
      throw new Error(
        "Ungültiger Dateityp. Erlaubt: XML (XRechnung) oder PDF (ZUGFeRD).",
      );
    }
    if (!ok && !mime) {
      throw new Error(
        "Ungültiger Dateityp. Erlaubt: XML (XRechnung) oder PDF (ZUGFeRD).",
      );
    }
  }
}

export function assertCanCreateBeleg(empfang: {
  parse_status: EInvoiceParseStatus;
  beleg: string | null;
  status: ERechnungEmpfangStatus;
}): void {
  if (empfang.beleg || empfang.status === "beleg_erstellt") {
    throw new Error(BELEG_BEREITS_ERSTELLT_ERROR);
  }
  if (empfang.parse_status !== "ok") {
    throw new Error(PARSE_FEHLER_BELEG_ERROR);
  }
}

export function assertHasParsedDto(
  geparst: ParsedEInvoice | null,
): asserts geparst is ParsedEInvoice {
  if (!geparst) {
    throw new Error(PARSE_FEHLER_BELEG_ERROR);
  }
}

export function parseFormat(raw: string): EInvoiceFormat {
  return VALID_FORMAT.has(raw as EInvoiceFormat)
    ? (raw as EInvoiceFormat)
    : "unbekannt";
}

export function parseParseStatus(raw: string): EInvoiceParseStatus {
  return VALID_PARSE.has(raw as EInvoiceParseStatus)
    ? (raw as EInvoiceParseStatus)
    : "fehler";
}

export function parseEmpfangStatus(raw: string): ERechnungEmpfangStatus {
  return VALID_STATUS.has(raw as ERechnungEmpfangStatus)
    ? (raw as ERechnungEmpfangStatus)
    : "neu";
}

/** Serialisiert DTO für PB-Textfeld */
export function serializeParsed(dto: ParsedEInvoice): string {
  return JSON.stringify(dto);
}

/** Deserialisiert DTO; bei Korruption null */
export function deserializeParsed(raw: string): ParsedEInvoice | null {
  if (!raw?.trim()) return null;
  try {
    const obj = JSON.parse(raw) as ParsedEInvoice;
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.rechnungsnummer !== "string") return null;
    if (typeof obj.betrag_brutto !== "string") return null;
    return obj;
  } catch {
    return null;
  }
}

/** Empfangszeitpunkt ISO-8601 UTC */
export function empfangsZeitpunktUtc(now: Date = new Date()): string {
  return now.toISOString();
}
