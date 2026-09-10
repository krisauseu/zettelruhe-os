/**
 * Modul: categories — gemeinsame Kategorien für Belege und Kassenbuch
 */

export const MODULE_ID = "categories" as const;

export type {
  Buchungsrichtung,
  Kategorie,
  KategorieFilter,
  KategorieInput,
  KategorieListResult,
  KategorieSelectItem,
  KategorieVerwendung,
} from "./types";

export {
  KATEGORIE_IN_VERWENDUNG_ERROR,
  KATEGORIE_NAME_DOPPELT_ERROR,
  KATEGORIE_NAME_MAX,
  KATEGORIE_RICHTUNG_MISMATCH_ERROR,
  assertKategoriePasstZurRichtung,
  kategorieNameKey,
  kategorieNamenFuerSelect,
  kategorieSelectItemsFromStammdaten,
  kategorieSelectItemsMitSchnappschuss,
  kategorienFuerRichtung,
  normalizeKategorieName,
  parseKategorieRichtung,
  validateKategorieInput,
} from "./invariants";

export {
  assertKategorieNamePasstZurRichtung,
  countKategorieVerwendung,
  createKategorie,
  deleteKategorie,
  findKategorieByName,
  getKategorie,
  listAllKategorien,
  listKategorien,
  updateKategorie,
} from "./repository";

export {
  createKategorieAction,
  deleteKategorieAction,
  updateKategorieAction,
} from "./actions";
