/**
 * Multi-Firma dünn: Anlegen und Wechseln (ohne Redirect).
 * Genutzt von Server Actions und Route-Handlern (Caddy-taugliche POSTs).
 */

import {
  createFirma,
  getFirmaById,
  type FirmaRecord,
} from "@/lib/pb";
import { activateFirma, type SessionPayload } from "@/lib/session";
import {
  FIRMA_NAME_DOPPELT_ERROR,
  isDuplicateFirmaNameError,
  validateFirmaWechselZiel,
  type NeueFirmaInput,
} from "./firma-invariants";
import { createMitgliedschaft, getMitgliedschaft } from "./mitgliedschaft";
import {
  KEIN_FIRMA_ZUGANG_ERROR,
  KEINE_FIRMA_ANLEGEN_ERROR,
  istInstanzEigentuemer,
} from "./rechte";

export async function createAndActivateFirma(
  session: SessionPayload,
  input: NeueFirmaInput,
): Promise<FirmaRecord> {
  if (!istInstanzEigentuemer(session.role)) {
    throw new Error(KEINE_FIRMA_ANLEGEN_ERROR);
  }
  try {
    const created = await createFirma(input);
    const schon = await getMitgliedschaft(session.userId, created.id);
    if (!schon) {
      await createMitgliedschaft({
        userId: session.userId,
        firmaId: created.id,
        rolle: "eigentuemer",
      });
    }
    await activateFirma(session, created.id);
    return created;
  } catch (e) {
    if (isDuplicateFirmaNameError(e)) {
      throw new Error(FIRMA_NAME_DOPPELT_ERROR);
    }
    throw e;
  }
}

export async function switchActiveFirma(
  session: SessionPayload,
  rawFirmaId: string,
): Promise<FirmaRecord> {
  const firmaId = validateFirmaWechselZiel(rawFirmaId);
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const mitgliedschaft = await getMitgliedschaft(session.userId, firma.id);
  if (!mitgliedschaft) {
    throw new Error(KEIN_FIRMA_ZUGANG_ERROR);
  }
  if (session.firmaId !== firma.id) {
    await activateFirma(session, firma.id);
  }
  return firma;
}
