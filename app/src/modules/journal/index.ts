/**
 * Modul: journal — Buchungsjournal (unveränderbare Buchungsgrundlage)
 * Bauabschnitt 3: Kern (Festschreibung, Storno-Modell, Liste/Detail)
 */

export const MODULE_ID = "journal" as const;

export type {
  Buchungsrichtung,
  JournalBuchungInput,
  JournalEintrag,
  JournalFilter,
  JournalListResult,
  QuelleTyp,
  Steuersatz,
} from "./types";

export {
  assertImmutableWriteBlocked,
  buildStornoInput,
  festschreibungsZeitpunktUtc,
  IMMUTABLE_ERROR,
  invertRichtung,
  isValidIsoDate,
  normalizeBetragInput,
  normalizeBetraege,
  todayBerlin,
  validateBuchungInput,
} from "./invariants";

export {
  deleteJournalEintrag,
  festschreibenBuchung,
  findStornoFuer,
  getJournalEintrag,
  listJournal,
  listJournalByQuelle,
  storniereBuchung,
  updateJournalEintrag,
} from "./repository";

export {
  festschreibenManuelleBuchungAction,
  storniereBuchungAction,
} from "./actions";
