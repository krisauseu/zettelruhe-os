/** Fixed service operations; source ID is the durable idempotency key for closing a receipt. */
import { randomBytes } from "node:crypto";
import { getAdminToken, listRecords, pbEq } from "./pb";
import type { NummernkreisConfig, Nummernkreise } from "./pb";
import type { Beleg } from "@/modules/expenses/types";

export type FinanzCode = "RC_DISABLED" | "RC_INVALID" | "RC_MODE_CHANGED" | "RC_DUPLICATE" | "SOURCE_CHANGED" | "NUMBER_CHANGED" | "INVALID_STATE" | "INCONSISTENT_STATE" | "FORBIDDEN" | "NOT_FOUND" | "MUTATION_FORBIDDEN" | "NUMBER_EXHAUSTED" | "NEGATIVE_BALANCE" | "OPERATION_UNAVAILABLE" | "COMMIT_UNKNOWN";
export class FinanzFehler extends Error {
  constructor(public readonly code: FinanzCode, detail?: string) {
    super(code === "RC_INVALID" && detail ? detail : { RC_DISABLED: "Reverse Charge ist bis zur vollständigen Abnahme noch nicht freigegeben.", RC_INVALID: "RC-Angaben sind ungültig. Bitte prüfen.", RC_MODE_CHANGED: "Der Steuer-Modus der Firma wurde geändert. RC-Angaben neu prüfen; der Abzug wurde nicht still geändert.", RC_DUPLICATE: "Dieser RC-Vorgang wurde bereits festgeschrieben. Voraus- und Schlussrechnung dürfen nicht erneut besteuert werden.", SOURCE_CHANGED: "Der Datenstand wurde geändert. Bitte neu laden.", NUMBER_CHANGED: "Nummernkreis wurde geändert. Bitte neu laden.", INVALID_STATE: "Ungültiger Zustand.", INCONSISTENT_STATE: "Unvollständiger Abschluss. Bestand prüfen; keine erneute Buchung.", FORBIDDEN: "Keine Schreibberechtigung für diese Firma.", NOT_FOUND: "Datensatz, Firma oder Akteur nicht gefunden.", MUTATION_FORBIDDEN: "Änderung nur über die Finanzoperation erlaubt.", NUMBER_EXHAUSTED: "Keine freie Nummer im Nummernkreis gefunden.", NEGATIVE_BALANCE: "Der Kassensaldo darf nicht negativ werden. Bitte Betrag oder Richtung prüfen bzw. zuerst eine Bareinnahme erfassen.", OPERATION_UNAVAILABLE: "PocketBase-Finanzoperation nicht verfügbar. Installation prüfen.", COMMIT_UNKNOWN: "Ausgang noch unklar. Denselben Vorgang erneut aufrufen; keinen neuen Datensatz anlegen." }[code]);
  }
}
export type BelegQuittung = {
  result: "committed" | "replayed";
  belegId: string;
  belegnummer: string;
  journalId: string;
  journalnummer: number;
  festgeschriebenAm: string;
};
export type RechnungQuittung = {
  result: "committed" | "replayed";
  rechnungId: string;
  rechnungsnummer: string;
  journalId: string;
  journalnummer: number;
  festgeschriebenAm: string;
  pdfDateiname: string;
};
export type KasseQuittung = {
  result: "committed" | "replayed";
  eintragId: string;
  belegnummer: string;
  journalId: string;
  journalnummer: number;
  festgeschriebenAm: string;
};
export type KasseStornoQuittung = KasseQuittung & { originalId: string };
const codes = new Set<FinanzCode>(["RC_DISABLED", "RC_INVALID", "RC_MODE_CHANGED", "RC_DUPLICATE","SOURCE_CHANGED", "NUMBER_CHANGED", "INVALID_STATE", "INCONSISTENT_STATE", "FORBIDDEN", "NOT_FOUND", "MUTATION_FORBIDDEN", "NUMBER_EXHAUSTED", "NEGATIVE_BALANCE"]);

export function neueFinanzRecordId(): string {
  return randomBytes(8).toString("hex").slice(0, 15);
}

async function request<T>(path: string, body: string | FormData): Promise<T> {
  const url = process.env.PB_URL;
  if (!url) throw new Error("PB_URL ist nicht gesetzt.");
  const token = await getAdminToken();
  const response = await fetch(`${url.replace(/\/$/, "")}/internal/zettelruhe/finanz/v1/${path}`, {
    method: "POST", cache: "no-store", headers: { Authorization: token, ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) }, body,
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) throw new FinanzFehler("OPERATION_UNAVAILABLE");
  if (response.status === 401 || response.status === 403) throw new FinanzFehler("FORBIDDEN");
  const value = await response.json();
  if (!response.ok) {
    const code = value.data?.finanz?.code;
    if (codes.has(code)) throw new FinanzFehler(code, value.data?.finanz?.message);
    throw new FinanzFehler("COMMIT_UNKNOWN");
  }
  return value as T;
}
export async function finanzAkteur(firma: string, akteur?: string): Promise<string> {
  if (akteur) return akteur; // Server-internal callers/tests; never copied from FormData.
  const { requireSchreibenSession } = await import("./session");
  const session = await requireSchreibenSession();
  if (session.firmaId !== firma) throw new FinanzFehler("FORBIDDEN");
  return session.userId;
}
/** Akteur für den bestehenden internen Scheduler ohne Browser-Session. */
export async function finanzSystemAkteur(firma: string): Promise<string> {
  const result = await listRecords<{ user: string }>("mitgliedschaften", {
    page: 1,
    perPage: 1,
    filter: `${pbEq("firma", firma)} && rolle = "eigentuemer"`,
    sort: "id",
    fields: "user",
  });
  const akteur = result.items[0]?.user;
  if (!akteur) throw new FinanzFehler("FORBIDDEN");
  return akteur;
}
export function belegProjektion(b: Beleg): Record<string, unknown> {
  return { ...(b.rc ? { rc: b.rc } : {}), belegdatum: b.belegdatum, buchungsdatum: b.buchungsdatum, richtung: b.richtung,
    betrag_netto: b.betrag_netto, betrag_ust: b.betrag_ust, betrag_brutto: b.betrag_brutto,
    steuersatz: b.steuersatz, lieferant: b.lieferant || "", kunde: b.kunde || "",
    kategorie: b.kategorie, notiz: b.notiz, konto: b.konto, datei: [...b.datei].sort() };
}
export async function belegFestschreiben<T extends BelegQuittung>(input: { firma: string; akteur: string; id: string; expected: ReturnType<typeof belegProjektion> }): Promise<T> {
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await request<T>("beleg/festschreiben", body);
      if (!["committed", "replayed"].includes(result.result) || result.belegId !== input.id || !result.belegnummer || !result.journalId || !result.festgeschriebenAm || !Number.isInteger(result.journalnummer)) throw new FinanzFehler("COMMIT_UNKNOWN");
      return result;
    } catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") throw error;
      // Retry exactly the same source and projection. PB serializes with any still-running first request.
      if (attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}
export async function belegEntwurfSchreiben<T>(input: {
  firma: string; akteur: string; id: string; expected: ReturnType<typeof belegProjektion>;
  operation?: "delete"; values?: Record<string, unknown>; remove?: string[];
}, files: Array<File | Blob> = []): Promise<T> {
  const body = new FormData();
  body.set("payload", JSON.stringify(input));
  files.forEach(f => body.append("datei", f, f instanceof File ? f.name : "beleg.bin"));
  // No automatic retry for uploads/deletes, which don't have a durable operation key.
  try { return await request<T>("beleg/entwurf", body); }
  catch (e) { if (e instanceof FinanzFehler) throw e; throw new FinanzFehler("COMMIT_UNKNOWN"); }
}

export async function rechnungEntwurfSchreiben<T>(input: {
  firma: string;
  akteur: string;
  operation: "create" | "update" | "delete";
  id?: string;
  expected?: Record<string, unknown>;
  values?: Record<string, unknown>;
  positionen?: Array<Record<string, unknown>>;
}): Promise<T> {
  try {
    return await request<T>("rechnung/entwurf", JSON.stringify(input));
  } catch (error) {
    if (error instanceof FinanzFehler) throw error;
    throw new FinanzFehler("COMMIT_UNKNOWN");
  }
}

function pruefeRechnungQuittung(
  result: RechnungQuittung,
  id: string,
): void {
  if (
    !["committed", "replayed"].includes(result.result) ||
    result.rechnungId !== id ||
    !result.rechnungsnummer ||
    !result.journalId ||
    !result.festgeschriebenAm ||
    !result.pdfDateiname ||
    !Number.isInteger(result.journalnummer) ||
    result.journalnummer < 1
  ) {
    throw new FinanzFehler("COMMIT_UNKNOWN");
  }
}

export async function rechnungFestschreiben<
  T extends RechnungQuittung,
>(input: {
  firma: string;
  akteur: string;
  id: string;
  nummer: string;
  expected: Record<string, unknown>;
  journal: Record<string, unknown>;
  pdfBytes?: Uint8Array;
}): Promise<T> {
  const payload = JSON.stringify({
    firma: input.firma,
    akteur: input.akteur,
    id: input.id,
    nummer: input.nummer,
    expected: input.expected,
    journal: input.journal,
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = new FormData();
    body.set("payload", payload);
    if (input.pdfBytes) {
      const pdfCopy = new Uint8Array(input.pdfBytes.byteLength);
      pdfCopy.set(input.pdfBytes);
      body.set(
        "pdf",
        new File([pdfCopy.buffer], `${input.nummer}.pdf`, {
          type: "application/pdf",
        }),
      );
    }
    try {
      const result = await request<T>("rechnung/festschreiben", body);
      pruefeRechnungQuittung(result, input.id);
      return result;
    } catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") {
        throw error;
      }
      if (attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}

function pruefeKasseQuittung(
  result: KasseQuittung,
  erwarteteEintragId?: string,
): void {
  if (
    !["committed", "replayed"].includes(result.result) ||
    !result.eintragId ||
    (erwarteteEintragId !== undefined &&
      result.eintragId !== erwarteteEintragId) ||
    !result.belegnummer ||
    !result.journalId ||
    !result.festgeschriebenAm ||
    !Number.isInteger(result.journalnummer) ||
    result.journalnummer < 1
  ) {
    throw new FinanzFehler("COMMIT_UNKNOWN");
  }
}

export async function kasseFestschreiben<T extends KasseQuittung>(input: {
  firma: string;
  akteur: string;
  id: string;
  values: Record<string, unknown>;
}): Promise<T> {
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await request<T>("kasse/festschreiben", body);
      pruefeKasseQuittung(result, input.id);
      return result;
    } catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") {
        throw error;
      }
      if (attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}

export async function kasseStornieren<T extends KasseStornoQuittung>(input: {
  firma: string;
  akteur: string;
  id: string;
  expected: Record<string, unknown>;
  values: Record<string, unknown>;
}): Promise<T> {
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await request<T>("kasse/stornieren", body);
      pruefeKasseQuittung(result);
      if (result.originalId !== input.id) throw new FinanzFehler("COMMIT_UNKNOWN");
      return result;
    } catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") {
        throw error;
      }
      if (attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}
export async function nummernkreisVergeben(firma: string, key: keyof Nummernkreise): Promise<string> {
  // Transitional allocator commits only a counter. Never retry an unknown result automatically.
  return (await request<{ nummer: string }>("nummernkreis/vergeben", JSON.stringify({ firma, key }))).nummer;
}
export type NummernkreisAenderungen = Partial<Record<keyof Nummernkreise, { expected: NummernkreisConfig; value: NummernkreisConfig }>>;
export async function nummernkreiseKonfigurieren(firma: string, akteur: string, changes: NummernkreisAenderungen): Promise<void> {
  if (!Object.keys(changes).length) return;
  await request("nummernkreis/konfigurieren", JSON.stringify({ firma, akteur, changes }));
}

/** Full RC reversal only; the payload is reused verbatim after a lost response. */
export async function rcStornieren<T>(input: { firma: string; akteur: string; id: string; expected: Record<string, unknown>; korrektur: { art: "erfassungsfehler" | "vollstaendige_rueckzahlung"; datum: string; nachweis: string } }): Promise<T> {
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await request<T & { result: string; journal: { id: string; firma: string; storno_von: string; festgeschrieben_am: string } }>("beleg/rc-stornieren", body);
      if (!["committed", "replayed"].includes(result.result) || !result.journal?.id || result.journal.firma !== input.firma || result.journal.storno_von !== input.id || !result.journal.festgeschrieben_am) throw new FinanzFehler("COMMIT_UNKNOWN");
      return result;
    }
    catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") throw error;
      if (attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}

/** Fixed release operations, retry only when the caller provides a durable identity. */
export async function releaseOperation<T>(path: string, input: Record<string, unknown>, replayable = false): Promise<T> {
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < (replayable ? 2 : 1); attempt++) {
    try { return await request<T>(path, body); }
    catch (error) {
      if (error instanceof FinanzFehler && error.code !== "COMMIT_UNKNOWN") throw error;
      if (!replayable || attempt === 1) throw new FinanzFehler("COMMIT_UNKNOWN");
    }
  }
  throw new FinanzFehler("COMMIT_UNKNOWN");
}
