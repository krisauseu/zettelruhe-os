/**
 * Zusammenfassende Meldung (ZM) Übersicht (Self-File, ADR-0020).
 *
 * Quelle: Buchungsjournal der aktiven Firma + aktuelles Land am Kontakt.
 * Einnahmen aus Rechnungen über Zahlungsjournal (Zufluss, ADR-0024).
 * Nur Regelbesteuerung; unter Kleinunternehmerregelung nicht relevant.
 *
 * Ehrliche Kandidaten: wirtschaftliche Einnahmen mit USt 0,00 € (nicht Satz 7/19)
 * an einen Kontakt im übrigen EU-Gebiet. Rechnungsbuchungen speichern oft
 * keinen Steuersatz — maßgeblich ist die USt, nicht der Satz.
 *
 * Nicht raten: Art (Lieferung / sonstige Leistung / Dreieck),
 * Unterscheidung ig. Lieferung vs. Ausfuhr vs. andere Steuerfreiheit,
 * Gültigkeit der USt-IdNr. zum Umsatzzeitpunkt.
 * USt-IdNr. kommt aus dem Kontakt-Stamm; Notiz nur Fallback, ungeprüft.
 * Ein BZSt-Schnappschuss ist kein Dauer-Stempel.
 *
 * Kein ELSTER-Versand, kein XML.
 */

import { money, moneyToString, sumMoney } from "@/lib/money";
import type { JournalEintrag } from "@/modules/journal/types";
import type { Steuermodus } from "@/lib/pb";
import {
  isStornoEintrag,
  istZuflussRelevant,
  wirtschaftlicheRichtung,
} from "./aggregate";
import { lastDayOfMonth, parseYmd, quarterOfMonth } from "./periods";
import { roundEuroGanz } from "./ustva";
import { moneyDe } from "./export-csv";
import type {
  Zeitraum,
  ZmEinordnung,
  ZmKontaktBlick,
  ZmKontaktSumme,
  ZmLandGruppe,
  ZmMeldezeitraum,
  ZmUebersicht,
  ZmUstIdStatus,
  ZmZeile,
} from "./types";

export const ZM_FORMAT_ID = "zettelruhe-zm-uebersicht-v2" as const;

export const ZM_HINWEIS =
  "ZM light aus 0-USt-Einnahmen im Buchungsjournal (Buchungsdatum) und dem aktuellen Land am Kontakt. " +
  "Kandidaten sind keine festgestellten innergemeinschaftlichen Lieferungen oder sonstigen Leistungen. " +
  "Art wird nicht geführt. USt-IdNr. kommt aus dem Kontakt-Stamm (Notiz nur Fallback). " +
  "Ein BZSt-Schnappschuss gilt nur für den Anfragezeitpunkt, nicht für den Umsatz. " +
  "Werte selbst in Mein Elster eintragen — kein ELSTER-Versand, keine Abgabe aus der App. " +
  "Rechnungsbuchungen speichern oft keinen Steuersatz; maßgeblich ist USt 0,00 €. " +
  "Rechnungs-Einnahmen zählen mit dem Zahlungsdatum (Quelle Zahlung). Land ist der Stammdaten-Stand, kein Historien-Schnappschuss.";

const MONAT_NAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/**
 * Übriges Gemeinschaftsgebiet (EU-27 ohne DE).
 * GR = ISO, EL = USt-Präfix Griechenland; XI = Nordirland (USt).
 */
export const EU_LAENDER_OHNE_DE = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
]);

export const ZM_NICHT_GEFUEHRT: { feld: string; bezeichnung: string }[] = [
  {
    feld: "Art",
    bezeichnung:
      "Art der Leistung (1 innergemeinschaftliche Lieferung / 2 Dreiecksgeschäft / 3 sonstige Leistung)",
  },
  {
    feld: "Gültigkeit zum Umsatz",
    bezeichnung:
      "Ob die USt-IdNr. im Leistungszeitpunkt gültig war — der BZSt-Schnappschuss gilt nur für den Anfragezeitpunkt",
  },
  {
    feld: "Unterscheidung",
    bezeichnung:
      "Innergemeinschaftliche Lieferung vs. Ausfuhr vs. andere steuerfreie Umsätze",
  },
  {
    feld: "Erwerb",
    bezeichnung:
      "Innergemeinschaftliche Erwerbe — die ZM betrifft nur Ausgangsumsätze",
  },
  {
    feld: "Unternehmer",
    bezeichnung:
      "Ob der Abnehmer Unternehmer mit gültiger USt-IdNr. ist",
  },
];

export function normalizeLand(land: string | null | undefined): string {
  return (land ?? "").trim().toUpperCase();
}

export function landGruppe(land: string | null | undefined): ZmLandGruppe {
  const code = normalizeLand(land);
  if (!code || code.length !== 2) return "unbekannt";
  if (code === "DE") return "de";
  if (EU_LAENDER_OHNE_DE.has(code)) return "eu_ohne_de";
  return "drittland";
}

function normalizeUstIdToken(raw: string): string {
  return raw.replace(/[\s.\-/]/g, "").toUpperCase();
}

/**
 * Nur explizit beschriftete USt-Id in der Notiz — kein freies Raten aus Ziffern.
 */
export function extractUstIdAusNotiz(notiz: string | null | undefined): string {
  const text = (notiz ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const match = text.match(
    /(?:USt[\s.-]*Id(?:Nr)?\.?|UID|VAT(?:[\s-]*ID)?)\s*:?\s*([A-Za-z]{2}[A-Za-z0-9]{2,12})/i,
  );
  if (!match?.[1]) return "";
  const id = normalizeUstIdToken(match[1]);
  if (id.length < 4 || id.length > 14) return "";
  return id;
}

export function detectZmMeldezeitraum(zeitraum: Zeitraum): ZmMeldezeitraum {
  const von = parseYmd(zeitraum.von);
  const bis = parseYmd(zeitraum.bis);

  if (
    von.y === bis.y &&
    von.m === bis.m &&
    von.d === 1 &&
    bis.d === lastDayOfMonth(von.y, von.m)
  ) {
    return {
      art: "monat",
      jahr: String(von.y),
      label: `${MONAT_NAMEN[von.m - 1]} ${von.y} — typischer ZM-Meldezeitraum`,
    };
  }

  const q = quarterOfMonth(von.m);
  const startM = (q - 1) * 3 + 1;
  const endM = startM + 2;
  if (
    von.y === bis.y &&
    von.m === startM &&
    von.d === 1 &&
    bis.m === endM &&
    bis.d === lastDayOfMonth(bis.y, endM)
  ) {
    return {
      art: "quartal",
      jahr: String(von.y),
      label: `${q}. Quartal ${von.y} — quartalsweise ZM möglich (Voraussetzungen in Mein Elster prüfen)`,
    };
  }

  return {
    art: "kein_meldezeitraum",
    jahr: String(von.y),
    label:
      "Kein typischer ZM-Meldezeitraum (ZM ist Kalendermonat, unter Voraussetzungen Quartal)",
  };
}

/** Einnahme ohne deutsche USt — nicht Satz 7/19, auch bei leerem Steuersatz. */
export function isNullUstEinnahme(
  e: JournalEintrag,
  originals?: Map<string, JournalEintrag>,
): boolean {
  const richtung = wirtschaftlicheRichtung(e, originals);
  if (richtung !== "einnahme") return false;
  if (!money(e.betrag_ust).isZero()) return false;
  if (e.steuersatz === "7" || e.steuersatz === "19") return false;
  return true;
}

function ustIdAusKontakt(kontakt: ZmKontaktBlick | undefined): {
  ust_id: string;
  ust_id_notiz: string;
  ust_id_status: ZmUstIdStatus;
  ust_id_pruefung_am: string;
  ust_id_pruefung_status: string;
} {
  const stamm = normalizeUstIdToken(kontakt?.ust_id ?? "");
  const notiz = extractUstIdAusNotiz(kontakt?.notiz);
  if (stamm) {
    const p = kontakt?.letzte_pruefung;
    const passend =
      p && normalizeUstIdToken(p.abgefragte_ust_id) === stamm ? p : undefined;
    if (passend) {
      return {
        ust_id: stamm,
        ust_id_notiz: notiz,
        ust_id_status: "pruefung_snapshot",
        ust_id_pruefung_am: passend.anfrage_zeitpunkt,
        ust_id_pruefung_status: passend.status,
      };
    }
    return {
      ust_id: stamm,
      ust_id_notiz: notiz,
      ust_id_status: "stamm_ungeprueft",
      ust_id_pruefung_am: "",
      ust_id_pruefung_status: "",
    };
  }
  if (notiz) {
    return {
      ust_id: "",
      ust_id_notiz: notiz,
      ust_id_status: "notiz_ungeprueft",
      ust_id_pruefung_am: "",
      ust_id_pruefung_status: "",
    };
  }
  return {
    ust_id: "",
    ust_id_notiz: "",
    ust_id_status: "nicht_gefuehrt",
    ust_id_pruefung_am: "",
    ust_id_pruefung_status: "",
  };
}

function toZeile(
  e: JournalEintrag,
  originals: Map<string, JournalEintrag>,
  kontakte: Map<string, ZmKontaktBlick>,
): ZmZeile {
  const faktor = isStornoEintrag(e) ? -1 : 1;
  const netto = money(e.betrag_netto).times(faktor);
  const kontakt = e.kontakt ? kontakte.get(e.kontakt) : undefined;
  const land = kontakt?.land ?? "";
  const gruppe = e.kontakt
    ? kontakt
      ? landGruppe(land)
      : "unbekannt"
    : "unbekannt";
  const einordnung: ZmEinordnung =
    gruppe === "eu_ohne_de" ? "kandidat" : "andere_nullust";
  const ust = ustIdAusKontakt(kontakt);

  return {
    einordnung,
    journal_id: e.id,
    laufende_nr: e.laufende_nr,
    buchungsdatum: e.buchungsdatum,
    buchungstext: e.buchungstext,
    quelle_typ: e.quelle_typ,
    quelle_id: e.quelle_id,
    steuersatz: e.steuersatz || "",
    kontakt_id: e.kontakt,
    kontakt_name: kontakt?.name ?? (e.kontakt ? "Kontakt nicht gefunden" : "—"),
    land: normalizeLand(land),
    land_gruppe: gruppe,
    ust_id: ust.ust_id,
    ust_id_notiz: ust.ust_id_notiz,
    ust_id_status: ust.ust_id_status,
    ust_id_pruefung_am: ust.ust_id_pruefung_am,
    ust_id_pruefung_status: ust.ust_id_pruefung_status,
    journal_netto: moneyToString(netto),
    eintrag_euro_ganz: roundEuroGanz(netto).toFixed(0),
    ist_storno: isStornoEintrag(e),
  };
}

function summeKontakt(zeilen: ZmZeile[]): ZmKontaktSumme {
  const first = zeilen[0]!;
  const netto = sumMoney(...zeilen.map((z) => z.journal_netto));
  return {
    kontakt_id: first.kontakt_id ?? "",
    kontakt_name: first.kontakt_name,
    land: first.land,
    ust_id: first.ust_id,
    ust_id_notiz: first.ust_id_notiz,
    ust_id_status: first.ust_id_status,
    ust_id_pruefung_am: first.ust_id_pruefung_am,
    ust_id_pruefung_status: first.ust_id_pruefung_status,
    anzahl_buchungen: zeilen.length,
    journal_netto: moneyToString(netto),
    eintrag_euro_ganz: roundEuroGanz(netto).toFixed(0),
  };
}

function originalsMap(
  eintraege: JournalEintrag[],
  extraOriginale: JournalEintrag[],
): Map<string, JournalEintrag> {
  const map = new Map<string, JournalEintrag>();
  for (const e of extraOriginale) map.set(e.id, e);
  for (const e of eintraege) map.set(e.id, e);
  return map;
}

/**
 * Baut die ZM-Übersicht. Erfindet keine Art und keine USt-IdNr.
 */
export function buildZmUebersicht(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  steuermodus: Steuermodus,
  kontakte: Map<string, ZmKontaktBlick> = new Map(),
  extraOriginale: JournalEintrag[] = [],
): ZmUebersicht {
  const meldezeitraum = detectZmMeldezeitraum(zeitraum);

  if (steuermodus === "kleinunternehmer") {
    return {
      format_id: ZM_FORMAT_ID,
      steuermodus,
      verfuegbar: false,
      zeitraum,
      meldezeitraum,
      kandidaten: [],
      kandidaten_zeilen: [],
      andere_nullust: [],
      summe_kandidaten_netto: "0.00",
      summe_kandidaten_euro_ganz: "0",
      summe_andere_netto: "0.00",
      csv_download_erlaubt: false,
      csv_blockgrund:
        "Unter der Kleinunternehmerregelung (§ 19 UStG) ist die Zusammenfassende Meldung typisch nicht relevant.",
      nicht_gefuehrt: [],
      hinweis:
        "Unter der Kleinunternehmerregelung (§ 19 UStG) entfällt die Zusammenfassende Meldung als Arbeitsflow. Es werden keine innergemeinschaftlichen Lieferungen im Sinne der Regelbesteuerung vorbereitet.",
    };
  }

  const originals = originalsMap(eintraege, extraOriginale);
  const zeilen: ZmZeile[] = [];
  for (const e of eintraege) {
    if (!istZuflussRelevant(e, originals)) continue;
    if (!isNullUstEinnahme(e, originals)) continue;
    zeilen.push(toZeile(e, originals, kontakte));
  }

  const kandidaten_zeilen = zeilen
    .filter((z) => z.einordnung === "kandidat")
    .sort((a, b) => {
      if (a.buchungsdatum !== b.buchungsdatum) {
        return a.buchungsdatum < b.buchungsdatum ? -1 : 1;
      }
      return a.laufende_nr - b.laufende_nr;
    });
  const andere_nullust = zeilen
    .filter((z) => z.einordnung === "andere_nullust")
    .sort((a, b) => {
      if (a.buchungsdatum !== b.buchungsdatum) {
        return a.buchungsdatum < b.buchungsdatum ? -1 : 1;
      }
      return a.laufende_nr - b.laufende_nr;
    });

  const byKontakt = new Map<string, ZmZeile[]>();
  for (const z of kandidaten_zeilen) {
    const key = z.kontakt_id ?? z.journal_id;
    const list = byKontakt.get(key) ?? [];
    list.push(z);
    byKontakt.set(key, list);
  }

  const kandidaten = [...byKontakt.values()]
    .map(summeKontakt)
    .sort((a, b) =>
      a.kontakt_name.localeCompare(b.kontakt_name, "de", { sensitivity: "base" }),
    );

  const summeKandidaten = sumMoney(...kandidaten.map((k) => k.journal_netto));
  const summeAndere = sumMoney(...andere_nullust.map((z) => z.journal_netto));

  return {
    format_id: ZM_FORMAT_ID,
    steuermodus,
    verfuegbar: true,
    zeitraum,
    meldezeitraum,
    kandidaten,
    kandidaten_zeilen,
    andere_nullust,
    summe_kandidaten_netto: moneyToString(summeKandidaten),
    summe_kandidaten_euro_ganz: roundEuroGanz(summeKandidaten).toFixed(0),
    summe_andere_netto: moneyToString(summeAndere),
    csv_download_erlaubt: true,
    csv_blockgrund: "",
    nicht_gefuehrt: [...ZM_NICHT_GEFUEHRT],
    hinweis: ZM_HINWEIS,
  };
}

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

export const ZM_CSV_HEADERS = [
  "ebene",
  "einordnung",
  "kontakt_name",
  "land",
  "ust_id",
  "ust_id_notiz",
  "ust_id_status",
  "ust_id_pruefung_am",
  "ust_id_pruefung_status",
  "art",
  "journal_netto",
  "eintrag_euro_ganz",
  "anzahl_buchungen",
  "buchungsdatum",
  "buchungstext",
  "quelle_typ",
  "journal_id",
] as const;

/**
 * CSV light zum Abschreiben — kein amtliches ZM-Format.
 */
export function serializeZmCsv(
  zm: ZmUebersicht,
  opts?: { bom?: boolean },
): { csv: string; filename: string } {
  if (!zm.csv_download_erlaubt) {
    throw new Error(zm.csv_blockgrund || "CSV-Download nicht möglich.");
  }

  const lines = [row([...ZM_CSV_HEADERS])];
  for (const k of zm.kandidaten) {
    lines.push(
      row([
        "kontakt",
        "kandidat",
        k.kontakt_name,
        k.land,
        k.ust_id,
        k.ust_id_notiz,
        k.ust_id_status,
        k.ust_id_pruefung_am,
        k.ust_id_pruefung_status,
        "nicht_gefuehrt",
        moneyDe(k.journal_netto),
        k.eintrag_euro_ganz,
        k.anzahl_buchungen,
        "",
        "",
        "",
        "",
      ]),
    );
  }
  for (const z of zm.kandidaten_zeilen) {
    lines.push(
      row([
        "zeile",
        "kandidat",
        z.kontakt_name,
        z.land,
        z.ust_id,
        z.ust_id_notiz,
        z.ust_id_status,
        z.ust_id_pruefung_am,
        z.ust_id_pruefung_status,
        "nicht_gefuehrt",
        moneyDe(z.journal_netto),
        z.eintrag_euro_ganz,
        "",
        z.buchungsdatum,
        z.buchungstext,
        z.quelle_typ,
        z.journal_id,
      ]),
    );
  }
  for (const z of zm.andere_nullust) {
    lines.push(
      row([
        "zeile",
        "andere_nullust",
        z.kontakt_name,
        z.land,
        z.ust_id,
        z.ust_id_notiz,
        z.ust_id_status,
        z.ust_id_pruefung_am,
        z.ust_id_pruefung_status,
        "nicht_gefuehrt",
        moneyDe(z.journal_netto),
        z.eintrag_euro_ganz,
        "",
        z.buchungsdatum,
        z.buchungstext,
        z.quelle_typ,
        z.journal_id,
      ]),
    );
  }

  const body = lines.join("\r\n") + "\r\n";
  const csv = opts?.bom === false ? body : `\uFEFF${body}`;
  return { csv, filename: zmCsvFilename(zm) };
}

export function zmCsvFilename(zm: Pick<ZmUebersicht, "zeitraum" | "meldezeitraum">): string {
  const m = zm.meldezeitraum;
  if (m.art === "monat") {
    const { y, m: monat } = parseYmd(zm.zeitraum.von);
    const mm = monat < 10 ? `0${monat}` : String(monat);
    return `ZM_Zettelruhe_${y}_${mm}.csv`;
  }
  if (m.art === "quartal") {
    const q = quarterOfMonth(parseYmd(zm.zeitraum.von).m);
    return `ZM_Zettelruhe_${m.jahr}_Q${q}.csv`;
  }
  return `ZM_Zettelruhe_${zm.zeitraum.von}_${zm.zeitraum.bis}.csv`;
}
