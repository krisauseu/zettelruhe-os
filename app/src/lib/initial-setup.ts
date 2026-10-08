/** Optional, instance-local completion of externally bootstrapped owner/company data. */
import { assertMutationOrigin, getInstanceContext, isCloud } from "./instance-context";
import { getAdminToken, type FirmaStammdatenInput } from "./pb";
import type { NummernkreisAenderungen } from "./finanz-transaktion";
import type { SessionPayload } from "./session-token";

export type InitialSetup = {
  id: string;
  eigentuemer: string;
  firma: string;
  status: "pending" | "complete";
};

export async function getInitialSetup(): Promise<InitialSetup | null> {
  if (!isCloud()) return null;
  const context = await getInstanceContext();
  const response = await fetch(`${context.pocketbaseUrl}/api/collections/instanz_einrichtung/records?perPage=2`, {
    headers: { Authorization: await getAdminToken() }, cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  // Older PocketBase schemas have no optional collection. New provisioning
  // requires it before creating customer records or publishing a ready tenant.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Ersteinrichtung nicht verfügbar.");
  const records = await response.json() as { items: InitialSetup[]; totalItems: number };
  if (!Array.isArray(records.items) || !Number.isSafeInteger(records.totalItems) ||
      records.totalItems !== records.items.length || records.totalItems > 1) {
    throw new Error("Ersteinrichtung nicht verfügbar.");
  }
  if (!records.items.length) return null;
  const state = records.items[0];
  if (records.items.length !== 1 || state.id !== "initialsetup001" ||
      typeof state.eigentuemer !== "string" || !state.eigentuemer ||
      typeof state.firma !== "string" || !state.firma || !["pending", "complete"].includes(state.status)) {
    throw new Error("Ersteinrichtung nicht verfügbar.");
  }
  return state;
}

export function assertInitialSetupOwner(state: InitialSetup, session: SessionPayload): void {
  if (state.eigentuemer !== session.userId || state.firma !== session.firmaId || session.role !== "eigentuemer") {
    throw new Error("Nur die erste Eigentümer:in kann die Ersteinrichtung abschließen.");
  }
}

export function validateOwnerName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 200) throw new Error("Bitte den Namen der Eigentümer:in angeben (max. 200 Zeichen).");
  return name;
}

export async function completeInitialSetup(
  session: SessionPayload,
  ownerName: string,
  input: FirmaStammdatenInput,
  nummernkreisAenderungen: NummernkreisAenderungen,
): Promise<void> {
  await assertMutationOrigin();
  const state = await getInitialSetup();
  if (!state) throw new Error("Ersteinrichtung nicht verfügbar.");
  assertInitialSetupOwner(state, session);
  const { logo, ...values } = input;
  const form = new FormData();
  form.set("payload", JSON.stringify({ akteur: session.userId, firma: session.firmaId,
    ownerName: validateOwnerName(ownerName), values, nummernkreisAenderungen }));
  if (logo) form.set("logo", logo, logo instanceof File ? logo.name : "logo.png");
  const context = await getInstanceContext();
  const response = await fetch(`${context.pocketbaseUrl}/internal/zettelruhe/einrichtung/v1/abschliessen`, {
    method: "POST", headers: { Authorization: await getAdminToken() }, body: form,
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Ersteinrichtung konnte nicht gespeichert werden. Bitte Angaben prüfen und erneut speichern.");
  const result = await response.json();
  if (!["committed", "replayed"].includes(result.result) || result.status !== "complete" ||
      result.firmaId !== session.firmaId || result.eigentuemerId !== session.userId) {
    throw new Error("Speicherergebnis unklar. Bitte die Ersteinrichtung erneut öffnen.");
  }
}
