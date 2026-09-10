/**
 * Modul: travel — Fahrten
 * Bauabschnitt 7: manuelle Erfassung, Default abrechenbar, optional → Rechnung
 */

export const MODULE_ID = "travel" as const;

export type {
  Abrechnungsstatus,
  Fahrt,
  FahrtFilter,
  FahrtInput,
  FahrtListResult,
} from "./types";

export {
  ABGERECHNET_FAHRT_ERROR,
  assertCanChangeFahrtStatus,
  assertFahrtEditable,
  buildRechnungspositionFromFahrt,
  estimateNettoFahrt,
  formatKmDe,
  isFahrtAbgerechnet,
  isValidIsoDate,
  normalizeKm,
  parseAbrechnungsstatus,
  todayBerlin,
  validateFahrtInput,
  VALID_ABRECHNUNGSSTATUS,
} from "./invariants";
export type { ValidatedFahrtInput } from "./invariants";

export {
  createFahrt,
  deleteFahrt,
  getFahrt,
  listAbrechenbareFahrten,
  listFahrten,
  markFahrtenAbgerechnet,
  setFahrtStatus,
  updateFahrt,
} from "./repository";

export {
  createFahrtAction,
  deleteFahrtAction,
  setFahrtStatusAction,
  updateFahrtAction,
} from "./actions";
