/**
 * CSV-Export light (de-DE Semikolon, UTF-8 mit BOM optional).
 * Mind. Journal; Belege-Metadaten für Archiv-Index.
 */

import type { JournalEintrag } from "@/modules/journal/types";
import type { BelegArchivMeta } from "./types";

const DELIM = ";";

function esc(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (
    s.includes(DELIM) ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fields: (string | number | null | undefined)[]): string {
  return fields.map(esc).join(DELIM);
}

/** Betrag als de-DE (Komma) für Export an Kanzlei */
export function moneyDe(value: string): string {
  if (!value) return "0,00";
  // bereits "12.34" intern → "12,34"
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.replace(".", ",");
  }
  return value;
}

export const JOURNAL_CSV_HEADERS = [
  "laufende_nr",
  "buchungsdatum",
  "belegdatum",
  "richtung",
  "betrag_netto",
  "betrag_ust",
  "betrag_brutto",
  "steuersatz",
  "konto",
  "buchungstext",
  "quelle_typ",
  "quelle_id",
  "storno_von",
  "festgeschrieben_am",
  "rc_steuerdatum",
  "rc_vorgang",
  "rc_tatbestand",
  "rc_satz",
  "rc_grundlage",
  "rc_schuld",
  "rc_vorsteuer",
  "rc_steuermodus",
  "rc_abzug",
  "rc_zeitregel",
  "rc_korrektur_art",
  "rc_snapshot_json",
  "id",
] as const;

function rcCells(rc: JournalEintrag["rc"]): string[] {
  if (!rc) return new Array(10).fill("").concat(["", ""]);
  return [
    rc.steuerdatum,
    rc.vorgang,
    rc.tatbestand,
    rc.satz,
    moneyDe(rc.grundlage),
    moneyDe(rc.schuld),
    moneyDe(rc.vorsteuer),
    rc.steuermodus,
    rc.abzug,
    rc.zeitregel,
    rc.korrektur?.art ?? "",
    JSON.stringify(rc),
  ];
}

/** Journal → CSV (Semikolon, UTF-8) */
export function serializeJournalCsv(
  items: JournalEintrag[],
  opts?: { bom?: boolean; moneyDeFormat?: boolean },
): string {
  const de = opts?.moneyDeFormat !== false;
  const lines = [row([...JOURNAL_CSV_HEADERS])];
  for (const e of items) {
    lines.push(
      row([
        e.laufende_nr,
        e.buchungsdatum,
        e.belegdatum,
        e.richtung,
        de ? moneyDe(e.betrag_netto) : e.betrag_netto,
        de ? moneyDe(e.betrag_ust) : e.betrag_ust,
        de ? moneyDe(e.betrag_brutto) : e.betrag_brutto,
        e.steuersatz,
        e.konto,
        e.buchungstext,
        e.quelle_typ,
        e.quelle_id,
        e.storno_von,
        e.festgeschrieben_am,
        ...rcCells(e.rc),
        e.id,
      ]),
    );
  }
  const body = lines.join("\r\n") + "\r\n";
  if (opts?.bom === false) return body;
  return `\uFEFF${body}`;
}

export const BELEG_ARCHIV_CSV_HEADERS = [
  "beleg_id",
  "belegnummer",
  "belegdatum",
  "buchungsdatum",
  "richtung",
  "betrag_brutto",
  "betrag_netto",
  "betrag_ust",
  "steuersatz",
  "kategorie",
  "konto",
  "notiz",
  "dateiname",
  "journal_eintrag",
  "festgeschrieben_am",
  "rc_steuerdatum",
  "rc_vorgang",
  "rc_tatbestand",
  "rc_satz",
  "rc_grundlage",
  "rc_schuld",
  "rc_vorsteuer",
  "rc_steuermodus",
  "rc_abzug",
  "rc_zeitregel",
  "rc_korrektur_art",
  "rc_snapshot_json",
] as const;

export function serializeBelegArchivCsv(
  items: BelegArchivMeta[],
  opts?: { bom?: boolean },
): string {
  const lines = [row([...BELEG_ARCHIV_CSV_HEADERS])];
  for (const b of items) {
    lines.push(
      row([
        b.beleg_id,
        b.belegnummer,
        b.belegdatum,
        b.buchungsdatum,
        b.richtung,
        moneyDe(b.betrag_brutto),
        moneyDe(b.betrag_netto),
        moneyDe(b.betrag_ust),
        b.steuersatz,
        b.kategorie,
        b.konto,
        b.notiz,
        b.dateiname,
        b.journal_eintrag,
        b.festgeschrieben_am,
        ...rcCells(b.rc),
      ]),
    );
  }
  const body = lines.join("\r\n") + "\r\n";
  if (opts?.bom === false) return body;
  return `\uFEFF${body}`;
}
