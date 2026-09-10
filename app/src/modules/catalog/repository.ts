/**
 * Persistenz Katalog-Positionen über PocketBase (Superuser).
 */

import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  updateRecord,
} from "@/lib/pb";
import { moneyToString, money } from "@/lib/money";
import type {
  KatalogFilter,
  KatalogListResult,
  KatalogPosition,
  KatalogPositionInput,
  Steuersatz,
} from "./types";

const COL = "katalog_positionen";

type PbKatalog = {
  id: string;
  firma: string;
  bezeichnung: string;
  einheit: string;
  preis: string;
  steuersatz?: string;
  notiz?: string;
  aktiv?: boolean;
  created?: string;
  updated?: string;
};

const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

function mapPosition(r: PbKatalog): KatalogPosition {
  const satz = r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
    ? (r.steuersatz as Steuersatz)
    : "";
  return {
    id: r.id,
    firma: r.firma,
    bezeichnung: r.bezeichnung,
    einheit: r.einheit,
    preis: r.preis,
    steuersatz: satz,
    notiz: r.notiz ?? "",
    aktiv: r.aktiv !== false,
    created: r.created,
    updated: r.updated,
  };
}

/** Normalisiert Preis-Eingabe (de-DE Komma oder Punkt) → "12.34" */
export function normalizePreisInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    throw new Error("Preis ist erforderlich.");
  }
  // de-DE: 1.234,56 → 1234.56
  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const d = money(normalized);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error("Ungültiger Preis.");
  }
  if (d.isNegative()) {
    throw new Error("Preis darf nicht negativ sein.");
  }
  return moneyToString(d);
}

function toPbBody(
  input: KatalogPositionInput,
  firmaId: string,
): Record<string, unknown> {
  const preis = normalizePreisInput(input.preis);
  const steuersatz =
    input.steuersatz && VALID_STEUERSATZ.has(input.steuersatz)
      ? input.steuersatz
      : "";

  return {
    firma: firmaId,
    bezeichnung: input.bezeichnung.trim(),
    einheit: input.einheit.trim() || "Stück",
    preis,
    steuersatz: steuersatz || null,
    notiz: (input.notiz ?? "").trim(),
    aktiv: input.aktiv !== false,
  };
}

export async function listKatalog(
  firmaId: string,
  filter: KatalogFilter = {},
  page = 1,
  perPage = 50,
): Promise<KatalogListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.nurAktiv) {
    parts.push("aktiv=true");
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("bezeichnung", q)} || ${pbLike("einheit", q)} || ${pbLike("notiz", q)})`,
    );
  }

  const result = await listRecords<PbKatalog>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "bezeichnung",
  });

  return {
    items: result.items.map(mapPosition),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function getKatalogPosition(
  firmaId: string,
  id: string,
): Promise<KatalogPosition | null> {
  try {
    const r = await getRecord<PbKatalog>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapPosition(r);
  } catch {
    return null;
  }
}

export async function createKatalogPosition(
  firmaId: string,
  input: KatalogPositionInput,
): Promise<KatalogPosition> {
  const r = await createRecord<PbKatalog>(COL, toPbBody(input, firmaId));
  return mapPosition(r);
}

export async function updateKatalogPosition(
  firmaId: string,
  id: string,
  input: KatalogPositionInput,
): Promise<KatalogPosition> {
  const existing = await getKatalogPosition(firmaId, id);
  if (!existing) {
    throw new Error("Katalog-Position nicht gefunden.");
  }
  const r = await updateRecord<PbKatalog>(COL, id, toPbBody(input, firmaId));
  return mapPosition(r);
}

export async function deleteKatalogPosition(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getKatalogPosition(firmaId, id);
  if (!existing) {
    throw new Error("Katalog-Position nicht gefunden.");
  }
  await deleteRecord(COL, id);
}

export async function listAllKatalog(
  firmaId: string,
): Promise<KatalogPosition[]> {
  const all: KatalogPosition[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await listKatalog(firmaId, {}, page, 200);
    all.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }
  return all;
}
