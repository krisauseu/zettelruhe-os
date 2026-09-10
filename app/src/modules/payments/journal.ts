import { finanzSystemAkteur, releaseOperation } from "@/lib/finanz-transaktion";
/**
 * Zahlungsjournal (ADR-0024): Zufluss bei Zahlung, append-only.
 * Forderungsbuchung der Rechnung bleibt bei Festschreibung unangetastet.
 */

import { money } from "@/lib/money";
import {
  findStornoFuer,
  listJournalByQuelle,
  storniereBuchung,
} from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import { sumZahlungen } from "./invariants";
import type { Zahlung } from "./types";

export async function listZahlungsjournal(
  firmaId: string,
  zahlungId: string,
): Promise<JournalEintrag[]> {
  return listJournalByQuelle(firmaId, "zahlung", zahlungId);
}

/** Bereits festgeschriebene, nicht stornierte Zahlungszeilen. */
export async function listAktiveZahlungsjournale(
  firmaId: string,
  zahlungId: string,
): Promise<JournalEintrag[]> {
  const items = await listJournalByQuelle(firmaId, "zahlung", zahlungId);
  const aktiv: JournalEintrag[] = [];
  for (const e of items) {
    const storno = await findStornoFuer(firmaId, e.id);
    if (!storno) aktiv.push(e);
  }
  return aktiv;
}

export function istVollstaendigBezahlt(
  betragBrutto: string,
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): boolean {
  return money(sumZahlungen(zahlungen)).gte(money(betragBrutto));
}

/**
 * Schreibt Journal-Zeilen zur Zahlung, falls noch keine existieren (idempotent).
 * `bereits` = aktive Zeilen der anderen Zahlungen derselben Rechnung.
 */
export async function ensureZahlungJournal(
  firmaId: string,
  zahlung: Zahlung,
  opts: {
    bereits?: JournalEintrag[];
    vollstaendig?: boolean;
    now?: Date;
  } = {},
): Promise<JournalEintrag[]> {
  void opts;
  await releaseOperation("zahlung/nachziehen", { firma: firmaId, id: zahlung.rechnung, akteur: await finanzSystemAkteur(firmaId) }, true);
  return listZahlungsjournal(firmaId, zahlung.id);
}

/** Gegenbuchung zu allen Zahlungsjournal-Zeilen (idempotent je Zeile). */
export async function storniereZahlungsjournal(
  firmaId: string,
  zahlungId: string,
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date },
): Promise<JournalEintrag[]> {
  const items = await listJournalByQuelle(firmaId, "zahlung", zahlungId);
  const stornos: JournalEintrag[] = [];
  for (const e of items) {
    const already = await findStornoFuer(firmaId, e.id);
    if (already) {
      stornos.push(already);
      continue;
    }
    stornos.push(
      await storniereBuchung(firmaId, e.id, {
        buchungsdatum: opts?.buchungsdatum,
        buchungstext: opts?.buchungstext,
        now: opts?.now,
      }),
    );
  }
  return stornos;
}

export async function storniereZahlungsjournaleFuerRechnung(
  firmaId: string,
  zahlungen: Zahlung[],
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date },
): Promise<JournalEintrag[]> {
  const all: JournalEintrag[] = [];
  for (const z of zahlungen) {
    const rows = await storniereZahlungsjournal(firmaId, z.id, opts);
    all.push(...rows);
  }
  return all;
}

/** The invoice is the serialization boundary, including read-triggered historical backfill. */
export async function ensureZahlungsjournaleFuerRechnung(
  firmaId: string, rechnungId: string, zahlungen: Zahlung[], betragBrutto: string, opts?: { now?: Date },
): Promise<number> {
  void zahlungen; void betragBrutto; void opts;
  const result = await releaseOperation<{ geschrieben: number }>("zahlung/nachziehen", {
    firma: firmaId, id: rechnungId, akteur: await finanzSystemAkteur(firmaId),
  }, true);
  return result.geschrieben;
}
