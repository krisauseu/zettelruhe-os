/**
 * Modul: banking — Bankkonten, Kontoauszugs-Import (CSV / SWIFT-MT940 STA), Matching light
 * Getrennt vom Kassenbuch; Matching → payments.createZahlung (Zufluss-Journal).
 * Kein PSD2, kein CAMT.053, kein MT942 (ADR-0028).
 */

export const MODULE_ID = "banking" as const;

export type {
  BankBewegung,
  BankBewegungFilter,
  BankBewegungListResult,
  BankBewegungRichtung,
  BankBewegungStatus,
  BankImportFormat,
  BankImportLauf,
  Bankkonto,
  BankkontoFilter,
  BankkontoInput,
  BankkontoListResult,
  ImportErgebnis,
  MatchVorschlag,
  ParsedBankZeile,
} from "./types";

export {
  BANK_MATCH_BETRAG_ERROR,
  BANK_MATCH_NICHT_EINGANG_ERROR,
  BANK_MATCH_NICHT_OFFEN_ERROR,
  buildIdempotenzSchluessel,
  extractRechnungsnummernCandidates,
  isPlausibleIban,
  isValidRichtung,
  isValidStatus,
  MATCH_VORSCHLAG_MIN_SCORE,
  normalizeIban,
  normalizeRechnungsnummer,
  normalizeTextKey,
  parseBankDatum,
  parseSignedBetrag,
  scoreMatch,
  todayBerlin,
  validateBankkontoInput,
} from "./invariants";

export {
  BANK_CSV_DEFAULT_HEADER,
  BANK_CSV_HEADERS,
  parseBankCsv,
  parseCsvRows,
} from "./csv";

export { decodeBankImportBytes } from "./encoding";

export {
  anzeigeVerwendungszweck,
  detectBankImportFormat,
  extractIbanFromKontoId,
  looksLikeMt940,
  MT940_DIALEKT_HINWEIS,
  parseMt940,
  parseMt940Info86,
  parseSlashInfo86,
  pruefeMt940KontoIds,
} from "./mt940";

export {
  createBankkonto,
  deleteBankkonto,
  getBankBewegung,
  getBankkonto,
  idempotenzForZeile,
  ignoreBankBewegung,
  importBankAuszug,
  importBankCsv,
  importBankMt940,
  listBankBewegungen,
  listBankkonten,
  listMatchVorschlaege,
  matchBewegungToRechnung,
  reopenBankBewegung,
  updateBankkonto,
} from "./repository";

export {
  createBankkontoAction,
  deleteBankkontoAction,
  ignoreBewegungAction,
  importBankAuszugAction,
  importBankCsvAction,
  matchBewegungAction,
  reopenBewegungAction,
  updateBankkontoAction,
} from "./actions";

export { BankkontoForm } from "./bankkonto-form";
