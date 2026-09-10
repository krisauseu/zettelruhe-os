import { assertRcFreigegeben } from "./reverse-charge";
/**
 * Persistenz Belege über PocketBase (Superuser).
 * Entwurf: CRUD + Datei; Festschreibung → Journal (ADR-0004/0006/0012).
 */

import {
  createRecord,
  createRecordMultipart,
  fetchRecordFile,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
} from "@/lib/pb";
import { assertKategorieNamePasstZurRichtung } from "@/modules/categories/repository";
import { belegEntwurfSchreiben, belegFestschreiben, belegProjektion, finanzAkteur, FinanzFehler, type BelegQuittung } from "@/lib/finanz-transaktion";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  assertCanFestschreiben,
  assertEntwurfEditable,
  assertBelegDateiAnzahl,
  DATEI_IMMUTABLE_ERROR,
  FESTGESCHRIEBEN_ERROR,
  normalizeBelegDateiNamen,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";
import type {
  Beleg,
  BelegFilter,
  BelegInput,
  BelegListResult,
  BelegStatus,
  Buchungsrichtung,
  Steuersatz,
} from "./types";

const COL = "belege";

/** Freitextsuche: Kategorie, Bezeichnung (`notiz`), Nummer, Konto, Lieferant:in, Kund:in. */
export function belegFreitextFilter(q: string): string {
  return `(${pbLike("kategorie", q)} || ${pbLike("notiz", q)} || ${pbLike("belegnummer", q)} || ${pbLike("konto", q)} || ${pbLike("lieferant.name", q)} || ${pbLike("kunde.name", q)})`;
}

type PbBeleg = {
  rc?: Beleg["rc"];
  rc_steuerdatum?: string;
  rc_vorgang?: string;
  id: string;
  firma: string;
  belegdatum: string;
  buchungsdatum?: string;
  richtung: string;
  lieferant?: string;
  kunde?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz?: string;
  kategorie?: string;
  notiz?: string;
  konto?: string;
  status: string;
  datei?: string | string[];
  belegnummer?: string;
  journal_eintrag?: string;
  festgeschrieben_am?: string;
  created?: string;
  updated?: string;
};

const VALID_RICHTUNG = new Set(["einnahme", "ausgabe"]);
const VALID_STATUS = new Set(["entwurf", "festgeschrieben"]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

function mapBeleg(r: PbBeleg): Beleg {
  const richtung = VALID_RICHTUNG.has(r.richtung)
    ? (r.richtung as Buchungsrichtung)
    : "ausgabe";
  const status = VALID_STATUS.has(r.status)
    ? (r.status as BelegStatus)
    : "entwurf";
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";

  const datei = normalizeBelegDateiNamen(r.datei);

  return {
    ...(r.rc ? { rc: r.rc, rc_steuerdatum: r.rc_steuerdatum || "", rc_vorgang: r.rc_vorgang || "" } : {}),
    id: r.id,
    firma: r.firma,
    belegdatum: r.belegdatum,
    buchungsdatum: r.buchungsdatum ?? "",
    richtung,
    lieferant: r.lieferant || null,
    kunde: r.kunde || null,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuersatz,
    kategorie: r.kategorie ?? "",
    notiz: r.notiz ?? "",
    konto: r.konto ?? "",
    status,
    datei,
    belegnummer: r.belegnummer ?? "",
    journal_eintrag: r.journal_eintrag || null,
    festgeschrieben_am: r.festgeschrieben_am ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  validated: ReturnType<typeof validateBelegInput>,
  firmaId: string,
  status: BelegStatus = "entwurf",
): Record<string, unknown> {
  return {
    ...(validated.rc !== undefined ? { rc: validated.rc } : {}),
    firma: firmaId,
    belegdatum: validated.belegdatum,
    buchungsdatum: validated.buchungsdatum,
    richtung: validated.richtung,
    lieferant: validated.lieferant,
    kunde: validated.kunde,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuersatz: validated.steuersatz || null,
    kategorie: validated.kategorie,
    notiz: validated.notiz,
    konto: validated.konto,
    status,
  };
}

function asDateiListe(
  datei?: File | Blob | Array<File | Blob> | null,
): Array<File | Blob> {
  if (!datei) return [];
  return Array.isArray(datei) ? datei : [datei];
}

function asNamedFile(file: File | Blob, fallback = "beleg.bin"): File {
  const filename =
    file instanceof File && file.name ? file.name : fallback;
  return new File([file], filename, {
    type: file.type || "application/octet-stream",
  });
}

export async function createBeleg(
  firmaId: string,
  input: BelegInput,
  opts?: { datei?: File | Blob | Array<File | Blob> | null },
): Promise<Beleg> {
  if (input.rc) assertRcFreigegeben();
  const validated = validateBelegInput(input);
  await assertKategorieNamePasstZurRichtung(
    firmaId,
    validated.kategorie,
    validated.richtung,
  );
  const body = toPbBody(validated, firmaId, "entwurf");
  const dateien = asDateiListe(opts?.datei);

  if (dateien.length > 0) {
    for (const file of dateien) {
      validateBelegDatei(file as File);
    }
    assertBelegDateiAnzahl(0, dateien.length);
    const fields: Record<string, string | Blob | Blob[]> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === null || v === undefined) {
        // PB multipart: leere Relation weglassen
        if (k === "lieferant" || k === "kunde" || k === "steuersatz") continue;
        fields[k] = "";
      } else {
        fields[k] = k === "rc" ? JSON.stringify(v) : String(v);
      }
    }
    fields.datei = dateien.map((file) => asNamedFile(file));
    const r = await createRecordMultipart<PbBeleg>(COL, fields);
    return mapBeleg(r);
  }

  const r = await createRecord<PbBeleg>(COL, body);
  return mapBeleg(r);
}

export async function updateBeleg(
  firmaId: string,
  id: string,
  input: BelegInput,
  opts?: { akteur?: string; dateien?: Array<File | Blob> },
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  assertEntwurfEditable(existing);
  if (existing.rc) assertRcFreigegeben();

  if (input.rc) assertRcFreigegeben();
  const validated = validateBelegInput(input);
  await assertKategorieNamePasstZurRichtung(
    firmaId,
    validated.kategorie,
    validated.richtung,
  );
  const body = toPbBody(validated, firmaId, "entwurf");
  // firma/status nicht umschreiben unnötig
  delete body.firma;
  delete body.status;

  const files = opts?.dateien || [];
  files.forEach(f => validateBelegDatei(f as File));
  assertBelegDateiAnzahl(existing.datei.length, files.length);
  const r = await belegEntwurfSchreiben<PbBeleg>({ firma: firmaId, akteur: await finanzAkteur(firmaId, opts?.akteur), id, expected: belegProjektion(existing), values: body }, files);
  return mapBeleg(r);
}

/**
 * Dateien an Entwurf anhängen (nicht ersetzen).
 * Nach Festschreibung blockiert (ADR-0012).
 */
export async function addBelegDateien(
  firmaId: string,
  id: string,
  files: Array<File | Blob>,
  opts?: { akteur?: string },
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!isEntwurfStatus(existing)) {
    throw new Error(DATEI_IMMUTABLE_ERROR);
  }
  if (files.length === 0) return existing;
  for (const file of files) {
    validateBelegDatei(file as File);
  }
  assertBelegDateiAnzahl(existing.datei.length, files.length);

  const blobs = files.map((file) => asNamedFile(file));
  const r = await belegEntwurfSchreiben<PbBeleg>({ firma: firmaId, akteur: await finanzAkteur(firmaId, opts?.akteur), id, expected: belegProjektion(existing) }, blobs);
  return mapBeleg(r);
}

/** Eine Datei an Entwurf anhängen (nicht ersetzen). */
export async function setBelegDatei(
  firmaId: string,
  id: string,
  file: File | Blob,
): Promise<Beleg> {
  return addBelegDateien(firmaId, id, [file]);
}

/** Eine Datei vom Entwurf entfernen. */
export async function removeBelegDatei(
  firmaId: string,
  id: string,
  filename: string,
  opts?: { akteur?: string },
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!isEntwurfStatus(existing)) {
    throw new Error(DATEI_IMMUTABLE_ERROR);
  }
  const name = filename.trim();
  if (!existing.datei.includes(name)) {
    throw new Error("Datei nicht am Beleg.");
  }
  const r = await belegEntwurfSchreiben<PbBeleg>({ firma: firmaId, akteur: await finanzAkteur(firmaId, opts?.akteur), id, expected: belegProjektion(existing), remove: [name] });
  return mapBeleg(r);
}

/** Alle Dateien vom Entwurf entfernen. */
export async function clearBelegDatei(
  firmaId: string,
  id: string,
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!isEntwurfStatus(existing)) {
    throw new Error(DATEI_IMMUTABLE_ERROR);
  }
  // PB: leerer String löscht File-Feld
  const r = await belegEntwurfSchreiben<PbBeleg>({ firma: firmaId, akteur: await finanzAkteur(firmaId), id, expected: belegProjektion(existing), remove: existing.datei });
  return mapBeleg(r);
}

function isEntwurfStatus(b: Beleg): boolean {
  return b.status === "entwurf";
}

export async function deleteBeleg(firmaId: string, id: string, opts?: { akteur?: string }): Promise<void> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  assertEntwurfEditable(existing);
  await belegEntwurfSchreiben({ firma: firmaId, akteur: await finanzAkteur(firmaId, opts?.akteur), id, expected: belegProjektion(existing), operation: "delete" });
}

/** Nummernkreis, Journal und Abschluss committen gemeinsam in PocketBase. */
export async function festschreibenBeleg(
  firmaId: string,
  id: string,
  opts?: { now?: Date; akteur?: string },
): Promise<{ beleg: Beleg; journal: JournalEintrag; quittung: BelegQuittung }> {
  // Do not turn transport/read errors into "not found" on the commit path.
  const raw = await getRecord<PbBeleg>(COL, id);
  if (raw.firma !== firmaId) throw new FinanzFehler("FORBIDDEN");
  if (!VALID_STATUS.has(raw.status) || !VALID_RICHTUNG.has(raw.richtung)) throw new FinanzFehler("INVALID_STATE");
  const existing = mapBeleg(raw);
  if (existing.rc) assertRcFreigegeben();
  if (existing.status === "entwurf") assertCanFestschreiben(existing);
  if (existing.status === "festgeschrieben" && (!existing.belegnummer || !existing.journal_eintrag || !existing.festgeschrieben_am)) throw new FinanzFehler("INCONSISTENT_STATE");

  // Nochmal validieren (Beträge/Daten konsistent)
  validateBelegInput({
    belegdatum: existing.belegdatum,
    buchungsdatum: existing.buchungsdatum || existing.belegdatum,
    richtung: existing.richtung,
    lieferant: existing.lieferant,
    kunde: existing.kunde,
    betrag_netto: existing.betrag_netto,
    betrag_ust: existing.betrag_ust,
    betrag_brutto: existing.betrag_brutto,
    steuersatz: existing.steuersatz,
    kategorie: existing.kategorie,
    notiz: existing.notiz,
    konto: existing.konto,
  });

  const quittung = await belegFestschreiben<BelegQuittung & { beleg: PbBeleg; journal: JournalEintrag }>({
    firma: firmaId, akteur: await finanzAkteur(firmaId, opts?.akteur), id, expected: belegProjektion(existing),
  });
  const { beleg, journal, ...abschluss } = quittung;
  return { beleg: mapBeleg(beleg), journal: { ...journal, kontakt: journal.kontakt || null, storno_von: journal.storno_von || null }, quittung: abschluss };

}

export async function getBeleg(
  firmaId: string,
  id: string,
): Promise<Beleg | null> {
  try {
    const r = await getRecord<PbBeleg>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapBeleg(r);
  } catch {
    return null;
  }
}

export async function listBelege(
  firmaId: string,
  filter: BelegFilter = {},
  page = 1,
  perPage = 50,
): Promise<BelegListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.status === "entwurf" || filter.status === "festgeschrieben") {
    parts.push(pbEq("status", filter.status));
  }

  if (filter.richtung === "einnahme" || filter.richtung === "ausgabe") {
    parts.push(pbEq("richtung", filter.richtung));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`belegdatum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`belegdatum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(belegFreitextFilter(q));
  }

  const result = await listRecords<PbBeleg>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort (Feld nicht in Collection) — id als Tiebreaker
    sort: "-belegdatum,-id",
  });

  return {
    items: result.items.map(mapBeleg),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/** Kategorie-Schnappschüsse zu bekannten IDs (eine Filterwelle je 50, Solo-Volumen). */
export async function listBelegeByIds(
  firmaId: string,
  ids: string[],
): Promise<Beleg[]> {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return [];
  const out: Beleg[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const result = await listRecords<PbBeleg>(COL, {
      page: 1,
      perPage: 50,
      filter: `${pbEq("firma", firmaId)} && (${chunk.map((id) => pbEq("id", id)).join(" || ")})`,
    });
    out.push(...result.items.map(mapBeleg));
  }
  return out;
}

/** Datei-Bytes für Download (nur eigene Firma). */
export async function getBelegDateiResponse(
  firmaId: string,
  id: string,
  filename?: string,
): Promise<{ response: Response; filename: string; beleg: Beleg }> {
  const beleg = await getBeleg(firmaId, id);
  if (!beleg) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (beleg.datei.length === 0) {
    throw new Error("Keine Datei am Beleg.");
  }
  const wanted = (filename ?? "").trim();
  const chosen = wanted
    ? beleg.datei.find((n) => n === wanted)
    : beleg.datei[0];
  if (!chosen) {
    throw new Error("Datei nicht gefunden.");
  }
  const response = await fetchRecordFile(COL, id, chosen);
  return { response, filename: chosen, beleg };
}

/**
 * Bewusst blockierte stille Mutationen auf festgeschriebenen Belegen.
 */
export async function updateFestgeschriebenenBeleg(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}

export async function deleteFestgeschriebenenBeleg(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}
