/**
 * Modul: expenses — Belege (manuelle Erfassung + Dateien)
 * Bauabschnitt 4: Entwurf, Festschreibung → Buchungsjournal, Datei immutable nach Festschreibung
 */

export const MODULE_ID = "expenses" as const;

export type {
  Beleg,
  BelegFilter,
  BelegInput,
  BelegListResult,
  BelegPartnerOption,
  BelegStatus,
  Buchungsrichtung,
  Steuersatz,
} from "./types";

export {
  AUSGABE_KUNDE_ERROR,
  assertCanFestschreiben,
  assertEntwurfEditable,
  assertPartnerPasstZurRichtung,
  belegBezeichnungLabel,
  belegPartnerId,
  BELEG_DATEI_MAX_ANZAHL,
  BELEG_DATEI_MAX_BYTES,
  BELEG_DATEI_MIME,
  buildBuchungstextFromBeleg,
  buildJournalInputFromBeleg,
  DATEI_IMMUTABLE_ERROR,
  EINNAHME_LIEFERANT_ERROR,
  FESTGESCHRIEBEN_ERROR,
  festschreibungsZeitpunktUtc,
  isEntwurf,
  isFestgeschrieben,
  isValidIsoDate,
  parseStatus,
  partnerEmptyHintFuerRichtung,
  partnerFeldFuerRichtung,
  partnerLabelFuerRichtung,
  partnerSelectFuerRichtung,
  PARTNER_ANLEGEN_HREF,
  todayBerlin,
  normalizeBelegDateiNamen,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";

export {
  addBelegDateien,
  clearBelegDatei,
  createBeleg,
  deleteBeleg,
  deleteFestgeschriebenenBeleg,
  festschreibenBeleg,
  getBeleg,
  getBelegDateiResponse,
  listBelege,
  listBelegeByIds,
  removeBelegDatei,
  setBelegDatei,
  updateBeleg,
  updateFestgeschriebenenBeleg,
} from "./repository";

export {
  clearBelegDateiAction,
  createBelegAction,
  deleteBelegAction,
  festschreibenBelegAction,
  updateBelegAction,
} from "./actions";
