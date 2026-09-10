import { finanzAkteur, rcStornieren } from "@/lib/finanz-transaktion";
import type { RcSnapshot } from "@/modules/expenses/reverse-charge";
import { assertRcFreigegeben } from "@/modules/expenses/reverse-charge";
/**
 * Persistenz Buchungsjournal über PocketBase (Superuser).
 * Writes nur Anlegen (+ Storno als neue Buchung). Kein Update/Delete (ADR-0004/0006).
 */

import {
  createRecord,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
} from "@/lib/pb";
import {
  assertImmutableWriteBlocked,
  buildStornoInput,
  festschreibungsZeitpunktUtc,
  todayBerlin,
  validateBuchungInput,
} from "./invariants";
import type {
  JournalBuchungInput,
  JournalEintrag,
  JournalFilter,
  JournalListResult,
  QuelleTyp,
  Buchungsrichtung,
  Steuersatz,
} from "./types";

const COL = "buchungsjournal";

type PbJournal = {
  rc?: JournalEintrag["rc"];
  rc_steuerdatum?: string;
  rc_vorgang?: string;
  id: string;
  firma: string;
  laufende_nr: number;
  buchungsdatum: string;
  belegdatum?: string;
  buchungstext: string;
  richtung: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz?: string;
  konto?: string;
  kontakt?: string;
  quelle_typ: string;
  quelle_id?: string;
  storno_von?: string;
  festgeschrieben_am: string;
  created?: string;
  updated?: string;
};

const VALID_RICHTUNG = new Set(["einnahme", "ausgabe"]);
const VALID_QUELLE = new Set([
  "manuell",
  "beleg",
  "rechnung",
  "zahlung",
  "kasse",
  "storno",
  "system",
]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

function mapEintrag(r: PbJournal): JournalEintrag {
  const richtung = VALID_RICHTUNG.has(r.richtung)
    ? (r.richtung as Buchungsrichtung)
    : "ausgabe";
  const quelle_typ = VALID_QUELLE.has(r.quelle_typ)
    ? (r.quelle_typ as QuelleTyp)
    : "manuell";
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";

  return {
    ...(r.rc ? { rc: r.rc, rc_steuerdatum: r.rc_steuerdatum || "", rc_vorgang: r.rc_vorgang || "" } : {}),
    id: r.id,
    firma: r.firma,
    laufende_nr: Number(r.laufende_nr),
    buchungsdatum: r.buchungsdatum,
    belegdatum: r.belegdatum ?? "",
    buchungstext: r.buchungstext,
    richtung,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuersatz,
    konto: r.konto ?? "",
    kontakt: r.kontakt || null,
    quelle_typ,
    quelle_id: r.quelle_id ?? "",
    storno_von: r.storno_von || null,
    festgeschrieben_am: r.festgeschrieben_am,
    created: r.created,
    updated: r.updated,
  };
}

/** Nächste fortlaufende Nr. je Firma (max + 1; Solo-Betrieb, kein verteilter Lock) */
async function nextLaufendeNr(firmaId: string): Promise<number> {
  const result = await listRecords<PbJournal>(COL, {
    page: 1,
    perPage: 1,
    filter: pbEq("firma", firmaId),
    sort: "-laufende_nr",
    fields: "id,laufende_nr",
  });
  if (result.totalItems === 0 || result.items.length === 0) {
    return 1;
  }
  return Number(result.items[0].laufende_nr) + 1;
}

/**
 * Festschreiben: neuen Journal-Eintrag anlegen.
 * Es gibt keinen Entwurf — create = Festschreibung.
 */
export async function festschreibenBuchung(
  firmaId: string,
  input: JournalBuchungInput,
  opts?: { now?: Date },
): Promise<JournalEintrag> {
  const validated = validateBuchungInput(input);
  const now = opts?.now ?? new Date();
  const laufende_nr = await nextLaufendeNr(firmaId);

  const body: Record<string, unknown> = {
    firma: firmaId,
    laufende_nr,
    buchungsdatum: validated.buchungsdatum,
    belegdatum: validated.belegdatum || null,
    buchungstext: validated.buchungstext,
    richtung: validated.richtung,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuersatz: validated.steuersatz || null,
    konto: validated.konto || "",
    quelle_typ: validated.quelle_typ,
    quelle_id: validated.quelle_id || "",
    festgeschrieben_am: festschreibungsZeitpunktUtc(now),
  };

  if (validated.kontakt) {
    body.kontakt = validated.kontakt;
  }
  if (validated.storno_von) {
    body.storno_von = validated.storno_von;
  }

  const r = await createRecord<PbJournal>(COL, body);
  return mapEintrag(r);
}

/**
 * Storno/Gegenbuchung: legt einen neuen Eintrag an, der den bestehenden storniert.
 * Original bleibt unverändert (append-only).
 */
export async function storniereBuchung(
  firmaId: string,
  eintragId: string,
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date; akteur?: string; rc_korrektur?: Omit<NonNullable<RcSnapshot["korrektur"]>, "original"> },
): Promise<JournalEintrag> {
  const original = await getJournalEintrag(firmaId, eintragId);
  if (!original) {
    throw new Error("Journal-Eintrag nicht gefunden.");
  }
  if (original.rc) {
    assertRcFreigegeben();
    if (!opts?.rc_korrektur) throw new Error("RC-Korrekturen benötigen einen ausdrücklichen steuerlichen Korrekturgrund.");
    const expected: Record<string, unknown> = {};
    for (const k of ["firma", "quelle_typ", "quelle_id", "storno_von", "buchungsdatum", "belegdatum", "buchungstext", "richtung", "betrag_netto", "betrag_ust", "betrag_brutto", "steuersatz", "konto", "kontakt", "festgeschrieben_am", "rc_steuerdatum", "rc_vorgang"] as const) expected[k] = original[k] || "";
    expected.rc = original.rc;
    expected.laufende_nr = original.laufende_nr;
    const result = await rcStornieren<{ result: string; journal: PbJournal }>({ firma: firmaId, akteur: await finanzAkteur(firmaId, opts.akteur), id: original.id, expected, korrektur: opts.rc_korrektur });
    return mapEintrag(result.journal);
  }
  if (original.quelle_typ === "rechnung" && original.quelle_id) {
    const { storniereRechnung } = await import("@/modules/sales/repository");
    const result = await storniereRechnung(firmaId, original.quelle_id, opts);
    if (!result.journal) throw new Error("Storno-Journal fehlt.");
    return result.journal;
  }
  if (original.quelle_typ === "zahlung" && original.quelle_id) {
    const { deleteZahlung } = await import("@/modules/payments/repository");
    await deleteZahlung(firmaId, original.quelle_id, opts);
    const reversal = await findStornoFuer(firmaId, original.id);
    if (!reversal) throw new Error("Storno-Journal fehlt.");
    return reversal;
  }
  if (original.quelle_typ === "storno" || original.storno_von) {
    throw new Error("Eine Storno-Buchung kann nicht erneut storniert werden.");
  }

  const existingStorno = await findStornoFuer(firmaId, eintragId);
  if (existingStorno) {
    throw new Error(
      `Eintrag bereits storniert (Gegenbuchung Nr. ${existingStorno.laufende_nr}).`,
    );
  }

  const stornoInput = buildStornoInput(
    {
      id: original.id,
      buchungsdatum: original.buchungsdatum,
      buchungstext: original.buchungstext,
      richtung: original.richtung,
      betrag_netto: original.betrag_netto,
      betrag_ust: original.betrag_ust,
      betrag_brutto: original.betrag_brutto,
      steuersatz: original.steuersatz,
      konto: original.konto,
      kontakt: original.kontakt,
    },
    {
      buchungsdatum: opts?.buchungsdatum,
      buchungstext: opts?.buchungstext,
    },
  );

  // Laufende Nr. im Text der Lesbarkeit
  stornoInput.buchungstext =
    opts?.buchungstext?.trim() ||
    `Storno zu Journal-Nr. ${original.laufende_nr}: ${original.buchungstext}`.slice(
      0,
      500,
    );

  return festschreibenBuchung(firmaId, stornoInput, { now: opts?.now });
}

/** Findet die Gegenbuchung zu einem Eintrag (falls vorhanden). */
export async function findStornoFuer(
  firmaId: string,
  originalId: string,
): Promise<JournalEintrag | null> {
  const result = await listRecords<PbJournal>(COL, {
    page: 1,
    perPage: 1,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("storno_von", originalId)}`,
    sort: "laufende_nr",
  });
  if (result.items.length === 0) return null;
  return mapEintrag(result.items[0]);
}

export async function getJournalEintrag(
  firmaId: string,
  id: string,
): Promise<JournalEintrag | null> {
  try {
    const r = await getRecord<PbJournal>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapEintrag(r);
  } catch {
    return null;
  }
}

/** Journal-Zeilen einer Quelle (z. B. alle Staffel-Zeilen einer Zahlung). */
export async function listJournalByQuelle(
  firmaId: string,
  quelle_typ: QuelleTyp,
  quelle_id: string,
): Promise<JournalEintrag[]> {
  const id = quelle_id.trim();
  if (!id || !VALID_QUELLE.has(quelle_typ)) return [];

  const result = await listRecords<PbJournal>(COL, {
    page: 1,
    perPage: 50,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("quelle_typ", quelle_typ)} && ${pbEq("quelle_id", id)}`,
    sort: "laufende_nr",
  });
  return result.items.map(mapEintrag);
}

export async function listJournal(
  firmaId: string,
  filter: JournalFilter = {},
  page = 1,
  perPage = 50,
): Promise<JournalListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.richtung === "einnahme" || filter.richtung === "ausgabe") {
    parts.push(pbEq("richtung", filter.richtung));
  }

  if (
    filter.quelle_typ &&
    VALID_QUELLE.has(filter.quelle_typ)
  ) {
    parts.push(pbEq("quelle_typ", filter.quelle_typ));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`buchungsdatum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`buchungsdatum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("buchungstext", q)} || ${pbLike("konto", q)} || ${pbLike("quelle_id", q)})`,
    );
  }

  const result = await listRecords<PbJournal>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "-buchungsdatum,-laufende_nr",
  });

  return {
    items: result.items.map(mapEintrag),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/**
 * RC-Zeilen nach ihrem gespeicherten steuerlichen Datum.
 * Bewusst getrennt von `listJournal`: das Buchungsdatum bleibt Geld-/EÜR-Datum.
 */
export async function listRcJournal(
  firmaId: string,
  zeitraum: { von: string; bis: string },
  page = 1,
  perPage = 50,
): Promise<JournalListResult> {
  const von = zeitraum.von.trim().replace(/"/g, "");
  const bis = zeitraum.bis.trim().replace(/"/g, "");
  const result = await listRecords<PbJournal>(COL, {
    page,
    perPage,
    filter: [
      pbEq("firma", firmaId),
      `rc_steuerdatum >= "${von}"`,
      `rc_steuerdatum <= "${bis}"`,
    ].join(" && "),
    sort: "-rc_steuerdatum,-laufende_nr",
  });

  return {
    items: result.items.map(mapEintrag),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/**
 * Bewusst blockierte Mutationen — auch bei Superuser-Pfad nicht freigeben.
 * GoBD: keine stillen Änderungen/Löschungen.
 */
export async function updateJournalEintrag(): Promise<never> {
  assertImmutableWriteBlocked("update");
}

export async function deleteJournalEintrag(): Promise<never> {
  assertImmutableWriteBlocked("delete");
}

export { todayBerlin };
