/**
 * Modul: ustid — USt-IdNr. als Stammdatum + BZSt-Schnappschuss (ADR-0021).
 */

export const MODULE_ID = "ustid" as const;

export {
  BZST_ANGEFRAGTE_LAENDER,
  EU_UST_LAENDER,
  eigeneUstIdLage,
  fremdeUstIdLage,
  isBzstAnfragbareUstId,
  isDeutscheUstId,
  isUstIdSyntaxOk,
  normalizeUstId,
  ustIdLand,
} from "./format";
export type { EigeneUstIdLage, FremdeUstIdLage } from "./format";

export {
  EIGENE_DE_NICHT_ISOLIERT,
  EIGENE_UST_ID_FEHLT,
  SCHNAPPSCHUSS_NICHT_LESBAR,
  eigeneLageHinweis,
  grundEigeneLage,
  grundFremdeLage,
  kannBzstAbfrage,
} from "./invariants";

export {
  evatrStatusMeldung,
  istAnfragendeAbgelehnt,
  istGueltigZumAnfragezeitpunkt,
  qualifiziertErgebnisLabel,
} from "./status";

export {
  createUstIdPruefung,
  getAktuellePruefung,
  getAktuellePruefungenFuerKontakte,
  getLetzteAnfragendeVerwendung,
  listUstIdPruefungen,
  toPruefungBlick,
} from "./repository";

export {
  pruefeEigeneUstIdAction,
  pruefeKontaktUstIdAction,
} from "./actions";

export type {
  EvatrAntwort,
  UstIdPruefung,
  UstIdPruefungArt,
  UstIdPruefungBlick,
} from "./types";
