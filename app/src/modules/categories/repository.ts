/**
 * Persistenz Kategorien über PocketBase (Superuser).
 * Verwendung prüft Belege und Kassenbuch-Einträge (Text-Schnappschuss).
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
import {
  KATEGORIE_IN_VERWENDUNG_ERROR,
  KATEGORIE_NAME_DOPPELT_ERROR,
  assertKategoriePasstZurRichtung,
  kategorieNameKey,
  normalizeKategorieName,
  parseKategorieRichtung,
  validateKategorieInput,
} from "./invariants";
import type {
  Buchungsrichtung,
  Kategorie,
  KategorieFilter,
  KategorieInput,
  KategorieListResult,
  KategorieVerwendung,
} from "./types";

const COL = "kategorien";
const COL_BELEGE = "belege";
const COL_KASSE = "kassenbuch_eintraege";

type PbKategorie = {
  id: string;
  firma: string;
  name: string;
  richtung?: string;
  aktiv?: boolean;
  notiz?: string;
  created?: string;
  updated?: string;
};

function mapKategorie(r: PbKategorie): Kategorie {
  return {
    id: r.id,
    firma: r.firma,
    name: r.name,
    richtung: parseKategorieRichtung(r.richtung),
    aktiv: r.aktiv !== false,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  input: KategorieInput,
  firmaId: string,
): Record<string, unknown> {
  const v = validateKategorieInput(input);
  return {
    firma: firmaId,
    name: v.name,
    richtung: v.richtung,
    aktiv: v.aktiv,
    notiz: v.notiz,
  };
}

export async function listKategorien(
  firmaId: string,
  filter: KategorieFilter = {},
  page = 1,
  perPage = 50,
): Promise<KategorieListResult> {
  const parts = [pbEq("firma", firmaId)];
  if (filter.nurAktiv) {
    parts.push("aktiv=true");
  }
  const q = filter.q?.trim();
  if (q) {
    parts.push(`(${pbLike("name", q)} || ${pbLike("notiz", q)})`);
  }

  const result = await listRecords<PbKategorie>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "name",
  });

  return {
    items: result.items.map(mapKategorie),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function listAllKategorien(
  firmaId: string,
  filter: KategorieFilter = {},
): Promise<Kategorie[]> {
  const all: Kategorie[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await listKategorien(firmaId, filter, page, 200);
    all.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }
  return all;
}

export async function getKategorie(
  firmaId: string,
  id: string,
): Promise<Kategorie | null> {
  try {
    const r = await getRecord<PbKategorie>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapKategorie(r);
  } catch {
    return null;
  }
}

export async function findKategorieByName(
  firmaId: string,
  name: string,
): Promise<Kategorie | null> {
  const n = normalizeKategorieName(name);
  if (!n) return null;
  const key = kategorieNameKey(n);
  const all = await listAllKategorien(firmaId);
  return all.find((k) => kategorieNameKey(k.name) === key) ?? null;
}

/**
 * I/O-Gate zur reinen Invariante: leere Kategorie ok; unbekannter Name
 * (Schnappschuss) ok; Stammdaten müssen zur Buchungsrichtung passen.
 */
export async function assertKategorieNamePasstZurRichtung(
  firmaId: string,
  name: string,
  richtung: Buchungsrichtung,
): Promise<void> {
  const n = normalizeKategorieName(name);
  if (!n) return;
  const found = await findKategorieByName(firmaId, n);
  assertKategoriePasstZurRichtung(n, richtung, found?.richtung ?? null);
}

async function findNameKonflikt(
  firmaId: string,
  name: string,
  exceptId?: string,
): Promise<Kategorie | null> {
  const key = kategorieNameKey(name);
  const all = await listAllKategorien(firmaId);
  return (
    all.find(
      (k) => k.id !== exceptId && kategorieNameKey(k.name) === key,
    ) ?? null
  );
}

export async function countKategorieVerwendung(
  firmaId: string,
  name: string,
): Promise<KategorieVerwendung> {
  const n = name.trim();
  if (!n) return { belege: 0, kasse: 0 };

  const filter = `${pbEq("firma", firmaId)} && ${pbEq("kategorie", n)}`;
  const [belege, kasse] = await Promise.all([
    listRecords<{ id: string }>(COL_BELEGE, {
      page: 1,
      perPage: 1,
      filter,
    }),
    listRecords<{ id: string }>(COL_KASSE, {
      page: 1,
      perPage: 1,
      filter,
    }),
  ]);
  return { belege: belege.totalItems, kasse: kasse.totalItems };
}

export async function createKategorie(
  firmaId: string,
  input: KategorieInput,
): Promise<Kategorie> {
  const v = validateKategorieInput(input);
  const konflikt = await findNameKonflikt(firmaId, v.name);
  if (konflikt) {
    throw new Error(KATEGORIE_NAME_DOPPELT_ERROR);
  }
  const r = await createRecord<PbKategorie>(COL, toPbBody(v, firmaId));
  return mapKategorie(r);
}

export async function updateKategorie(
  firmaId: string,
  id: string,
  input: KategorieInput,
): Promise<Kategorie> {
  const existing = await getKategorie(firmaId, id);
  if (!existing) {
    throw new Error("Kategorie nicht gefunden.");
  }
  const v = validateKategorieInput(input);
  const konflikt = await findNameKonflikt(firmaId, v.name, id);
  if (konflikt) {
    throw new Error(KATEGORIE_NAME_DOPPELT_ERROR);
  }
  const r = await updateRecord<PbKategorie>(COL, id, toPbBody(v, firmaId));
  return mapKategorie(r);
}

export async function deleteKategorie(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getKategorie(firmaId, id);
  if (!existing) {
    throw new Error("Kategorie nicht gefunden.");
  }
  const usage = await countKategorieVerwendung(firmaId, existing.name);
  if (usage.belege + usage.kasse > 0) {
    throw new Error(KATEGORIE_IN_VERWENDUNG_ERROR);
  }
  await deleteRecord(COL, id);
}
