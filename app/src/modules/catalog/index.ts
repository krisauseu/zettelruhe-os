/**
 * Modul: catalog — Produkt- & Leistungskatalog
 */

export const MODULE_ID = "catalog" as const;

export { KATALOG_EINHEITEN, einheitOptionen } from "./einheiten";

export type {
  KatalogFilter,
  KatalogListResult,
  KatalogPosition,
  KatalogPositionInput,
  Steuersatz,
} from "./types";

export {
  createKatalogPosition,
  deleteKatalogPosition,
  getKatalogPosition,
  listAllKatalog,
  listKatalog,
  normalizePreisInput,
  updateKatalogPosition,
} from "./repository";

export {
  katalogCsvTemplate,
  parseKatalogCsv,
  serializeKatalogCsv,
  KATALOG_CSV_HEADERS,
} from "./csv";

export {
  createKatalogAction,
  deleteKatalogAction,
  importKatalogAction,
  updateKatalogAction,
} from "./actions";
