import { parseSteuerstandard } from "./steuerstandard";
/**
 * Persistenz Kontakte / Ansprechpartner über PocketBase (Superuser).
 */

import {
  allocateKontaktnummer,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  updateRecord,
} from "@/lib/pb";
import type {
  Ansprechpartner,
  AnsprechpartnerInput,
  Kontakt,
  KontaktFilter,
  KontaktInput,
  KontaktListResult,
} from "./types";

const COL_KONTAKTE = "kontakte";
const COL_ANSPRECHPARTNER = "ansprechpartner";

type PbKontakt = {
  id: string;
  firma: string;
  name: string;
  kontaktnummer?: string;
  ist_kunde?: boolean;
  ist_lieferant?: boolean;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
  iban?: string;
  bic?: string;
  ausgaben_steuerstandard?: string;
  ust_id?: string;
  leitweg_id?: string;
  notiz?: string;
  created?: string;
  updated?: string;
};

type PbAnsprechpartner = {
  id: string;
  firma: string;
  kontakt: string;
  name: string;
  email?: string;
  telefon?: string;
  position?: string;
};

function mapKontakt(r: PbKontakt): Kontakt {
  return {
    id: r.id,
    firma: r.firma,
    name: r.name,
    kontaktnummer: r.kontaktnummer ?? "",
    ist_kunde: Boolean(r.ist_kunde),
    ist_lieferant: Boolean(r.ist_lieferant),
    strasse: r.strasse ?? "",
    plz: r.plz ?? "",
    ort: r.ort ?? "",
    land: r.land ?? "",
    email: r.email ?? "",
    telefon: r.telefon ?? "",
    iban: r.iban ?? "",
    bic: r.bic ?? "",
    ausgaben_steuerstandard: parseSteuerstandard(r.ausgaben_steuerstandard ?? ""),
    ust_id: r.ust_id ?? "",
    leitweg_id: r.leitweg_id ?? "",
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function mapAnsprechpartner(r: PbAnsprechpartner): Ansprechpartner {
  return {
    id: r.id,
    firma: r.firma,
    kontakt: r.kontakt,
    name: r.name,
    email: r.email ?? "",
    telefon: r.telefon ?? "",
    position: r.position ?? "",
  };
}

function toPbBody(input: KontaktInput, firmaId: string): Record<string, unknown> {
  return {
    ...(input.ausgaben_steuerstandard !== undefined ? { ausgaben_steuerstandard: parseSteuerstandard(input.ausgaben_steuerstandard) } : {}),
    firma: firmaId,
    name: input.name.trim(),
    ist_kunde: input.ist_kunde,
    ist_lieferant: input.ist_lieferant,
    strasse: (input.strasse ?? "").trim(),
    plz: (input.plz ?? "").trim(),
    ort: (input.ort ?? "").trim(),
    land: (input.land ?? "DE").trim().toUpperCase() || "DE",
    email: (input.email ?? "").trim(),
    telefon: (input.telefon ?? "").trim(),
    iban: (input.iban ?? "").trim().replace(/\s+/g, "").toUpperCase(),
    bic: (input.bic ?? "").trim().toUpperCase(),
    ust_id: (input.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
    leitweg_id: (input.leitweg_id ?? "").trim(),
    notiz: (input.notiz ?? "").trim(),
  };
}

export async function listKontakte(
  firmaId: string,
  filter: KontaktFilter = {},
  page = 1,
  perPage = 50,
): Promise<KontaktListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.rolle === "kunde") {
    parts.push("ist_kunde=true");
  } else if (filter.rolle === "lieferant") {
    parts.push("ist_lieferant=true");
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("name", q)} || ${pbLike("email", q)} || ${pbLike("ort", q)} || ${pbLike("telefon", q)} || ${pbLike("ust_id", q)} || ${pbLike("kontaktnummer", q)})`,
    );
  }

  const result = await listRecords<PbKontakt>(COL_KONTAKTE, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "name",
  });

  return {
    items: result.items.map(mapKontakt),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function getKontakt(
  firmaId: string,
  id: string,
): Promise<Kontakt | null> {
  try {
    const r = await getRecord<PbKontakt>(COL_KONTAKTE, id);
    if (r.firma !== firmaId) return null;
    return mapKontakt(r);
  } catch {
    return null;
  }
}

export async function createKontakt(
  firmaId: string,
  input: KontaktInput,
): Promise<Kontakt> {
  const vorgegeben = (input.kontaktnummer ?? "").trim();
  const kontaktnummer =
    vorgegeben || (await allocateKontaktnummer(firmaId));
  try {
    const r = await createRecord<PbKontakt>(COL_KONTAKTE, {
      ...toPbBody(input, firmaId),
      kontaktnummer,
    });
    return mapKontakt(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg) || /must be unique/i.test(msg)) {
      throw new Error("Kontaktnummer ist bereits vergeben.");
    }
    throw e;
  }
}

export async function updateKontakt(
  firmaId: string,
  id: string,
  input: KontaktInput,
): Promise<Kontakt> {
  const existing = await getKontakt(firmaId, id);
  if (!existing) {
    throw new Error("Kontakt nicht gefunden.");
  }
  const r = await updateRecord<PbKontakt>(
    COL_KONTAKTE,
    id,
    toPbBody(input, firmaId),
  );
  return mapKontakt(r);
}

export async function deleteKontakt(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getKontakt(firmaId, id);
  if (!existing) {
    throw new Error("Kontakt nicht gefunden.");
  }
  await deleteRecord(COL_KONTAKTE, id);
}

export async function listAnsprechpartner(
  firmaId: string,
  kontaktId: string,
): Promise<Ansprechpartner[]> {
  const result = await listRecords<PbAnsprechpartner>(COL_ANSPRECHPARTNER, {
    page: 1,
    perPage: 100,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("kontakt", kontaktId)}`,
    sort: "name",
  });
  return result.items.map(mapAnsprechpartner);
}

export async function createAnsprechpartner(
  firmaId: string,
  kontaktId: string,
  input: AnsprechpartnerInput,
): Promise<Ansprechpartner> {
  const r = await createRecord<PbAnsprechpartner>(COL_ANSPRECHPARTNER, {
    firma: firmaId,
    kontakt: kontaktId,
    name: input.name.trim(),
    email: (input.email ?? "").trim(),
    telefon: (input.telefon ?? "").trim(),
    position: (input.position ?? "").trim(),
  });
  return mapAnsprechpartner(r);
}

export async function deleteAnsprechpartner(
  firmaId: string,
  id: string,
): Promise<void> {
  const r = await getRecord<PbAnsprechpartner>(COL_ANSPRECHPARTNER, id);
  if (r.firma !== firmaId) {
    throw new Error("Ansprechpartner nicht gefunden.");
  }
  await deleteRecord(COL_ANSPRECHPARTNER, id);
}

/** Alle Ansprechpartner einer Firma (für CSV-Export) */
export async function listAllAnsprechpartner(
  firmaId: string,
): Promise<Ansprechpartner[]> {
  const all: Ansprechpartner[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await listRecords<PbAnsprechpartner>(COL_ANSPRECHPARTNER, {
      page,
      perPage: 200,
      filter: pbEq("firma", firmaId),
      sort: "name",
    });
    all.push(...result.items.map(mapAnsprechpartner));
    totalPages = result.totalPages;
    page += 1;
  }
  return all;
}

/** Alle Kontakte einer Firma (für CSV-Export) */
export async function listAllKontakte(firmaId: string): Promise<Kontakt[]> {
  const all: Kontakt[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await listKontakte(firmaId, {}, page, 200);
    all.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }
  return all;
}
