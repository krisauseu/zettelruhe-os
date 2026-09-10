/**
 * Persistenz E-Rechnung Empfang über PocketBase (Superuser).
 * Upload speichert Original unverändert; Parse → DTO separat;
 * Beleg-Entwurf über expenses.createBeleg (kein Duplikat der Beleg-Logik).
 */

import {
  createRecordMultipart,
  fetchRecordFile,
  getFirmaById,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  updateRecord,
} from "@/lib/pb";
import { listKontakte } from "@/modules/contacts";
import { createBeleg, getBeleg, setBelegDatei } from "@/modules/expenses";
import type { Beleg } from "@/modules/expenses/types";
import {
  assertCanCreateBeleg,
  assertHasParsedDto,
  deserializeParsed,
  empfangsZeitpunktUtc,
  ORIGINAL_IMMUTABLE_ERROR,
  parseEmpfangStatus,
  parseFormat,
  parseParseStatus,
  serializeParsed,
  validateERechnungDatei,
} from "./invariants";
import {
  LIEFERANT_MATCH_MIN_SCORE,
  mapParsedToBelegInput,
  scoreLieferantMatch,
} from "./mapping";
import { parseEInvoiceFile } from "./parse";
import type {
  EInvoiceFormat,
  EInvoiceParseStatus,
  ERechnungEmpfang,
  ERechnungEmpfangFilter,
  ERechnungEmpfangListResult,
  ParsedEInvoice,
} from "./types";

const COL = "e_rechnungen_empfang";

type PbEmpfang = {
  id: string;
  firma: string;
  original_datei?: string | string[];
  original_dateiname?: string;
  format: string;
  parse_status: string;
  parse_fehler?: string;
  geparst_json?: string;
  rechnungsnummer?: string;
  rechnungsdatum?: string;
  lieferant_name?: string;
  betrag_brutto?: string;
  status: string;
  beleg?: string;
  empfangen_am: string;
  notiz?: string;
  created?: string;
  updated?: string;
};

function fileNameFromPb(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  return "";
}

function mapEmpfang(r: PbEmpfang): ERechnungEmpfang {
  const geparst = deserializeParsed(r.geparst_json ?? "");
  return {
    id: r.id,
    firma: r.firma,
    original_datei: fileNameFromPb(r.original_datei),
    original_dateiname: r.original_dateiname ?? "",
    format: parseFormat(r.format),
    parse_status: parseParseStatus(r.parse_status),
    parse_fehler: r.parse_fehler ?? "",
    geparst,
    rechnungsnummer: r.rechnungsnummer ?? "",
    rechnungsdatum: r.rechnungsdatum ?? "",
    lieferant_name: r.lieferant_name ?? "",
    betrag_brutto: r.betrag_brutto ?? "",
    status: parseEmpfangStatus(r.status),
    beleg: r.beleg || null,
    empfangen_am: r.empfangen_am,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

/**
 * Datei hochladen → Original archivieren → parsen.
 * Bei Parse-Fehler: Record bleibt mit parse_status=fehler (kein stilles Verwerfen).
 */
export async function uploadERechnung(
  firmaId: string,
  file: File | Blob,
  opts?: { now?: Date; notiz?: string },
): Promise<ERechnungEmpfang> {
  validateERechnungDatei(file as File);

  const filename =
    file instanceof File && file.name ? file.name : "e-rechnung.bin";
  const mime =
    file instanceof File && file.type
      ? file.type
      : "application/octet-stream";

  const buffer = new Uint8Array(await file.arrayBuffer());
  const parseResult = parseEInvoiceFile({
    bytes: buffer,
    filename,
    mimeType: mime,
  });

  const now = opts?.now ?? new Date();
  const empfangen_am = empfangsZeitpunktUtc(now);

  let format: EInvoiceFormat = "unbekannt";
  let parse_status: EInvoiceParseStatus = "fehler";
  let parse_fehler = "";
  let geparst_json = "";
  let rechnungsnummer = "";
  let rechnungsdatum = "";
  let lieferant_name = "";
  let betrag_brutto = "";

  if (parseResult.ok) {
    parse_status = "ok";
    format = parseResult.data.format;
    geparst_json = serializeParsed(parseResult.data);
    rechnungsnummer = parseResult.data.rechnungsnummer;
    rechnungsdatum = parseResult.data.rechnungsdatum;
    lieferant_name = parseResult.data.lieferant.name;
    betrag_brutto = parseResult.data.betrag_brutto;
  } else {
    parse_status = "fehler";
    parse_fehler = parseResult.error.slice(0, 2000);
    format = parseResult.format ?? "unbekannt";
  }

  const blob = new File([buffer], filename, {
    type: mime || "application/octet-stream",
  });

  const fields: Record<string, string | Blob> = {
    firma: firmaId,
    original_datei: blob,
    original_dateiname: filename.slice(0, 255),
    format,
    parse_status,
    parse_fehler,
    geparst_json,
    rechnungsnummer,
    lieferant_name,
    betrag_brutto,
    status: "neu",
    empfangen_am,
    notiz: (opts?.notiz ?? "").slice(0, 2000),
  };
  if (rechnungsdatum) {
    fields.rechnungsdatum = rechnungsdatum;
  }

  const r = await createRecordMultipart<PbEmpfang>(COL, fields);
  return mapEmpfang(r);
}

export async function getERechnungEmpfang(
  firmaId: string,
  id: string,
): Promise<ERechnungEmpfang | null> {
  try {
    const r = await getRecord<PbEmpfang>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapEmpfang(r);
  } catch {
    return null;
  }
}

export async function listERechnungEmpfang(
  firmaId: string,
  filter: ERechnungEmpfangFilter = {},
  page = 1,
  perPage = 50,
): Promise<ERechnungEmpfangListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (
    filter.status === "neu" ||
    filter.status === "beleg_erstellt" ||
    filter.status === "archiviert"
  ) {
    parts.push(pbEq("status", filter.status));
  }
  if (filter.parse_status === "ok" || filter.parse_status === "fehler") {
    parts.push(pbEq("parse_status", filter.parse_status));
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("rechnungsnummer", q)} || ${pbLike("lieferant_name", q)} || ${pbLike("original_dateiname", q)} || ${pbLike("notiz", q)})`,
    );
  }

  const result = await listRecords<PbEmpfang>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort
    sort: "-empfangen_am,-id",
  });

  return {
    items: result.items.map(mapEmpfang),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/**
 * Beleg-Entwurf aus geparster E-Rechnung anlegen (expenses).
 * Original bleibt in der Inbox (immutable). PDF wird am Beleg abgelegt,
 * XML nur in der Inbox (Beleg-Collection: PDF/Bild).
 * Festschreibung: weiterhin nur über expenses.
 */
export async function createBelegFromERechnungSafe(
  firmaId: string,
  empfangId: string,
  opts?: { lieferantId?: string | null },
): Promise<{ empfang: ERechnungEmpfang; beleg: Beleg }> {
  const empfang = await getERechnungEmpfang(firmaId, empfangId);
  if (!empfang) {
    throw new Error("E-Rechnung nicht gefunden.");
  }
  assertCanCreateBeleg(empfang);
  assertHasParsedDto(empfang.geparst);
  // Re-read the immutable original: older DTOs defaulted missing currency to EUR
  // and did not retain RC hints. Do not trust that legacy interpretation.
  if (!empfang.original_datei) throw new Error("Original fehlt. Währung und Steuerhinweise können nicht geprüft werden.");
  const original = await fetchRecordFile(COL, empfangId, empfang.original_datei);
  if (!original.ok) throw new Error("Original konnte nicht zur Importprüfung gelesen werden.");
  const originalBytes = await original.arrayBuffer();
  const reparsed = parseEInvoiceFile({ bytes: originalBytes, filename: empfang.original_dateiname || empfang.original_datei });
  if (!reparsed.ok) throw new Error(`Originalprüfung vor Übernahme fehlgeschlagen: ${reparsed.error}`);
  const dto = reparsed.data;


  const firma = await getFirmaById(firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  let lieferantId = opts?.lieferantId ?? null;
  if (!lieferantId) {
    lieferantId = await matchLieferantLight(firmaId, dto);
  }

  const input = mapParsedToBelegInput(dto, {
    steuermodus,
    lieferantId,
  });

  const name = empfang.original_dateiname || empfang.original_datei;
  const isPdf = name.toLowerCase().endsWith(".pdf");

  let datei: File | undefined;
  if (isPdf && empfang.original_datei) {
    datei = new File([originalBytes], name, { type: "application/pdf" });
  }

  let beleg: Beleg;
  try {
    beleg = await createBeleg(firmaId, input, datei ? { datei } : undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (datei && msg.includes("Dateityp")) {
      beleg = await createBeleg(firmaId, input);
    } else {
      throw e;
    }
  }

  if (datei && beleg.datei.length === 0) {
    try {
      beleg = await setBelegDatei(firmaId, beleg.id, datei);
    } catch {
      /* Original bleibt in Inbox */
    }
  }

  const r = await updateRecord<PbEmpfang>(COL, empfangId, {
    beleg: beleg.id,
    status: "beleg_erstellt",
  });

  return { empfang: mapEmpfang(r), beleg };
}

async function matchLieferantLight(
  firmaId: string,
  dto: ParsedEInvoice,
): Promise<string | null> {
  const result = await listKontakte(firmaId, { rolle: "lieferant" }, 1, 200);
  let bestId: string | null = null;
  let bestScore = 0;
  for (const k of result.items) {
    const s = scoreLieferantMatch(dto, k);
    if (s > bestScore) {
      bestScore = s;
      bestId = k.id;
    }
  }
  if (bestScore < LIEFERANT_MATCH_MIN_SCORE) {
    const all = await listKontakte(firmaId, {}, 1, 200);
    for (const k of all.items) {
      const s = scoreLieferantMatch(dto, k);
      if (s > bestScore) {
        bestScore = s;
        bestId = k.id;
      }
    }
  }
  return bestScore >= LIEFERANT_MATCH_MIN_SCORE ? bestId : null;
}

/** Original-Download (Next-Stream). */
export async function getERechnungDateiResponse(
  firmaId: string,
  id: string,
): Promise<{ response: Response; filename: string; empfang: ERechnungEmpfang }> {
  const empfang = await getERechnungEmpfang(firmaId, id);
  if (!empfang) {
    throw new Error("E-Rechnung nicht gefunden.");
  }
  if (!empfang.original_datei) {
    throw new Error("Keine Originaldatei archiviert.");
  }
  const response = await fetchRecordFile(COL, id, empfang.original_datei);
  const filename = empfang.original_dateiname || empfang.original_datei;
  return { response, filename, empfang };
}

/** Light: als archiviert markieren (kein Datei-Löschen). */
export async function archiveERechnung(
  firmaId: string,
  id: string,
): Promise<ERechnungEmpfang> {
  const existing = await getERechnungEmpfang(firmaId, id);
  if (!existing) {
    throw new Error("E-Rechnung nicht gefunden.");
  }
  const r = await updateRecord<PbEmpfang>(COL, id, { status: "archiviert" });
  return mapEmpfang(r);
}

/**
 * Bewusst blockiert: Original darf nicht ersetzt werden (ADR-0012).
 */
export async function replaceERechnungOriginal(): Promise<never> {
  throw new Error(ORIGINAL_IMMUTABLE_ERROR);
}

/** Vorschläge Lieferant:in für UI (light). */
export async function suggestLieferantForEmpfang(
  firmaId: string,
  empfangId: string,
): Promise<{ id: string; name: string; score: number } | null> {
  const empfang = await getERechnungEmpfang(firmaId, empfangId);
  if (!empfang?.geparst) return null;
  const id = await matchLieferantLight(firmaId, empfang.geparst);
  if (!id) return null;
  const all = await listKontakte(firmaId, {}, 1, 200);
  const k = all.items.find((x) => x.id === id);
  if (!k) return null;
  return {
    id: k.id,
    name: k.name,
    score: scoreLieferantMatch(empfang.geparst, k),
  };
}

export async function getLinkedBeleg(
  firmaId: string,
  empfang: ERechnungEmpfang,
): Promise<Beleg | null> {
  if (!empfang.beleg) return null;
  return getBeleg(firmaId, empfang.beleg);
}
