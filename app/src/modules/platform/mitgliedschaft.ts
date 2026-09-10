/**
 * Mitgliedschaften User↔Firma (ADR-0025).
 * Writes nur über Next / Superuser (ADR-0006).
 */

import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  pbEq,
  updateRecord,
  type AuthUser,
  type FirmaRecord,
  getFirmaById,
} from "@/lib/pb";
import {
  BEREITS_MITGLIED_ERROR,
  INSTANZ_ROLLE_NUTZER,
  assertKannMitgliedschaftEntfernen,
  isMitgliedschaftRolle,
  assertFremdesPasswortZiel,
  validateEinladenInput,
  validateNeuesPasswort,
  validateRollenwechsel,
  type MitgliedschaftRolle,
} from "./rechte";

const COL = "mitgliedschaften";

type PbMitgliedschaft = {
  id: string;
  user: string;
  firma: string;
  rolle: string;
};

export type Mitgliedschaft = {
  id: string;
  userId: string;
  firmaId: string;
  rolle: MitgliedschaftRolle;
};

export type MitgliedschaftMitNutzer = Mitgliedschaft & {
  name: string;
  email: string;
  instanzRolle: string;
};

function mapMitgliedschaft(r: PbMitgliedschaft): Mitgliedschaft | null {
  if (!isMitgliedschaftRolle(r.rolle)) return null;
  return {
    id: r.id,
    userId: r.user,
    firmaId: r.firma,
    rolle: r.rolle,
  };
}

export async function createMitgliedschaft(input: {
  userId: string;
  firmaId: string;
  rolle: MitgliedschaftRolle;
}): Promise<Mitgliedschaft> {
  const r = await createRecord<PbMitgliedschaft>(COL, {
    user: input.userId,
    firma: input.firmaId,
    rolle: input.rolle,
  });
  const mapped = mapMitgliedschaft(r);
  if (!mapped) {
    throw new Error("Mitgliedschaft ungültig.");
  }
  return mapped;
}

export async function getMitgliedschaft(
  userId: string,
  firmaId: string,
): Promise<Mitgliedschaft | null> {
  const list = await listRecords<PbMitgliedschaft>(COL, {
    page: 1,
    perPage: 1,
    filter: `${pbEq("user", userId)} && ${pbEq("firma", firmaId)}`,
  });
  if (list.items.length === 0) return null;
  return mapMitgliedschaft(list.items[0]);
}

export async function listMitgliedschaftenFuerNutzer(
  userId: string,
): Promise<Mitgliedschaft[]> {
  const list = await listRecords<PbMitgliedschaft>(COL, {
    page: 1,
    perPage: 200,
    filter: pbEq("user", userId),
  });
  return list.items
    .map(mapMitgliedschaft)
    .filter((m): m is Mitgliedschaft => m !== null);
}

export async function listMitgliedschaftenFuerFirma(
  firmaId: string,
): Promise<Mitgliedschaft[]> {
  const list = await listRecords<PbMitgliedschaft>(COL, {
    page: 1,
    perPage: 200,
    filter: pbEq("firma", firmaId),
  });
  return list.items
    .map(mapMitgliedschaft)
    .filter((m): m is Mitgliedschaft => m !== null);
}

export async function countEigentuemer(firmaId: string): Promise<number> {
  const alle = await listMitgliedschaftenFuerFirma(firmaId);
  return alle.filter((m) => m.rolle === "eigentuemer").length;
}

export async function listFirmenFuerNutzer(
  userId: string,
): Promise<FirmaRecord[]> {
  const mitgliedschaften = await listMitgliedschaftenFuerNutzer(userId);
  const firmen: FirmaRecord[] = [];
  for (const m of mitgliedschaften) {
    const firma = await getFirmaById(m.firmaId);
    if (firma) firmen.push(firma);
  }
  firmen.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return firmen;
}

/**
 * Bevorzugte Firma, wenn Mitgliedschaft besteht, sonst erste Mitgliedschaft.
 */
export async function resolveMitgliedschaftFuerSession(
  userId: string,
  preferredFirmaId: string | null,
): Promise<Mitgliedschaft | null> {
  if (preferredFirmaId) {
    const preferred = await getMitgliedschaft(userId, preferredFirmaId);
    if (preferred) return preferred;
  }
  const alle = await listMitgliedschaftenFuerNutzer(userId);
  return alle[0] ?? null;
}

type PbUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  firma?: string;
};

function mapUser(r: PbUser): AuthUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name || r.email,
    role: r.role || INSTANZ_ROLLE_NUTZER,
    firma: r.firma || null,
  };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  try {
    const r = await getRecord<PbUser>("users", userId);
    return mapUser(r);
  } catch {
    return null;
  }
}

export async function findUserByEmail(
  email: string,
): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const list = await listRecords<PbUser>("users", {
    page: 1,
    perPage: 1,
    filter: pbEq("email", normalized),
  });
  if (list.items.length === 0) return null;
  return mapUser(list.items[0]);
}

export async function listMitgliederDerFirma(
  firmaId: string,
): Promise<MitgliedschaftMitNutzer[]> {
  const mitgliedschaften = await listMitgliedschaftenFuerFirma(firmaId);
  const rows: MitgliedschaftMitNutzer[] = [];
  for (const m of mitgliedschaften) {
    const user = await getUserById(m.userId);
    if (!user) continue;
    rows.push({
      ...m,
      name: user.name,
      email: user.email,
      instanzRolle: user.role,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return rows;
}

async function createAuthNutzer(input: {
  name: string;
  email: string;
  password: string;
  firmaId: string;
}): Promise<AuthUser> {
  const r = await createRecord<PbUser>("users", {
    email: input.email,
    password: input.password,
    passwordConfirm: input.password,
    name: input.name,
    role: INSTANZ_ROLLE_NUTZER,
    firma: input.firmaId,
    emailVisibility: true,
    verified: true,
  });
  return mapUser(r);
}

export async function einladenNutzer(input: {
  firmaId: string;
  name: string;
  email: string;
  password: string;
  rolle: string;
}): Promise<{ user: AuthUser; angelegt: boolean }> {
  const existing = await findUserByEmail(input.email);
  const parsed = validateEinladenInput({
    name: input.name,
    email: input.email,
    password: input.password,
    rolle: input.rolle,
    bestehendesKonto: Boolean(existing),
  });

  if (existing) {
    const schon = await getMitgliedschaft(existing.id, input.firmaId);
    if (schon) {
      throw new Error(BEREITS_MITGLIED_ERROR);
    }
    await createMitgliedschaft({
      userId: existing.id,
      firmaId: input.firmaId,
      rolle: parsed.rolle,
    });
    return { user: existing, angelegt: false };
  }

  const user = await createAuthNutzer({
    name: parsed.name,
    email: parsed.email,
    password: parsed.password,
    firmaId: input.firmaId,
  });
  await createMitgliedschaft({
    userId: user.id,
    firmaId: input.firmaId,
    rolle: parsed.rolle,
  });
  return { user, angelegt: true };
}

export async function aendereMitgliedschaftRolle(input: {
  handelndeUserId: string;
  mitgliedschaftId: string;
  firmaId: string;
  neueRolle: string;
}): Promise<Mitgliedschaft> {
  const existing = await getRecord<PbMitgliedschaft>(
    COL,
    input.mitgliedschaftId,
  );
  const mapped = mapMitgliedschaft(existing);
  if (!mapped || mapped.firmaId !== input.firmaId) {
    throw new Error("Mitgliedschaft nicht gefunden.");
  }
  const eigentuemerAnzahl = await countEigentuemer(input.firmaId);
  const neueRolle = validateRollenwechsel({
    handelndeUserId: input.handelndeUserId,
    zielUserId: mapped.userId,
    bisherigeRolle: mapped.rolle,
    neueRolle: input.neueRolle,
    eigentuemerAnzahl,
  });
  const updated = await updateRecord<PbMitgliedschaft>(COL, mapped.id, {
    rolle: neueRolle,
  });
  const result = mapMitgliedschaft(updated);
  if (!result) throw new Error("Mitgliedschaft ungültig.");
  return result;
}

export async function entferneMitgliedschaft(input: {
  handelndeUserId: string;
  mitgliedschaftId: string;
  firmaId: string;
}): Promise<void> {
  const existing = await getRecord<PbMitgliedschaft>(
    COL,
    input.mitgliedschaftId,
  );
  const mapped = mapMitgliedschaft(existing);
  if (!mapped || mapped.firmaId !== input.firmaId) {
    throw new Error("Mitgliedschaft nicht gefunden.");
  }
  const eigentuemerAnzahl = await countEigentuemer(input.firmaId);
  assertKannMitgliedschaftEntfernen({
    handelndeUserId: input.handelndeUserId,
    zielUserId: mapped.userId,
    zielRolle: mapped.rolle,
    eigentuemerAnzahl,
  });
  await deleteRecord(COL, mapped.id);

  const user = await getUserById(mapped.userId);
  if (user?.firma === input.firmaId) {
    const rest = await listMitgliedschaftenFuerNutzer(mapped.userId);
    await updateRecord("users", mapped.userId, {
      firma: rest[0]?.firmaId ?? "",
    });
  }
}

export async function setzeNutzerPasswort(input: {
  handelndeUserId: string;
  zielUserId: string;
  password: string;
}): Promise<void> {
  assertFremdesPasswortZiel(input.handelndeUserId, input.zielUserId);
  const password = validateNeuesPasswort(input.password);
  const user = await getUserById(input.zielUserId);
  if (!user) {
    throw new Error("Nutzer:in nicht gefunden.");
  }
  await updateRecord("users", input.zielUserId, {
    password,
    passwordConfirm: password,
  });
}
