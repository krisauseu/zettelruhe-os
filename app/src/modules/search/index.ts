/**
 * Modul: search — Volltextsuche light (BA14)
 * Kontakte, Rechnungen, Belege, Angebote über bestehende Listen-Filter.
 */

export const MODULE_ID = "search" as const;

export type { SearchHit, SearchHitKind, SearchResult } from "./types";

export { normalizeSearchQuery, searchFirma } from "./search";
