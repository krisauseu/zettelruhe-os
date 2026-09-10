/**
 * Domain-Typen: Auswertungen & Export (Bauabschnitt 13)
 * Lesend aus Buchungsjournal (+ offene Posten); keine Finanz-Writes.
 */

import type {
  JournalEintrag,
  QuelleTyp,
  Steuersatz,
} from "@/modules/journal/types";
import type { Steuermodus } from "@/lib/pb";

/** Zeitraum YYYY-MM-DD inklusiv (Europe/Berlin-Kalendertag) */
export type Zeitraum = {
  von: string;
  bis: string;
};

export type ZeitraumPreset = "monat" | "quartal" | "jahr" | "custom";

/** EÜR-Kategorie light (nicht 1:1 Finanzamts-Software) */
export type EurKategorieId =
  | "umsatzerloese"
  | "bareinnahmen"
  | "sonstige_einnahmen"
  | "betriebsausgaben"
  | "barausgaben"
  | "sonstige_ausgaben";

export type EurKategorieZeile = {
  id: EurKategorieId;
  label: string;
  richtung: "einnahme" | "ausgabe";
  /** Summe Brutto (decimal string) */
  summe_brutto: string;
  /** Summe Netto */
  summe_netto: string;
  /** Summe USt */
  summe_ust: string;
  anzahl: number;
};

export type EurAuswertung = {
  zeitraum: Zeitraum;
  einnahmen: EurKategorieZeile[];
  ausgaben: EurKategorieZeile[];
  summe_einnahmen_brutto: string;
  summe_ausgaben_brutto: string;
  /** Einnahmen − Ausgaben (Brutto light) */
  ueberschuss_brutto: string;
  summe_einnahmen_netto: string;
  summe_ausgaben_netto: string;
  ueberschuss_netto: string;
  /** Anzahl Journal-Zeilen im Zeitraum */
  anzahl_buchungen: number;
  /**
   * Hinweis: Auswertung basiert auf festgeschriebenem Journal nach Zufluss
   * (Zahlungen auf Rechnungen, nicht die Forderungsbuchung).
   */
  hinweis_journal_basis: string;
};

/** USt je Steuersatz (nur Regelbesteuerung) */
export type UstSatzZeile = {
  steuersatz: Steuersatz | "ohne";
  /** Umsatzsteuer aus Einnahmen */
  ust_einnahmen: string;
  /** Vorsteuer aus Ausgaben */
  vorsteuer: string;
  netto_einnahmen: string;
  netto_ausgaben: string;
};

export type UstUebersicht = {
  zeitraum: Zeitraum;
  steuermodus: Steuermodus;
  /** Unter KU nur verfügbar, wenn die Periode gespeicherte RC-Fälle enthält. */
  verfuegbar: boolean;
  zeilen: UstSatzZeile[];
  summe_ust_einnahmen: string;
  summe_vorsteuer: string;
  reverse_charge: {
    vorhanden: boolean;
    anzahl: number;
    grundlage_eu: string;
    schuld_eu: string;
    grundlage_drittland: string;
    schuld_drittland: string;
    vorsteuer: string;
  };
  /** Zahllast light = USt − Kz 66 + RC-Schuld − Kz 67 */
  zahllast: string;
  hinweis: string;
};

/** Amtlicher UStVA-Zeitraum oder nur Auswertungsfenster */
export type UstvaZeitraumArt = "monat" | "quartal" | "kein_voranmeldungszeitraum";

export type UstvaVoranmeldung = {
  art: UstvaZeitraumArt;
  /** Kalenderjahr des Zeitraumanfangs, z. B. "2026" */
  jahr: string;
  /** "01"–"12" Monat, "41"–"44" Quartal, sonst null */
  zeitraum_code: string | null;
  label: string;
};

export type UstvaKennzahlStatus = "befuellt" | "nicht_gefuehrt";

export type UstvaKennzahlEinheit = "euro_ganz" | "euro_cent";

/** Eine UStVA-Kennzahl light (Self-File, kein Versand) */
export type UstvaKennzahlZeile = {
  kz: string;
  bezeichnung: string;
  status: UstvaKennzahlStatus;
  /** Wert für Mein Elster; null wenn nicht geführt */
  eintrag: string | null;
  eintrag_einheit: UstvaKennzahlEinheit;
  journal_netto: string | null;
  journal_ust: string | null;
  hinweis: string;
};

export type UstvaFirmaAngaben = {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  steuernummer: string;
};

/** Land-Gruppe für ZM-Kandidaten (ISO-2 am Kontakt, aktueller Stand). */
export type ZmLandGruppe = "eu_ohne_de" | "de" | "drittland" | "unbekannt";

export type ZmEinordnung = "kandidat" | "andere_nullust";

export type ZmUstIdStatus =
  | "notiz_ungeprueft"
  | "nicht_gefuehrt"
  | "stamm_ungeprueft"
  | "pruefung_snapshot";

/** Amtlicher ZM-Meldezeitraum oder nur Auswertungsfenster */
export type ZmZeitraumArt = "monat" | "quartal" | "kein_meldezeitraum";

export type ZmMeldezeitraum = {
  art: ZmZeitraumArt;
  /** Kalenderjahr des Zeitraumanfangs, z. B. "2026" */
  jahr: string;
  label: string;
};

/** Kontakt-Ausschnitt für die ZM (aktueller Stamm, kein Historien-Schnappschuss des Landes). */
export type ZmKontaktBlick = {
  id: string;
  name: string;
  land: string;
  notiz: string;
  ust_id: string;
  letzte_pruefung?: {
    anfrage_zeitpunkt: string;
    status: string;
    status_meldung: string;
    abgefragte_ust_id: string;
  };
};

/** Eine Journal-Zeile in der ZM-Übersicht (0-USt-Einnahme). */
export type ZmZeile = {
  einordnung: ZmEinordnung;
  journal_id: string;
  laufende_nr: number;
  buchungsdatum: string;
  buchungstext: string;
  quelle_typ: QuelleTyp;
  quelle_id: string;
  steuersatz: string;
  kontakt_id: string | null;
  kontakt_name: string;
  land: string;
  land_gruppe: ZmLandGruppe;
  ust_id: string;
  ust_id_notiz: string;
  ust_id_status: ZmUstIdStatus;
  ust_id_pruefung_am: string;
  ust_id_pruefung_status: string;
  journal_netto: string;
  eintrag_euro_ganz: string;
  ist_storno: boolean;
};

/** Summe je Kontakt — das, was der ZM-Zeile in Mein Elster am nächsten kommt. */
export type ZmKontaktSumme = {
  kontakt_id: string;
  kontakt_name: string;
  land: string;
  ust_id: string;
  ust_id_notiz: string;
  ust_id_status: ZmUstIdStatus;
  ust_id_pruefung_am: string;
  ust_id_pruefung_status: string;
  anzahl_buchungen: number;
  journal_netto: string;
  eintrag_euro_ganz: string;
};

/**
 * ZM-Übersicht light aus Journal + Kontakt-Land + Stamm-USt-Id.
 * Format-ID: zettelruhe-zm-uebersicht-v2
 */
export type ZmUebersicht = {
  format_id: "zettelruhe-zm-uebersicht-v2";
  steuermodus: Steuermodus;
  verfuegbar: boolean;
  zeitraum: Zeitraum;
  meldezeitraum: ZmMeldezeitraum;
  kandidaten: ZmKontaktSumme[];
  kandidaten_zeilen: ZmZeile[];
  andere_nullust: ZmZeile[];
  summe_kandidaten_netto: string;
  summe_kandidaten_euro_ganz: string;
  summe_andere_netto: string;
  csv_download_erlaubt: boolean;
  csv_blockgrund: string;
  nicht_gefuehrt: { feld: string; bezeichnung: string }[];
  hinweis: string;
};

/**
 * UStVA-Datensatz light aus der USt-Übersicht.
 * Format-ID: zettelruhe-ustva-elster-xml-light-v1
 */
export type UstvaDatensatz = {
  format_id: "zettelruhe-ustva-elster-xml-light-v1";
  steuermodus: Steuermodus;
  verfuegbar: boolean;
  zeitraum: Zeitraum;
  voranmeldung: UstvaVoranmeldung;
  firma: UstvaFirmaAngaben;
  kennzahlen: UstvaKennzahlZeile[];
  nicht_gefuehrt: { kz: string; bezeichnung: string }[];
  /** Errechnetes Kz 83 einschließlich RC-Schuld und Kz 67, 2 Stellen */
  kz83: string;
  zahllast_journal: string;
  xml_download_erlaubt: boolean;
  xml_blockgrund: string;
  hinweis: string;
};

export type DashboardKennzahlen = {
  zeitraum: Zeitraum;
  steuermodus: Steuermodus;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ueberschuss_brutto: string;
  /** Summe offener Rechnungs-Restbeträge (payments) */
  offene_posten_summe: string;
  offene_posten_anzahl: number;
  /** USt-Hinweis nur Regelbesteuerung */
  ust_zahllast: string | null;
  anzahl_buchungen: number;
};

/** BWA light: Einnahmen/Ausgaben je Zeitraum (gleiche Basis wie EÜR-Summen) */
export type BwaLight = {
  zeitraum: Zeitraum;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ergebnis_brutto: string;
};

export type JournalExportRow = JournalEintrag;

export type DatevExportMeta = {
  /** Dokumentiertes Format — kein DATEV-Zertifizierungs-Claim */
  format_id: "zettelruhe-datev-csv-light-v1";
  delimiter: ";";
  encoding_hint: "utf-8-bom";
  zeitraum: Zeitraum;
  anzahl_zeilen: number;
};

export type BelegArchivMeta = {
  beleg_id: string;
  belegnummer: string;
  belegdatum: string;
  buchungsdatum: string;
  richtung: string;
  betrag_brutto: string;
  betrag_netto: string;
  betrag_ust: string;
  steuersatz: string;
  kategorie: string;
  konto: string;
  notiz: string;
  dateiname: string;
  journal_eintrag: string;
  festgeschrieben_am: string;
  rc: import("@/modules/expenses/reverse-charge").RcSnapshot | null;
};
