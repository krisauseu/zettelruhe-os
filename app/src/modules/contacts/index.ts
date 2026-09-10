/**
 * Modul: contacts — Kontakte (Kund:innen & Lieferant:innen)
 */

export const MODULE_ID = "contacts" as const;

export type {
  Ansprechpartner,
  AnsprechpartnerInput,
  Kontakt,
  KontaktFilter,
  KontaktInput,
  KontaktListResult,
} from "./types";

export {
  createAnsprechpartner,
  createKontakt,
  deleteAnsprechpartner,
  deleteKontakt,
  getKontakt,
  listAllAnsprechpartner,
  listAllKontakte,
  listAnsprechpartner,
  listKontakte,
  updateKontakt,
} from "./repository";

export {
  kontakteCsvTemplate,
  parseKontakteCsv,
  serializeKontakteCsv,
  KONTAKTE_CSV_HEADERS,
} from "./csv";

export {
  createAnsprechpartnerAction,
  createKontaktAction,
  deleteAnsprechpartnerAction,
  deleteKontaktAction,
  importKontakteAction,
  updateKontaktAction,
} from "./actions";
