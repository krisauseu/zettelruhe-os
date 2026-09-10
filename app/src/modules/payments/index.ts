/**
 * Modul: payments — manuelle Zahlungen (inkl. Teilzahlung)
 * Ausgleich offener Rechnungen; Zufluss-Journal bei Zahlung (ADR-0024).
 */

export const MODULE_ID = "payments" as const;

export type {
  OffenerPosten,
  Zahlung,
  ZahlungFilter,
  ZahlungInput,
  ZahlungListResult,
  Zahlungsweg,
} from "./types";

export {
  allocateZahlungAufStaffel,
  assertKeineUeberzahlung,
  assertRechnungZahlungsfaehig,
  buildBuchungstextFromZahlung,
  buildJournalInputsFromZahlung,
  deriveRechnungStatus,
  isValidIsoDate,
  normalizeBetragInput,
  offenerBetrag,
  parseZahlungsweg,
  rechnungStaffelFuerZahlung,
  sumZahlungen,
  todayBerlin,
  validateZahlungInput,
  ZAHLUNG_BEZAHLT_ERROR,
  ZAHLUNG_ENTWURF_ERROR,
  ZAHLUNG_STORNIERT_ERROR,
  ZAHLUNG_UEBERZAHLUNG_ERROR,
  ZAHLUNGSFAEHIGE_STATUS,
} from "./invariants";
export type { ZahlungSteueranteil } from "./invariants";

export {
  createZahlung,
  deleteZahlung,
  getZahlung,
  getZahlungsstand,
  listOffenePosten,
  listZahlungen,
  listZahlungenForRechnung,
  nachziehenZahlungsjournale,
  nachziehenZahlungsjournaleEinmal,
  refreshRechnungZahlungsstatus,
} from "./repository";

export {
  ensureZahlungJournal,
  listZahlungsjournal,
  storniereZahlungsjournal,
} from "./journal";

export { createZahlungAction, deleteZahlungAction } from "./actions";
