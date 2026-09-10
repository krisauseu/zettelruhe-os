/**
 * Domain-Typen: Bankkonten, Kontoauszugs-Import, Matching light
 * Bauabschnitt 11 — getrennt vom Kassenbuch (CONTEXT).
 * Matching erzeugt Zahlung über payments (inkl. Zufluss-Journal); kein PSD2.
 */

/** Richtung der Auszugszeile (aus Sicht der Firma) */
export type BankBewegungRichtung = "eingang" | "ausgang";

/** Match-Status der Auszugszeile */
export type BankBewegungStatus = "offen" | "gematcht" | "ignoriert";

/** Importformat (CSV und klassisches SWIFT-MT940 / STA) */
export type BankImportFormat = "csv" | "mt940";

/** Stammdaten Bankkonto (Zahlweg unbar) */
export type Bankkonto = {
  id: string;
  firma: string;
  name: string;
  iban: string;
  bic: string;
  kontoinhaber: string;
  aktiv: boolean;
  notiz: string;
  created?: string;
  updated?: string;
};

export type BankkontoInput = {
  name: string;
  iban?: string;
  bic?: string;
  kontoinhaber?: string;
  aktiv?: boolean;
  notiz?: string;
};

/** Import-Lauf light */
export type BankImportLauf = {
  id: string;
  firma: string;
  bankkonto: string;
  format: BankImportFormat;
  dateiname: string;
  /** ISO-8601 UTC */
  importiert_am: string;
  zeilen_gesamt: number;
  zeilen_neu: number;
  zeilen_duplikat: number;
  notiz: string;
  created?: string;
};

/** Eine Kontoauszugszeile */
export type BankBewegung = {
  id: string;
  firma: string;
  bankkonto: string;
  import_lauf: string | null;
  /** YYYY-MM-DD */
  datum: string;
  richtung: BankBewegungRichtung;
  /** Absoluter Betrag Decimal-String */
  betrag: string;
  verwendungszweck: string;
  gegenkonto_name: string;
  gegenkonto_iban: string;
  referenz: string;
  status: BankBewegungStatus;
  /** Hash für Idempotenz (firma+bankkonto unique) */
  idempotenz_schluessel: string;
  rechnung: string | null;
  zahlung: string | null;
  notiz: string;
  created?: string;
  updated?: string;
};

/** Geparste Zeile vor Persistenz (ohne firma/ids) */
export type ParsedBankZeile = {
  datum: string;
  richtung: BankBewegungRichtung;
  betrag: string;
  verwendungszweck: string;
  gegenkonto_name: string;
  gegenkonto_iban: string;
  referenz: string;
};

export type BankkontoFilter = {
  q?: string;
  /** Default: alle; true = nur aktiv */
  aktiv?: boolean;
};

export type BankBewegungFilter = {
  bankkonto?: string;
  status?: BankBewegungStatus | "";
  richtung?: BankBewegungRichtung | "";
  von?: string;
  bis?: string;
  q?: string;
};

export type BankkontoListResult = {
  items: Bankkonto[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type BankBewegungListResult = {
  items: BankBewegung[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type ImportErgebnis = {
  lauf: BankImportLauf;
  neu: number;
  duplikat: number;
  gesamt: number;
};

/** Vorschlag für Matching Auszugszeile → offene Rechnung */
export type MatchVorschlag = {
  rechnungId: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  kundeName: string | null;
  betrag_brutto: string;
  offen: string;
  status: string;
  /** 0–100; höher = besser */
  score: number;
  gruende: string[];
};
