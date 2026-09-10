/**
 * Modul: einvoice — E-Rechnung Empfang und Versand
 * Empfang: Upload/Archiv Original, Parse (XML + PDF-Anhang, ADR-0029) → ParsedEInvoice, Beleg-Entwurf.
 * Versand: XML aus festgeschriebener Rechnung (ADR-0022). Kein Mustang-Sidecar.
 */

export const MODULE_ID = "einvoice" as const;

export type {
  BelegInput,
  EInvoiceFormat,
  EInvoiceParseStatus,
  ERechnungEmpfang,
  ERechnungEmpfangFilter,
  ERechnungEmpfangListResult,
  ERechnungEmpfangStatus,
  MapToBelegOptions,
  ParsedEInvoice,
  ParsedEInvoiceLine,
  ParsedEInvoiceParty,
  ParseEInvoiceResult,
} from "./types";

export type {
  EInvoiceOutbound,
  EInvoiceOutboundLine,
  EInvoicePrepareResult,
  EInvoiceSendProfil,
  EInvoiceValidationIssue,
  ERechnungVersand,
} from "./outbound-types";

export {
  assertCanCreateBeleg,
  assertHasParsedDto,
  BELEG_BEREITS_ERSTELLT_ERROR,
  deserializeParsed,
  empfangsZeitpunktUtc,
  ERECHNUNG_DATEI_MAX_BYTES,
  ERECHNUNG_DATEI_MIME,
  ORIGINAL_IMMUTABLE_ERROR,
  PARSE_FEHLER_BELEG_ERROR,
  parseEmpfangStatus,
  parseFormat,
  parseParseStatus,
  serializeParsed,
  validateERechnungDatei,
} from "./invariants";

export {
  LIEFERANT_MATCH_MIN_SCORE,
  mapParsedToBelegInput,
  scoreLieferantMatch,
} from "./mapping";

export { parseEInvoiceFile, parseEInvoiceXml } from "./parse";
export type { ParseFileInput } from "./parse";

export {
  archiveERechnung,
  createBelegFromERechnungSafe,
  getERechnungDateiResponse,
  getERechnungEmpfang,
  getLinkedBeleg,
  listERechnungEmpfang,
  replaceERechnungOriginal,
  suggestLieferantForEmpfang,
  uploadERechnung,
} from "./repository";

export {
  archiveERechnungAction,
  createBelegFromERechnungAction,
  uploadERechnungAction,
} from "./actions";

export {
  buildEInvoiceOutbound,
  mapEinheitToUnece,
  parseSendProfil,
  XRECHNUNG_CUSTOMIZATION_ID,
  ZUGFERD_EN16931_GUIDELINE_ID,
} from "./outbound";

export {
  EInvoiceValidationError,
  formatValidationIssues,
  prepareEInvoiceOutbound,
  validateEInvoiceOutbound,
} from "./validate-outbound";

export { renderXRechnungUbl } from "./render-ubl";
export { renderZugferdCii } from "./render-cii";

export {
  assertCanErzeugenVersand,
  renderEInvoiceXml,
  VERSAND_BEREITS_ERROR,
  versandDateiname,
} from "./send-invariants";

export {
  erzeugeERechnungVersand,
  getERechnungVersand,
  getERechnungVersandDateiResponse,
  listERechnungVersandForRechnung,
  pruefeERechnungVersand,
} from "./send-repository";

export {
  erzeugeERechnungVersandAction,
  pruefeERechnungVersandAction,
} from "./send-actions";

export { ERechnungVersandCard } from "./e-rechnung-versand-card";
