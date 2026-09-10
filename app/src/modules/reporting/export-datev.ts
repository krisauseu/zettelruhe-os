/**
 * DATEV-Export light (CSV/EXTF-ähnlich, pragmatisch).
 *
 * Kein „DATEV-zertifiziert“-Claim. Ziel: Steuerkanzlei kann Journal-Zeilen
 * einlesen oder manuell zuordnen. Spezifikation:
 *
 * - Dateiname-Vorschlag: EXTIF_Buchungsstapel_Zettelruhe_YYYYMMDD_YYYYMMDD.csv
 * - Trennzeichen: Semikolon
 * - Encoding: UTF-8 mit BOM
 * - Beträge: de-DE mit Komma; Soll/Haben aus Richtung
 *   - Einnahme → H (Haben) auf Erlöskonto light
 *   - Ausgabe → S (Soll) auf Aufwandskonto light
 * - Konto: Journal.konto falls gesetzt, sonst Platzhalter 8400/4900 light
 * - Gegenkonto: 1200 (Forderungen/Bank light) — nicht SKR-vollständig
 * - Belegdatum: DDMM (DATEV-üblich) aus buchungsdatum
 *
 * Format-ID: zettelruhe-datev-csv-light-v1
 */

import type { JournalEintrag } from "@/modules/journal/types";
import type { DatevExportMeta, Zeitraum } from "./types";
import { filterZuflussJournal } from "./aggregate";
import { moneyDe } from "./export-csv";

export const DATEV_FORMAT_ID = "zettelruhe-datev-csv-light-v1" as const;
export const DATEV_RC_BLOCKGRUND =
  "DATEV light kann Reverse-Charge-Buchungen ohne verifizierte Konten- und BU-Schlüssel-Zuordnung nicht vollständig ausgeben. Verwenden Sie den vollständigen Journal-CSV-Export.";

/** DATEV-ähnliche Spalten (Untermenge Buchungsstapel) */
export const DATEV_HEADERS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  "Beleginfo - Art 1",
  "Beleginfo - Inhalt 1",
  "KOST1 - Kostenstelle",
  "KOST2 - Kostenstelle",
  "Kost-Menge",
  "EU-Land u. UStID",
  "EU-Steuersatz",
  "Abw. Versteuerungsart",
  "Sachverhalt LL",
  "Funktionsergänzung LL",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  "Zusatzinformation - Art 1",
  "Zusatzinformation - Inhalt 1",
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp",
  "Ust-Schlüssel (Anzahlungen)",
  "EU-Land (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)",
  "Erlöskonto (Anzahlungen)",
  "Herkunft-Kz",
  "Buchungs GUID",
  "KOST-Datum",
  "SEPA-Mandatsreferenz",
  "Skontosperre",
  "Gesellschaftername",
  "Beteiligtennummer",
  "Identifikationsnummer",
  "Zeichnernummer",
  "Postensperre bis",
  "Bezeichnung SoBil-Sachverhalt",
  "Kennzeichen SoBil-Buchung",
  "Festschreibung",
  "Leistungsdatum",
  "Datum Zuord. Steuerperiode",
] as const;

function esc(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** YYYY-MM-DD → DDMM (DATEV Belegdatum light, Jahr separat in Text) */
export function datevBelegdatum(ymd: string): string {
  if (!ymd || ymd.length < 10) return "";
  const [, m, d] = ymd.slice(0, 10).split("-");
  return `${d}${m}`;
}

function defaultKonto(e: JournalEintrag): string {
  if (e.konto?.trim()) return e.konto.trim();
  // SKR03-ish light placeholders
  if (e.richtung === "einnahme") return "8400";
  return "4900";
}

function sollHaben(e: JournalEintrag): "S" | "H" {
  // Einnahme → Haben (Erlös), Ausgabe → Soll (Aufwand) — light Konvention
  return e.richtung === "einnahme" ? "H" : "S";
}

function buSchluessel(e: JournalEintrag): string {
  if (e.steuersatz === "19") return "3";
  if (e.steuersatz === "7") return "8";
  if (e.steuersatz === "0") return "0";
  return "";
}

/**
 * Serialisiert Journal als DATEV-ähnlichen CSV-Buchungsstapel.
 * Header-Zeile 1: Format-Kommentar; Zeile 2: Spalten; ab Zeile 3: Daten.
 */
export function serializeDatevCsv(
  items: JournalEintrag[],
  zeitraum: Zeitraum,
  extraOriginale: JournalEintrag[] = [],
): { csv: string; meta: DatevExportMeta } {
  if (items.some((item) => item.rc)) throw new Error(DATEV_RC_BLOCKGRUND);
  const exportItems = filterZuflussJournal(items, extraOriginale);
  const comment = [
    `# ${DATEV_FORMAT_ID}`,
    `# Zettelruhe DATEV-Export light — kein DATEV-Zertifizierungs-Claim`,
    `# Zeitraum ${zeitraum.von} bis ${zeitraum.bis}`,
    `# Quelle: Buchungsjournal nach Zufluss (Zahlungen statt Rechnungs-Festschreibung)`,
  ].join("\r\n");

  const header = DATEV_HEADERS.map(esc).join(";");
  const lines: string[] = [header];

  for (const e of exportItems) {
    const umsatz = moneyDe(e.betrag_brutto);
    const cells = new Array<string>(DATEV_HEADERS.length).fill("");
    cells[0] = umsatz;
    cells[1] = sollHaben(e);
    cells[2] = "EUR";
    cells[6] = defaultKonto(e);
    cells[7] = "1200";
    cells[8] = buSchluessel(e);
    cells[9] = datevBelegdatum(e.buchungsdatum);
    cells[10] = e.quelle_id || String(e.laufende_nr);
    cells[13] = e.buchungstext.slice(0, 60);
    cells[20] = "Quelle";
    cells[21] = e.quelle_typ;
    cells[50] = e.id; // Buchungs GUID light
    cells[63] = "1"; // Festschreibung Kennzeichen light
    cells[64] = datevBelegdatum(e.belegdatum || e.buchungsdatum);
    lines.push(cells.map(esc).join(";"));
  }

  const csv = `\uFEFF${comment}\r\n${lines.join("\r\n")}\r\n`;
  return {
    csv,
    meta: {
      format_id: DATEV_FORMAT_ID,
      delimiter: ";",
      encoding_hint: "utf-8-bom",
      zeitraum,
      anzahl_zeilen: exportItems.length,
    },
  };
}

export function datevFilename(zeitraum: Zeitraum): string {
  const a = zeitraum.von.replace(/-/g, "");
  const b = zeitraum.bis.replace(/-/g, "");
  return `DATEV_Buchungsstapel_Zettelruhe_${a}_${b}.csv`;
}
