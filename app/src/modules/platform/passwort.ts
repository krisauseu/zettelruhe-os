/**
 * Eigenes Passwort ändern (Nachzug ADR-0025).
 * Altes Passwort gegen PocketBase-Auth; Schreiben über Superuser (ADR-0006).
 * Die Next-Session bleibt gültig (ADR-0009, Cookie unabhängig vom PB-Hash).
 */

import { authWithPassword, updateRecord } from "@/lib/pb";
import {
  FALSCHES_ALTES_PASSWORT_ERROR,
  validateEigenesPasswortAendern,
} from "./rechte";

export type PasswortPruefung = (email: string, password: string) => Promise<{
  id: string;
}>;

export type PasswortSetzen = (
  userId: string,
  password: string,
) => Promise<void>;

async function setzePasswortSuperuser(
  userId: string,
  password: string,
): Promise<void> {
  await updateRecord("users", userId, {
    password,
    passwordConfirm: password,
  });
}

export async function aendereEigenesPasswort(
  input: {
    userId: string;
    email: string;
    altesPasswort: string;
    neuesPasswort: string;
    neuesPasswortConfirm: string;
  },
  deps?: {
    pruefePasswort?: PasswortPruefung;
    setzePasswort?: PasswortSetzen;
  },
): Promise<void> {
  const parsed = validateEigenesPasswortAendern({
    altesPasswort: input.altesPasswort,
    neuesPasswort: input.neuesPasswort,
    neuesPasswortConfirm: input.neuesPasswortConfirm,
  });

  const pruefe = deps?.pruefePasswort ?? authWithPassword;
  const setze = deps?.setzePasswort ?? setzePasswortSuperuser;

  let authUser: { id: string };
  try {
    authUser = await pruefe(input.email, parsed.altesPasswort);
  } catch {
    throw new Error(FALSCHES_ALTES_PASSWORT_ERROR);
  }
  if (authUser.id !== input.userId) {
    throw new Error(FALSCHES_ALTES_PASSWORT_ERROR);
  }

  await setze(input.userId, parsed.neuesPasswort);
}
