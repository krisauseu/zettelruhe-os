/**
 * Persistenz Wiederkehrende Rechnungen (Superuser).
 * CRUD Vorlage; Erzeugung → createRechnung (Entwurf, kein Nummernkreis).
 */

import {
  createRecord,
  deleteRecord,
  getFirmaById,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  type Steuermodus,
  updateRecord,
} from "@/lib/pb";
import { finanzAkteur, releaseOperation } from "@/lib/finanz-transaktion";
import type { RechnungMitPositionen } from "./types";
import {
  isVorlageFaellig,
  MAX_CATCHUP_PRO_VORLAGE,
  todayBerlin,
  validateWiederkehrInput,
} from "./wiederkehrend-invariants";
import type {
  WiederkehrendeRechnung,
  WiederkehrendeRechnungMitPositionen,
  WiederkehrFilter,
  WiederkehrInput,
  WiederkehrListResult,
  WiederkehrPosition,
  WiederkehrRhythmus,
} from "./wiederkehrend-types";

const COL = "wiederkehrende_rechnungen";
const COL_POS = "wiederkehrende_rechnungspositionen";

type PbWr = {
  id: string;
  firma: string;
  bezeichnung: string;
  kunde?: string;
  naechstes_datum: string;
  rhythmus: string;
  intervall_tage?: number;
  zahlungsziel_tage?: number;
  aktiv?: boolean;
  notiz?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuermodus: string;
  zuletzt_erzeugt_am?: string;
  letzte_rechnung?: string;
  created?: string;
  updated?: string;
};

type PbPos = {
  id: string;
  firma: string;
  wiederkehrende_rechnung: string;
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit?: string;
  einzelpreis: string;
  steuersatz?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  katalog_position?: string;
};

const VALID_RHYTHMUS = new Set([
  "monatlich",
  "quartalsweise",
  "jaehrlich",
  "tage",
]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);
const VALID_STEUERMODUS = new Set(["kleinunternehmer", "regelbesteuerung_ist"]);

function mapWr(r: PbWr): WiederkehrendeRechnung {
  const rhythmus = VALID_RHYTHMUS.has(r.rhythmus)
    ? (r.rhythmus as WiederkehrRhythmus)
    : "monatlich";
  const steuermodus = VALID_STEUERMODUS.has(r.steuermodus)
    ? (r.steuermodus as Steuermodus)
    : "kleinunternehmer";

  return {
    id: r.id,
    firma: r.firma,
    bezeichnung: r.bezeichnung,
    kunde: r.kunde || null,
    naechstes_datum: r.naechstes_datum,
    rhythmus,
    intervall_tage: Number(r.intervall_tage) || 0,
    zahlungsziel_tage:
      r.zahlungsziel_tage === undefined || r.zahlungsziel_tage === null
        ? 14
        : Number(r.zahlungsziel_tage),
    aktiv: r.aktiv !== false,
    notiz: r.notiz ?? "",
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuermodus,
    zuletzt_erzeugt_am: r.zuletzt_erzeugt_am ?? "",
    letzte_rechnung: r.letzte_rechnung || null,
    created: r.created,
    updated: r.updated,
  };
}

function mapPos(r: PbPos): WiederkehrPosition {
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as WiederkehrPosition["steuersatz"])
      : "";
  return {
    id: r.id,
    firma: r.firma,
    wiederkehrende_rechnung: r.wiederkehrende_rechnung,
    sortierung: Number(r.sortierung) || 0,
    bezeichnung: r.bezeichnung,
    menge: r.menge,
    einheit: r.einheit ?? "",
    einzelpreis: r.einzelpreis,
    steuersatz,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    katalog_position: r.katalog_position || null,
  };
}

async function listPositionenForWr(
  firmaId: string,
  wrId: string,
): Promise<WiederkehrPosition[]> {
  const result = await listRecords<PbPos>(COL_POS, {
    page: 1,
    perPage: 200,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("wiederkehrende_rechnung", wrId)}`,
    sort: "sortierung,id",
  });
  return result.items.map(mapPos);
}

async function replacePositionen(
  firmaId: string,
  wrId: string,
  positionen: ReturnType<typeof validateWiederkehrInput>["positionen"],
): Promise<WiederkehrPosition[]> {
  const existing = await listPositionenForWr(firmaId, wrId);
  for (const p of existing) {
    await deleteRecord(COL_POS, p.id);
  }

  const created: WiederkehrPosition[] = [];
  for (const p of positionen) {
    const body: Record<string, unknown> = {
      firma: firmaId,
      wiederkehrende_rechnung: wrId,
      sortierung: p.sortierung > 0 ? p.sortierung : 1,
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      betrag_netto: p.betrag_netto,
      betrag_ust: p.betrag_ust,
      betrag_brutto: p.betrag_brutto,
    };
    if (p.steuersatz) body.steuersatz = p.steuersatz;
    if (p.katalog_position) body.katalog_position = p.katalog_position;
    const r = await createRecord<PbPos>(COL_POS, body);
    created.push(mapPos(r));
  }
  return created;
}

export async function createWiederkehrendeRechnung(
  firmaId: string,
  input: WiederkehrInput,
): Promise<WiederkehrendeRechnungMitPositionen> {
  const firma = await getFirmaById(firmaId);
  if (!firma) throw new Error("Firma nicht gefunden.");
  const steuermodus = firma.steuermodus;
  const validated = validateWiederkehrInput(input, steuermodus);

  const body: Record<string, unknown> = {
    firma: firmaId,
    bezeichnung: validated.bezeichnung,
    naechstes_datum: validated.naechstes_datum,
    rhythmus: validated.rhythmus,
    aktiv: validated.aktiv,
    notiz: validated.notiz,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
    zahlungsziel_tage:
      validated.zahlungsziel_tage > 0 ? validated.zahlungsziel_tage : null,
  };
  if (validated.rhythmus === "tage" && validated.intervall_tage >= 1) {
    body.intervall_tage = validated.intervall_tage;
  }

  const r = await createRecord<PbWr>(COL, body);
  const wr = mapWr(r);
  const positionen = await replacePositionen(
    firmaId,
    wr.id,
    validated.positionen,
  );
  return { ...wr, positionen };
}

export async function updateWiederkehrendeRechnung(
  firmaId: string,
  id: string,
  input: WiederkehrInput,
): Promise<WiederkehrendeRechnungMitPositionen> {
  const existing = await getWiederkehrendeRechnung(firmaId, id);
  if (!existing) throw new Error("Wiederkehrende Rechnung nicht gefunden.");

  const firma = await getFirmaById(firmaId);
  if (!firma) throw new Error("Firma nicht gefunden.");
  const steuermodus = firma.steuermodus;
  const validated = validateWiederkehrInput(input, steuermodus);

  const body: Record<string, unknown> = {
    bezeichnung: validated.bezeichnung,
    naechstes_datum: validated.naechstes_datum,
    rhythmus: validated.rhythmus,
    aktiv: validated.aktiv,
    notiz: validated.notiz,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
    zahlungsziel_tage:
      validated.zahlungsziel_tage >= 0 ? validated.zahlungsziel_tage : null,
    intervall_tage:
      validated.rhythmus === "tage" ? validated.intervall_tage : null,
  };

  const r = await updateRecord<PbWr>(COL, id, body);
  const wr = mapWr(r);
  const positionen = await replacePositionen(firmaId, id, validated.positionen);
  return { ...wr, positionen };
}

export async function setWiederkehrAktiv(
  firmaId: string,
  id: string,
  aktiv: boolean,
): Promise<WiederkehrendeRechnung> {
  const existing = await getWiederkehrendeRechnung(firmaId, id);
  if (!existing) throw new Error("Wiederkehrende Rechnung nicht gefunden.");
  const r = await updateRecord<PbWr>(COL, id, { aktiv });
  return mapWr(r);
}

export async function deleteWiederkehrendeRechnung(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getWiederkehrendeRechnung(firmaId, id);
  if (!existing) throw new Error("Wiederkehrende Rechnung nicht gefunden.");
  const positionen = await listPositionenForWr(firmaId, id);
  for (const p of positionen) {
    await deleteRecord(COL_POS, p.id);
  }
  await deleteRecord(COL, id);
}

export async function getWiederkehrendeRechnung(
  firmaId: string,
  id: string,
): Promise<WiederkehrendeRechnung | null> {
  try {
    const r = await getRecord<PbWr>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapWr(r);
  } catch {
    return null;
  }
}

export async function getWiederkehrendeRechnungMitPositionen(
  firmaId: string,
  id: string,
): Promise<WiederkehrendeRechnungMitPositionen | null> {
  const wr = await getWiederkehrendeRechnung(firmaId, id);
  if (!wr) return null;
  const positionen = await listPositionenForWr(firmaId, id);
  return { ...wr, positionen };
}

export async function listWiederkehrendeRechnungen(
  firmaId: string,
  filter: WiederkehrFilter = {},
  page = 1,
  perPage = 50,
): Promise<WiederkehrListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.aktiv === true) {
    parts.push("aktiv = true");
  } else if (filter.aktiv === false) {
    parts.push("aktiv = false");
  }

  if (filter.kunde) {
    parts.push(pbEq("kunde", filter.kunde));
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(`(${pbLike("bezeichnung", q)} || ${pbLike("notiz", q)})`);
  }

  const result = await listRecords<PbWr>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "naechstes_datum,id",
  });

  return {
    items: result.items.map(mapWr),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/**
 * Alle aktiven, fälligen Vorlagen einer Firma (für Job / manuell).
 */
export async function listFaelligeWiederkehrende(
  firmaId: string,
  heute: string = todayBerlin(),
): Promise<WiederkehrendeRechnung[]> {
  const items: WiederkehrendeRechnung[] = [];
  // Read all pages before advancing any source, otherwise shrinking due pages skip rows.
  for (let page = 1; ; page++) {
    const result = await listRecords<PbWr>(COL, {
      page, perPage: 200,
      filter: `${pbEq("firma", firmaId)} && aktiv = true && naechstes_datum <= "${heute.replace(/"/g, "")}"`,
      sort: "naechstes_datum,id",
    });
    items.push(...result.items.map(mapWr).filter((w) => isVorlageFaellig(w, heute)));
    if (page >= result.totalPages) break;
  }
  return items;
}

export type ErzeugeErgebnis = {
  rechnungen: RechnungMitPositionen[];
  vorlage: WiederkehrendeRechnungMitPositionen;
};

/**
 * Erzeugt einen Rechnungs-Entwurf aus der Vorlage (einmal, ohne Datum-Vorschub).
 * Für manuell „Jetzt erzeugen“ — Vorschub optional.
 */
export async function erzeugeRechnungAusVorlage(
  firmaId: string,
  vorlageId: string,
  opts?: {
    /** false = naechstes_datum nicht vorschieben (Default: true) */
    advance?: boolean;
    now?: Date;
    akteur?: string;
  },
): Promise<ErzeugeErgebnis> {
  return generate(firmaId, vorlageId, { advance: opts?.advance !== false, akteur: opts?.akteur });
}

async function generate(firma: string, id: string, opts: { advance?: boolean; heute?: string; akteur?: string }): Promise<ErzeugeErgebnis> {
  const current = await getWiederkehrendeRechnungMitPositionen(firma, id);
  if (!current) throw new Error("Wiederkehrende Rechnung nicht gefunden.");
  const result = await releaseOperation<{ rechnung: RechnungMitPositionen; vorlage: PbWr; positionen: PbPos[] }>("wiederkehrend/erzeugen", {
    firma, id, akteur: await finanzAkteur(firma, opts.akteur), expectedDatum: current.naechstes_datum,
    advance: opts.advance !== false, heute: opts.heute,
  });
  return { rechnungen: result.rechnung ? [result.rechnung] : [], vorlage: { ...mapWr(result.vorlage), positionen: result.positionen.map(mapPos) } };
}

/** Bounded catch-up per source; each occurrence commits with its date advance. */
export async function erzeugeFaelligeAusVorlage(
  firmaId: string, vorlageId: string,
  opts?: { heute?: string; now?: Date; max?: number; akteur?: string },
): Promise<ErzeugeErgebnis> {
  const heute = opts?.heute ?? todayBerlin();
  const max = Math.min(opts?.max ?? MAX_CATCHUP_PRO_VORLAGE, MAX_CATCHUP_PRO_VORLAGE);
  const rechnungen: RechnungMitPositionen[] = [];
  let vorlage = await getWiederkehrendeRechnungMitPositionen(firmaId, vorlageId);
  if (!vorlage) throw new Error("Wiederkehrende Rechnung nicht gefunden.");
  for (let i = 0; i < max && isVorlageFaellig(vorlage, heute); i++) {
    const result = await generate(firmaId, vorlageId, { heute, akteur: opts?.akteur });
    rechnungen.push(...result.rechnungen);
    vorlage = result.vorlage;
  }
  return { rechnungen, vorlage };
}
