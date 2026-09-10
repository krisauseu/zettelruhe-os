/**
 * Persistenz Kassenbuch über PocketBase (Superuser).
 * Anlegen = Festschreibung + Journal (quelle_typ=kasse).
 * Korrektur nur Storno/Gegenbuchung — kein Update/Delete (ADR-0004/0006).
 */

import {
  getRecord,
  listRecords,
  pbEq,
  pbLike,
} from "@/lib/pb";
import {
  finanzAkteur,
  kasseFestschreiben,
  kasseStornieren,
  neueFinanzRecordId,
  type KasseQuittung,
  type KasseStornoQuittung,
} from "@/lib/finanz-transaktion";
import { assertKategorieNamePasstZurRichtung } from "@/modules/categories/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  assertImmutableWriteBlocked,
  buildKassenbuchStornoInput,
  computeRunningSaldo,
  validateKassenbuchInput,
} from "./invariants";
import type {
  Buchungsrichtung,
  KassenbuchEintrag,
  KassenbuchEintragMitSaldo,
  KassenbuchFilter,
  KassenbuchInput,
  KassenbuchListResult,
  Steuersatz,
} from "./types";

const COL = "kassenbuch_eintraege";

type PbKasse = {
  id: string;
  firma: string;
  datum: string;
  richtung: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz?: string;
  text: string;
  kategorie?: string;
  notiz?: string;
  kontakt?: string;
  belegnummer: string;
  journal_eintrag?: string;
  festgeschrieben_am: string;
  storno_von?: string;
  created?: string;
  updated?: string;
};

const VALID_RICHTUNG = new Set(["einnahme", "ausgabe"]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

export function kasseProjektion(
  entry: KassenbuchEintrag,
): Record<string, unknown> {
  return {
    id: entry.id,
    firma: entry.firma,
    datum: entry.datum,
    richtung: entry.richtung,
    betrag_netto: entry.betrag_netto,
    betrag_ust: entry.betrag_ust,
    betrag_brutto: entry.betrag_brutto,
    steuersatz: entry.steuersatz,
    text: entry.text,
    kategorie: entry.kategorie,
    notiz: entry.notiz,
    kontakt: entry.kontakt || "",
    belegnummer: entry.belegnummer,
    journal_eintrag: entry.journal_eintrag || "",
    festgeschrieben_am: entry.festgeschrieben_am,
    storno_von: entry.storno_von || "",
  };
}

function mapEintrag(r: PbKasse): KassenbuchEintrag {
  const richtung = VALID_RICHTUNG.has(r.richtung)
    ? (r.richtung as Buchungsrichtung)
    : "ausgabe";
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";

  return {
    id: r.id,
    firma: r.firma,
    datum: r.datum,
    richtung,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuersatz,
    text: r.text,
    kategorie: r.kategorie ?? "",
    notiz: r.notiz ?? "",
    kontakt: r.kontakt || null,
    belegnummer: r.belegnummer,
    journal_eintrag: r.journal_eintrag || null,
    festgeschrieben_am: r.festgeschrieben_am,
    storno_von: r.storno_von || null,
    created: r.created,
    updated: r.updated,
  };
}

/** Alle Einträge einer Firma (für Saldo; Solo-Betrieb). */
async function listAllForFirma(firmaId: string): Promise<KassenbuchEintrag[]> {
  const items: KassenbuchEintrag[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await listRecords<PbKasse>(COL, {
      page,
      perPage: 200,
      filter: pbEq("firma", firmaId),
      sort: "datum,id",
    });
    totalPages = result.totalPages;
    items.push(...result.items.map(mapEintrag));
    page += 1;
    if (result.items.length === 0) break;
  }
  return items;
}

/**
 * Bareinnahme/Barausgabe festschreiben:
 * Belegnummer → Eintrag anlegen → Journal (quelle_typ=kasse) → Verknüpfung.
 */
export async function festschreibenKassenbuchEintrag(
  firmaId: string,
  input: KassenbuchInput,
  opts?: { now?: Date; akteur?: string; vorgangId?: string },
): Promise<{
  eintrag: KassenbuchEintrag;
  journal: JournalEintrag;
  quittung: KasseQuittung;
}> {
  const validated = validateKassenbuchInput(input);
  await assertKategorieNamePasstZurRichtung(
    firmaId,
    validated.kategorie,
    validated.richtung,
  );
  const vorgangId = opts?.vorgangId ?? neueFinanzRecordId();
  const response = await kasseFestschreiben<
    KasseQuittung & { eintrag: PbKasse; journal: JournalEintrag }
  >({
    firma: firmaId,
    akteur: await finanzAkteur(firmaId, opts?.akteur),
    id: vorgangId,
    values: {
      datum: validated.datum,
      richtung: validated.richtung,
      betrag_netto: validated.betrag_netto,
      betrag_ust: validated.betrag_ust,
      betrag_brutto: validated.betrag_brutto,
      steuersatz: validated.steuersatz || "",
      text: validated.text,
      kategorie: validated.kategorie,
      notiz: validated.notiz,
      kontakt: validated.kontakt || "",
    },
  });
  const { eintrag, journal, ...quittung } = response;
  return {
    eintrag: mapEintrag(eintrag),
    journal: {
      ...journal,
      kontakt: journal.kontakt || null,
      storno_von: journal.storno_von || null,
    },
    quittung,
  };
}

/**
 * Storno light: Kassenbuch-Gegenbuchung + Journal-Storno (append-only).
 */
export async function storniereKassenbuchEintrag(
  firmaId: string,
  eintragId: string,
  opts?: { datum?: string; text?: string; now?: Date; akteur?: string },
): Promise<{
  eintrag: KassenbuchEintrag;
  journal: JournalEintrag;
  quittung: KasseStornoQuittung;
}> {
  const raw = await getRecord<PbKasse>(COL, eintragId);
  if (raw.firma !== firmaId) throw new Error("Kassenbuch-Eintrag nicht gefunden.");
  const original = mapEintrag(raw);
  if (original.storno_von) {
    throw new Error("Eine Storno-Gegenbuchung kann nicht erneut storniert werden.");
  }

  if (!original.journal_eintrag) {
    throw new Error(
      "Kassenbuch-Eintrag hat keinen Journal-Verweis — Storno nicht möglich.",
    );
  }

  const stornoInput = buildKassenbuchStornoInput(original, {
    datum: opts?.datum,
    text: opts?.text,
  });
  const validated = validateKassenbuchInput(stornoInput);

  const response = await kasseStornieren<
    KasseStornoQuittung & { eintrag: PbKasse; journal: JournalEintrag }
  >({
    firma: firmaId,
    akteur: await finanzAkteur(firmaId, opts?.akteur),
    id: original.id,
    expected: kasseProjektion(original),
    values: {
      datum: validated.datum,
      richtung: validated.richtung,
      betrag_netto: validated.betrag_netto,
      betrag_ust: validated.betrag_ust,
      betrag_brutto: validated.betrag_brutto,
      steuersatz: validated.steuersatz || "",
      text: validated.text,
      kategorie: validated.kategorie,
      notiz: validated.notiz,
      kontakt: validated.kontakt || "",
    },
  });
  const { eintrag, journal, ...quittung } = response;
  return {
    eintrag: mapEintrag(eintrag),
    journal: {
      ...journal,
      kontakt: journal.kontakt || null,
      storno_von: journal.storno_von || null,
    },
    quittung,
  };
}

/** Findet die Kassenbuch-Gegenbuchung zu einem Eintrag (falls vorhanden). */
export async function findKassenbuchStornoFuer(
  firmaId: string,
  originalId: string,
): Promise<KassenbuchEintrag | null> {
  const result = await listRecords<PbKasse>(COL, {
    page: 1,
    perPage: 1,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("storno_von", originalId)}`,
    sort: "datum,id",
  });
  if (result.items.length === 0) return null;
  return mapEintrag(result.items[0]);
}

export async function getKassenbuchEintrag(
  firmaId: string,
  id: string,
): Promise<KassenbuchEintrag | null> {
  try {
    const r = await getRecord<PbKasse>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapEintrag(r);
  } catch {
    return null;
  }
}

/** Aktueller Kassensaldo (alle Einträge chronologisch). */
export async function getKassenSaldo(firmaId: string): Promise<string> {
  const all = await listAllForFirma(firmaId);
  return computeRunningSaldo(all).saldo;
}

/**
 * Liste mit Filter; Saldo-Spalte aus vollständiger Chronologie.
 * Anzeige-Sortierung: neueste zuerst (-datum,-id).
 */
export async function listKassenbuch(
  firmaId: string,
  filter: KassenbuchFilter = {},
  page = 1,
  perPage = 50,
): Promise<
  KassenbuchListResult & { itemsMitSaldo: KassenbuchEintragMitSaldo[] }
> {
  const all = await listAllForFirma(firmaId);
  const { items: withSaldo, saldo } = computeRunningSaldo(all);
  const saldoById = new Map(withSaldo.map((e) => [e.id, e.saldo_nach]));

  const parts = [pbEq("firma", firmaId)];

  if (filter.richtung === "einnahme" || filter.richtung === "ausgabe") {
    parts.push(pbEq("richtung", filter.richtung));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`datum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`datum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("text", q)} || ${pbLike("kategorie", q)} || ${pbLike("notiz", q)} || ${pbLike("belegnummer", q)})`,
    );
  }

  const result = await listRecords<PbKasse>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort
    sort: "-datum,-id",
  });

  const items = result.items.map(mapEintrag);
  const itemsMitSaldo: KassenbuchEintragMitSaldo[] = items.map((e) => ({
    ...e,
    saldo_nach: saldoById.get(e.id) ?? "0.00",
  }));

  return {
    items,
    itemsMitSaldo,
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
    saldo,
  };
}

/** Kategorie-Schnappschüsse zu bekannten IDs (eine Filterwelle je 50, Solo-Volumen). */
export async function listKassenbuchByIds(
  firmaId: string,
  ids: string[],
): Promise<KassenbuchEintrag[]> {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return [];
  const out: KassenbuchEintrag[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const result = await listRecords<PbKasse>(COL, {
      page: 1,
      perPage: 50,
      filter: `${pbEq("firma", firmaId)} && (${chunk.map((id) => pbEq("id", id)).join(" || ")})`,
    });
    out.push(...result.items.map(mapEintrag));
  }
  return out;
}

/** Saldo nach einem konkreten Eintrag (für Detail). */
export async function getSaldoNachEintrag(
  firmaId: string,
  eintragId: string,
): Promise<string | null> {
  const all = await listAllForFirma(firmaId);
  const { items } = computeRunningSaldo(all);
  const found = items.find((e) => e.id === eintragId);
  return found ? found.saldo_nach : null;
}

export async function updateKassenbuchEintrag(): Promise<never> {
  assertImmutableWriteBlocked("update");
}

export async function deleteKassenbuchEintrag(): Promise<never> {
  assertImmutableWriteBlocked("delete");
}
