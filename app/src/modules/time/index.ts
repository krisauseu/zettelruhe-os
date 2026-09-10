/**
 * Modul: time — Zeiteinträge
 * Bauabschnitt 7: manuelle Erfassung, Status abrechenbar, optional → Rechnung
 */

export const MODULE_ID = "time" as const;

export type {
  Abrechnungsstatus,
  Zeiteintrag,
  ZeiteintragFilter,
  ZeiteintragInput,
  ZeiteintragListResult,
} from "./types";

export {
  ABGERECHNET_ERROR,
  assertCanChangeStatus,
  assertEditable,
  buildRechnungspositionFromZeit,
  dauerMinutenToDezimalStunden,
  estimateNettoZeit,
  formatDauerDe,
  isAbgerechnet,
  isValidIsoDate,
  normalizeDauerMinuten,
  normalizeOptionalSatz,
  parseAbrechnungsstatus,
  parseDecimalInput,
  splitDauerMinuten,
  todayBerlin,
  validateZeiteintragInput,
  VALID_ABRECHNUNGSSTATUS,
} from "./invariants";
export type { ValidatedZeiteintragInput } from "./invariants";

export {
  createZeiteintrag,
  deleteZeiteintrag,
  getZeiteintrag,
  listAbrechenbareZeiteintraege,
  listZeiteintraege,
  markZeiteintraegeAbgerechnet,
  setZeiteintragStatus,
  updateZeiteintrag,
} from "./repository";

export {
  createZeiteintragAction,
  deleteZeiteintragAction,
  setZeiteintragStatusAction,
  updateZeiteintragAction,
} from "./actions";

export { uebernehmenAlsRechnung } from "./uebernahme";
export type { UebernahmeErgebnis } from "./uebernahme";
export { uebernehmenZeitenFahrtenAlsRechnungAction } from "./uebernahme-actions";
