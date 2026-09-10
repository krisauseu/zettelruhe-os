/**
 * Persistenz Zeiteinträge über PocketBase (Superuser).
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
import {
  assertCanChangeStatus,
  assertEditable,
  validateZeiteintragInput,
  VALID_ABRECHNUNGSSTATUS,
} from "./invariants";
import type {
  Abrechnungsstatus,
  Zeiteintrag,
  ZeiteintragFilter,
  ZeiteintragInput,
  ZeiteintragListResult,
} from "./types";

const COL = "zeiteintraege";

type PbZeiteintrag = {
  id: string;
  firma: string;
  kunde: string;
  projekt?: string;
  datum: string;
  dauer_minuten: number;
  beschreibung?: string;
  status: string;
  stundensatz?: string;
  rechnung?: string;
  created?: string;
  updated?: string;
};

function mapZeiteintrag(r: PbZeiteintrag): Zeiteintrag {
  const status = VALID_ABRECHNUNGSSTATUS.has(r.status as Abrechnungsstatus)
    ? (r.status as Abrechnungsstatus)
    : "abrechenbar";

  return {
    id: r.id,
    firma: r.firma,
    kunde: r.kunde,
    projekt: r.projekt || null,
    datum: r.datum,
    dauer_minuten: Number(r.dauer_minuten) || 0,
    beschreibung: r.beschreibung ?? "",
    status,
    stundensatz: r.stundensatz ?? "",
    rechnung: r.rechnung || null,
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  validated: ReturnType<typeof validateZeiteintragInput>,
  firmaId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    firma: firmaId,
    kunde: validated.kunde,
    datum: validated.datum,
    dauer_minuten: validated.dauer_minuten,
    beschreibung: validated.beschreibung,
    status: validated.status,
    stundensatz: validated.stundensatz || null,
  };
  if (validated.projekt) {
    body.projekt = validated.projekt;
  } else {
    body.projekt = null;
  }
  return body;
}

export async function listZeiteintraege(
  firmaId: string,
  filter: ZeiteintragFilter = {},
  page = 1,
  perPage = 50,
): Promise<ZeiteintragListResult> {
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
    parts.push(`(${pbLike("beschreibung", q)})`);
  }

  const result = await listRecords<PbZeiteintrag>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "-datum,-id",
  });

  return {
    items: result.items.map(mapZeiteintrag),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/** Alle abrechenbaren Zeiteinträge einer:s Kund:in (für Übernahme). */
export async function listAbrechenbareZeiteintraege(
  firmaId: string,
  kundeId: string,
): Promise<Zeiteintrag[]> {
  const result = await listZeiteintraege(
    firmaId,
    { kunde: kundeId, status: "abrechenbar" },
    1,
    200,
  );
  return result.items;
}

export async function getZeiteintrag(
  firmaId: string,
  id: string,
): Promise<Zeiteintrag | null> {
  try {
    const r = await getRecord<PbZeiteintrag>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapZeiteintrag(r);
  } catch {
    return null;
  }
}

export async function createZeiteintrag(
  firmaId: string,
  input: ZeiteintragInput,
): Promise<Zeiteintrag> {
  const validated = validateZeiteintragInput(input);
  // Neu: abgerechnet ohne rechnung erlauben (manuell), Default abrechenbar
  const r = await createRecord<PbZeiteintrag>(
    COL,
    toPbBody(validated, firmaId),
  );
  return mapZeiteintrag(r);
}

export async function updateZeiteintrag(
  firmaId: string,
  id: string,
  input: ZeiteintragInput,
): Promise<Zeiteintrag> {
  const existing = await getZeiteintrag(firmaId, id);
  if (!existing) {
    throw new Error("Zeiteintrag nicht gefunden.");
  }
  assertEditable(existing);

  const validated = validateZeiteintragInput(input);
  // Statuswechsel bei Update prüfen
  if (validated.status !== existing.status) {
    assertCanChangeStatus(existing, validated.status);
  }

  const body = toPbBody(validated, firmaId);
  delete body.firma;

  const r = await updateRecord<PbZeiteintrag>(COL, id, body);
  return mapZeiteintrag(r);
}

export async function setZeiteintragStatus(
  firmaId: string,
  id: string,
  status: Abrechnungsstatus,
): Promise<Zeiteintrag> {
  const existing = await getZeiteintrag(firmaId, id);
  if (!existing) {
    throw new Error("Zeiteintrag nicht gefunden.");
  }
  assertCanChangeStatus(existing, status);
  const r = await updateRecord<PbZeiteintrag>(COL, id, { status });
  return mapZeiteintrag(r);
}

/**
 * Markiert Einträge als abgerechnet und verknüpft Rechnung (Übernahme-Hook).
 */
export async function markZeiteintraegeAbgerechnet(
  firmaId: string,
  ids: string[],
  rechnungId: string,
): Promise<void> {
  for (const id of ids) {
    const existing = await getZeiteintrag(firmaId, id);
    if (!existing) continue;
    if (existing.status === "abgerechnet" && existing.rechnung) continue;
    await updateRecord<PbZeiteintrag>(COL, id, {
      status: "abgerechnet",
      rechnung: rechnungId,
    });
  }
}

export async function deleteZeiteintrag(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getZeiteintrag(firmaId, id);
  if (!existing) {
    throw new Error("Zeiteintrag nicht gefunden.");
  }
  assertEditable(existing);
  await deleteRecord(COL, id);
}
