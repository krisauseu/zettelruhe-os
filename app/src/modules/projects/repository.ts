/**
 * Persistenz Projekte über PocketBase (Superuser).
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
import { validateProjektInput } from "./invariants";
import type {
  Projekt,
  ProjektFilter,
  ProjektInput,
  ProjektListResult,
} from "./types";

const COL = "projekte";

type PbProjekt = {
  id: string;
  firma: string;
  kunde: string;
  name: string;
  notiz?: string;
  aktiv?: boolean;
  created?: string;
  updated?: string;
};

function mapProjekt(r: PbProjekt): Projekt {
  return {
    id: r.id,
    firma: r.firma,
    kunde: r.kunde,
    name: r.name,
    notiz: r.notiz ?? "",
    // PB bool: fehlend → aktiv (Default)
    aktiv: r.aktiv !== false,
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  validated: ReturnType<typeof validateProjektInput>,
  firmaId: string,
): Record<string, unknown> {
  return {
    firma: firmaId,
    kunde: validated.kunde,
    name: validated.name,
    notiz: validated.notiz,
    aktiv: validated.aktiv,
  };
}

export async function listProjekte(
  firmaId: string,
  filter: ProjektFilter = {},
  page = 1,
  perPage = 50,
): Promise<ProjektListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.kunde) {
    parts.push(pbEq("kunde", filter.kunde));
  }

  if (filter.aktiv === true) {
    parts.push("aktiv=true");
  } else if (filter.aktiv === false) {
    parts.push("aktiv=false");
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(`(${pbLike("name", q)} || ${pbLike("notiz", q)})`);
  }

  const result = await listRecords<PbProjekt>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: system created nicht sortierbar
    sort: "name",
  });

  return {
    items: result.items.map(mapProjekt),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/** Alle aktiven Projekte einer Firma (optional je Kund:in) — Dropdowns. */
export async function listProjekteForKunde(
  firmaId: string,
  kundeId?: string,
  onlyActive = true,
): Promise<Projekt[]> {
  const result = await listProjekte(
    firmaId,
    {
      kunde: kundeId,
      aktiv: onlyActive ? true : undefined,
    },
    1,
    200,
  );
  return result.items;
}

export async function getProjekt(
  firmaId: string,
  id: string,
): Promise<Projekt | null> {
  try {
    const r = await getRecord<PbProjekt>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapProjekt(r);
  } catch {
    return null;
  }
}

export async function createProjekt(
  firmaId: string,
  input: ProjektInput,
): Promise<Projekt> {
  const validated = validateProjektInput(input);
  const r = await createRecord<PbProjekt>(
    COL,
    toPbBody(validated, firmaId),
  );
  return mapProjekt(r);
}

export async function updateProjekt(
  firmaId: string,
  id: string,
  input: ProjektInput,
): Promise<Projekt> {
  const existing = await getProjekt(firmaId, id);
  if (!existing) {
    throw new Error("Projekt nicht gefunden.");
  }
  const validated = validateProjektInput(input);
  const body = toPbBody(validated, firmaId);
  delete body.firma;
  const r = await updateRecord<PbProjekt>(COL, id, body);
  return mapProjekt(r);
}

export async function deleteProjekt(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getProjekt(firmaId, id);
  if (!existing) {
    throw new Error("Projekt nicht gefunden.");
  }
  await deleteRecord(COL, id);
}
