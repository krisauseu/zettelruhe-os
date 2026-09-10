/**
 * Persistenz Fahrten über PocketBase (Superuser).
 * Kein Journal — Abrechnung erst über Rechnung.
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
import { VALID_ABRECHNUNGSSTATUS } from "@/modules/time/invariants";
import type { Abrechnungsstatus } from "@/modules/time/types";
import {
  assertCanChangeFahrtStatus,
  assertFahrtEditable,
  validateFahrtInput,
} from "./invariants";
import type {
  Fahrt,
  FahrtFilter,
  FahrtInput,
  FahrtListResult,
} from "./types";

const COL = "fahrten";

type PbFahrt = {
  id: string;
  firma: string;
  kunde: string;
  projekt?: string;
  datum: string;
  km: string;
  strecke?: string;
  status: string;
  steuerlich_relevant?: boolean;
  steuer_notiz?: string;
  km_satz?: string;
  rechnung?: string;
  created?: string;
  updated?: string;
};

function mapFahrt(r: PbFahrt): Fahrt {
  const status = VALID_ABRECHNUNGSSTATUS.has(r.status as Abrechnungsstatus)
    ? (r.status as Abrechnungsstatus)
    : "abrechenbar";

  return {
    id: r.id,
    firma: r.firma,
    kunde: r.kunde,
    projekt: r.projekt || null,
    datum: r.datum,
    km: r.km,
    strecke: r.strecke ?? "",
    status,
    steuerlich_relevant: Boolean(r.steuerlich_relevant),
    steuer_notiz: r.steuer_notiz ?? "",
    km_satz: r.km_satz ?? "",
    rechnung: r.rechnung || null,
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  validated: ReturnType<typeof validateFahrtInput>,
  firmaId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    firma: firmaId,
    kunde: validated.kunde,
    datum: validated.datum,
    km: validated.km,
    strecke: validated.strecke,
    status: validated.status,
    steuerlich_relevant: validated.steuerlich_relevant,
    steuer_notiz: validated.steuer_notiz,
    km_satz: validated.km_satz || null,
  };
  if (validated.projekt) {
    body.projekt = validated.projekt;
  } else {
    body.projekt = null;
  }
  return body;
}

export async function listFahrten(
  firmaId: string,
  filter: FahrtFilter = {},
  page = 1,
  perPage = 50,
): Promise<FahrtListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.kunde) {
    parts.push(pbEq("kunde", filter.kunde));
  }
  if (filter.projekt) {
    parts.push(pbEq("projekt", filter.projekt));
  }
  if (filter.status && VALID_ABRECHNUNGSSTATUS.has(filter.status)) {
    parts.push(pbEq("status", filter.status));
  }
  if (filter.von) {
    parts.push(`datum >= "${filter.von}"`);
  }
  if (filter.bis) {
    parts.push(`datum <= "${filter.bis}"`);
  }
  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("strecke", q)} || ${pbLike("steuer_notiz", q)})`,
    );
  }

  const result = await listRecords<PbFahrt>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "-datum,-id",
  });

  return {
    items: result.items.map(mapFahrt),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function listAbrechenbareFahrten(
  firmaId: string,
  kundeId: string,
): Promise<Fahrt[]> {
  const result = await listFahrten(
    firmaId,
    { kunde: kundeId, status: "abrechenbar" },
    1,
    200,
  );
  return result.items;
}

export async function getFahrt(
  firmaId: string,
  id: string,
): Promise<Fahrt | null> {
  try {
    const r = await getRecord<PbFahrt>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapFahrt(r);
  } catch {
    return null;
  }
}

export async function createFahrt(
  firmaId: string,
  input: FahrtInput,
): Promise<Fahrt> {
  const validated = validateFahrtInput(input);
  const r = await createRecord<PbFahrt>(COL, toPbBody(validated, firmaId));
  return mapFahrt(r);
}

export async function updateFahrt(
  firmaId: string,
  id: string,
  input: FahrtInput,
): Promise<Fahrt> {
  const existing = await getFahrt(firmaId, id);
  if (!existing) {
    throw new Error("Fahrt nicht gefunden.");
  }
  assertFahrtEditable(existing);

  const validated = validateFahrtInput(input);
  if (validated.status !== existing.status) {
    assertCanChangeFahrtStatus(existing, validated.status);
  }

  const body = toPbBody(validated, firmaId);
  delete body.firma;

  const r = await updateRecord<PbFahrt>(COL, id, body);
  return mapFahrt(r);
}

export async function setFahrtStatus(
  firmaId: string,
  id: string,
  status: Abrechnungsstatus,
): Promise<Fahrt> {
  const existing = await getFahrt(firmaId, id);
  if (!existing) {
    throw new Error("Fahrt nicht gefunden.");
  }
  assertCanChangeFahrtStatus(existing, status);
  const r = await updateRecord<PbFahrt>(COL, id, { status });
  return mapFahrt(r);
}

export async function markFahrtenAbgerechnet(
  firmaId: string,
  ids: string[],
  rechnungId: string,
): Promise<void> {
  for (const id of ids) {
    const existing = await getFahrt(firmaId, id);
    if (!existing) continue;
    if (existing.status === "abgerechnet" && existing.rechnung) continue;
    await updateRecord<PbFahrt>(COL, id, {
      status: "abgerechnet",
      rechnung: rechnungId,
    });
  }
}

export async function deleteFahrt(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getFahrt(firmaId, id);
  if (!existing) {
    throw new Error("Fahrt nicht gefunden.");
  }
  assertFahrtEditable(existing);
  await deleteRecord(COL, id);
}
