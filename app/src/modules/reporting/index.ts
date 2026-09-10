/**
 * Modul: reporting — Auswertungen & Export
 * Bauabschnitt 13: EÜR, USt-Übersicht, Dashboard, DATEV/CSV, Belegarchiv-ZIP
 * M2: UStVA-Kennzahlen + ELSTER-XML light; ZM-Übersicht (Self-File, kein Versand)
 * Read-only + Download-Artefakte; Journal = Source of Truth.
 */

export const MODULE_ID = "reporting" as const;

export type {
  BelegArchivMeta,
  BwaLight,
  DashboardKennzahlen,
  DatevExportMeta,
  EurAuswertung,
  EurKategorieId,
  EurKategorieZeile,
  UstSatzZeile,
  UstUebersicht,
  UstvaDatensatz,
  UstvaFirmaAngaben,
  UstvaKennzahlZeile,
  UstvaVoranmeldung,
  ZmKontaktSumme,
  ZmUebersicht,
  ZmZeile,
  Zeitraum,
  ZeitraumPreset,
} from "./types";

export {
  DEFAULT_AUSWERTUNG_PRESET,
  addCalendarMonths,
  addDaysYmd,
  dateToBerlinYmd,
  daysBetweenYmd,
  isDateInZeitraum,
  isValidIsoDate,
  lastDayOfMonth,
  monthsInZeitraum,
  normalizeZeitraumPreset,
  parseYmd,
  periodFromPreset,
  periodLastNMonths,
  periodMonth,
  periodQuarter,
  periodYear,
  quarterOfMonth,
  todayBerlin,
  validateZeitraum,
  zeitraumFromSearchParams,
  ymd,
} from "./periods";

export {
  PAR19_AMPEL_ACHTUNG,
  PAR19_AMPEL_NAHE,
  PAR19_GRENZEN,
  buildPar19Waechter,
  par19Ampel,
  par19GrenzeAm,
} from "./par19";
export type { Par19Ampel, Par19Grenze, Par19Waechter } from "./par19";

export {
  AUSGABEN_KATEGORIEN_TOP,
  LETZTE_BUCHUNGEN_ANZAHL,
  OHNE_KATEGORIE_LABEL,
  WEITERE_KATEGORIE_KEY,
  WEITERE_KATEGORIE_LABEL,
  buildAusgabenNachKategorien,
  buildFaelligkeiten,
  buildLetzteBuchungen,
  buildMonatlicheReihe,
  hrefFuerJournalQuelle,
  monatKategorienLabel,
  quartalKategorienLabel,
  sammelnKategorieQuelleIds,
} from "./uebersicht";
export type {
  AusgabenKategorieZeile,
  AusgabenKategorienBlick,
  FaelligkeitEintrag,
  FaelligkeitenBlick,
  KategorieSchnappschuesse,
  LetzteBuchung,
  VerlaufMonat,
} from "./uebersicht";

export {
  JOURNAL_BASIS_HINWEIS,
  buildBwaLight,
  buildDashboard,
  buildEur,
  buildUstUebersicht,
  filterZuflussJournal,
  inferSteuersatzFromBetraege,
  istZuflussRelevant,
  mapEurKategorie,
  sumOffenePosten,
} from "./aggregate";

export {
  BELEG_ARCHIV_CSV_HEADERS,
  JOURNAL_CSV_HEADERS,
  moneyDe,
  serializeBelegArchivCsv,
  serializeJournalCsv,
} from "./export-csv";

export {
  DATEV_FORMAT_ID,
  DATEV_HEADERS,
  datevBelegdatum,
  datevFilename,
  serializeDatevCsv,
} from "./export-datev";

export {
  USTVA_FORMAT_ID,
  USTVA_HINWEIS,
  USTVA_NICHT_GEFUEHRT,
  buildUstvaDatensatz,
  detectUstvaVoranmeldung,
  firmaToUstvaAngaben,
  serializeUstvaXml,
  truncateEuroGanz,
  ustvaXmlFilename,
} from "./ustva";

export {
  EU_LAENDER_OHNE_DE,
  ZM_CSV_HEADERS,
  ZM_FORMAT_ID,
  ZM_HINWEIS,
  ZM_NICHT_GEFUEHRT,
  buildZmUebersicht,
  detectZmMeldezeitraum,
  extractUstIdAusNotiz,
  landGruppe,
  serializeZmCsv,
  zmCsvFilename,
} from "./zm";

export { buildZip } from "./zip";
export type { ZipEntry } from "./zip";

export {
  exportBelegArchivZip,
  exportDatevCsv,
  exportJournalCsv,
  exportUstvaXml,
  getBwaLight,
  getDashboardKennzahlen,
  getUebersichtDashboard,
  getEurAuswertung,
  getUstUebersicht,
  getUstvaSeite,
  getZmUebersicht,
  exportZmCsv,
  listFestgeschriebeneBelegeInZeitraum,
  listJournalInZeitraum,
  listUstJournalInZeitraum,
} from "./repository";
export type { UebersichtDashboard } from "./repository";
