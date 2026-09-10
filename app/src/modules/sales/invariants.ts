/**
 * Reine Domain-Invarianten Rechnungen (ohne I/O).
 * Entwurf editierbar; nach Festschreibung immutable (ADR-0004, ADR-0012).
 * Nummern erst bei Festschreibung (kein Verbrauch im Entwurf).
 */

import {
  Decimal,
  money,
  moneyToString,
  mulMoney,
  percentOf,
  roundMoney,
  sumMoney,
} from "@/lib/money";
import type { Steuermodus } from "@/lib/pb";
import {
  isValidIsoDate,
  normalizeBetragInput,
  festschreibungsZeitpunktUtc,
  todayBerlin,
} from "@/modules/journal/invariants";
import type { JournalBuchungInput } from "@/modules/journal/types";
import type {
  Angebot,
  AngebotInput,
  AngebotStatus,
  AngebotStatusZiel,
  Angebotsposition,
  AngebotspositionInput,
  Rechnung,
  RechnungInput,
  RechnungStatus,
  Rechnungsposition,
  RechnungspositionInput,
  Steuersatz,
} from "./types";

export { isValidIsoDate, todayBerlin, festschreibungsZeitpunktUtc };

const VALID_STATUS = new Set<RechnungStatus>([
  "entwurf",
  "offen",
  "teilbezahlt",
  "bezahlt",
  "ueberfaellig",
  "storniert",
]);

/** Festgeschrieben = nicht mehr Entwurf (Inhalt/PDF immutable) */
const FESTGESCHRIEBENE_STATUS = new Set<RechnungStatus>([
  "offen",
  "teilbezahlt",
  "bezahlt",
  "ueberfaellig",
  "storniert",
]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);
const VALID_STEUERMODUS = new Set<Steuermodus>([
  "kleinunternehmer",
  "regelbesteuerung_ist",
]);

export const FESTGESCHRIEBEN_ERROR =
  "Festgeschriebene Rechnungen dürfen nicht still geändert oder gelöscht werden. Korrektur über Gutschrift/Storno.";

export const RECHNUNG_STORNO_ENTWURF_ERROR =
  "Entwürfe werden gelöscht, nicht storniert.";

export const RECHNUNG_STORNO_BEREITS_ERROR =
  "Die Rechnung ist bereits storniert.";

export function assertCanStornierenRechnung(
  rechnung: Pick<Rechnung, "status">,
): void {
  if (rechnung.status === "entwurf") {
    throw new Error(RECHNUNG_STORNO_ENTWURF_ERROR);
  }
  if (rechnung.status === "storniert") {
    throw new Error(RECHNUNG_STORNO_BEREITS_ERROR);
  }
}

export const PDF_IMMUTABLE_ERROR =
  "Das Rechnungs-PDF ist nach der Festschreibung unveränderbar (ADR-0012).";

export const PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR =
  "Das Original-PDF gibt es erst nach der Festschreibung. Für den Entwurf die Vorschau nutzen.";

export const PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR =
  "Das Original-PDF gibt es erst nach dem Senden. Für den Entwurf die Vorschau nutzen.";

export const PDF_VORSCHAU_NUR_ENTWURF_ERROR =
  "Die Entwurfsvorschau ist nur für Entwürfe. Nach dem Senden bzw. der Festschreibung nur das Original-PDF.";

/** § 19 UStG-Hinweis (Kleinunternehmerregelung) für PDF/Dokument */
export const KLEINUNTERNEHMER_HINWEIS =
  "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

export type ValidatedPosition = {
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  katalog_position: string | null;
};

export type ValidatedRechnungInput = {
  kunde: string | null;
  rechnungsdatum: string;
  leistungszeitraum_von: string;
  leistungszeitraum_bis: string;
  faellig_am: string;
  notiz: string;
  positionen: ValidatedPosition[];
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

/**
 * Normalisiert Mengen-Eingabe (de-DE Komma oder Punkt) → positive Decimal-String.
 */
export function normalizeMengeInput(raw: string): string {
  const trimmed = (raw ?? "").trim().replace(/\s/g, "");
  if (!trimmed) {
    throw new Error("Menge ist erforderlich.");
  }
  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const d = money(normalized);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error("Ungültige Menge.");
  }
  if (d.lte(0)) {
    throw new Error("Menge muss größer als 0 sein.");
  }
  // bis 4 Nachkommastellen (z. B. Stunden); trailing zeros ab
  return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString();
}

/**
 * Berechnet Zeilensummen: Menge × Einzelpreis → Netto; USt nach Steuersatz/Modus.
 */
export function calculatePositionBetraege(
  input: {
    menge: string;
    einzelpreis: string;
    steuersatz?: Steuersatz | "";
  },
  steuermodus: Steuermodus,
): {
  menge: string;
  einzelpreis: string;
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
} {
  const menge = normalizeMengeInput(input.menge);
  const einzelpreis = normalizeBetragInput(input.einzelpreis, "Einzelpreis");

  let steuersatz: Steuersatz | "" =
    input.steuersatz && VALID_STEUERSATZ.has(input.steuersatz)
      ? (input.steuersatz as Steuersatz)
      : "";

  // Kleinunternehmerregelung: kein USt-Ausweis
  if (steuermodus === "kleinunternehmer") {
    steuersatz = "";
  }

  const netto = moneyToString(roundMoney(mulMoney(menge, einzelpreis)));
  let ust = "0.00";
  if (steuermodus === "regelbesteuerung_ist" && steuersatz && steuersatz !== "0") {
    ust = moneyToString(roundMoney(percentOf(netto, steuersatz)));
  }
  const brutto = moneyToString(roundMoney(sumMoney(netto, ust)));

  return {
    menge,
    einzelpreis,
    steuersatz,
    betrag_netto: netto,
    betrag_ust: ust,
    betrag_brutto: brutto,
  };
}

/** Summiert Positionen zu Kopf-Beträgen. */
export function sumPositionen(
  positionen: Array<{
    betrag_netto: string;
    betrag_ust: string;
    betrag_brutto: string;
  }>,
): { betrag_netto: string; betrag_ust: string; betrag_brutto: string } {
  const netto = moneyToString(
    roundMoney(
      positionen.reduce((acc, p) => acc.plus(money(p.betrag_netto)), money(0)),
    ),
  );
  const ust = moneyToString(
    roundMoney(
      positionen.reduce((acc, p) => acc.plus(money(p.betrag_ust)), money(0)),
    ),
  );
  const brutto = moneyToString(
    roundMoney(
      positionen.reduce((acc, p) => acc.plus(money(p.betrag_brutto)), money(0)),
    ),
  );
  return { betrag_netto: netto, betrag_ust: ust, betrag_brutto: brutto };
}

/** Validiert und normalisiert eine Position. */
export function validatePositionInput(
  input: RechnungspositionInput,
  steuermodus: Steuermodus,
  sortierung: number,
): ValidatedPosition {
  const bezeichnung = (input.bezeichnung ?? "").trim();
  if (!bezeichnung) {
    throw new Error("Positionsbezeichnung ist erforderlich.");
  }
  if (bezeichnung.length > 500) {
    throw new Error("Positionsbezeichnung ist zu lang (max. 500 Zeichen).");
  }

  const einheit = (input.einheit ?? "").trim();
  if (einheit.length > 40) {
    throw new Error("Einheit ist zu lang (max. 40 Zeichen).");
  }

  const betraege = calculatePositionBetraege(
    {
      menge: input.menge,
      einzelpreis: input.einzelpreis,
      steuersatz: input.steuersatz,
    },
    steuermodus,
  );

  return {
    sortierung,
    bezeichnung,
    einheit,
    ...betraege,
    katalog_position: input.katalog_position?.trim() || null,
  };
}

/** Validiert Rechnungskopf + Positionen (Entwurf). */
export function validateRechnungInput(
  input: RechnungInput,
  steuermodus: Steuermodus,
): ValidatedRechnungInput {
  if (!VALID_STEUERMODUS.has(steuermodus)) {
    throw new Error("Ungültiger Steuer-Modus.");
  }

  const rechnungsdatum = (input.rechnungsdatum ?? "").trim();
  if (!isValidIsoDate(rechnungsdatum)) {
    throw new Error("Rechnungsdatum muss YYYY-MM-DD sein.");
  }

  const von = (input.leistungszeitraum_von ?? "").trim();
  if (von && !isValidIsoDate(von)) {
    throw new Error("Leistungszeitraum von muss YYYY-MM-DD sein.");
  }
  const bis = (input.leistungszeitraum_bis ?? "").trim();
  if (bis && !isValidIsoDate(bis)) {
    throw new Error("Leistungszeitraum bis muss YYYY-MM-DD sein.");
  }
  if (von && bis && von > bis) {
    throw new Error("Leistungszeitraum: „von“ darf nicht nach „bis“ liegen.");
  }

  const faellig_am = (input.faellig_am ?? "").trim();
  if (faellig_am && !isValidIsoDate(faellig_am)) {
    throw new Error("Fälligkeitsdatum muss YYYY-MM-DD sein.");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const rawPositions = input.positionen ?? [];
  // Leere Zeilen (ohne Bezeichnung) ignorieren
  const nonEmpty = rawPositions.filter(
    (p) => (p.bezeichnung ?? "").trim() || (p.menge ?? "").trim() || (p.einzelpreis ?? "").trim(),
  );

  if (nonEmpty.length === 0) {
    throw new Error("Mindestens eine Position ist erforderlich.");
  }

  // sortierung 1-basiert: PocketBase required number behandelt 0 als „blank“
  const positionen = nonEmpty.map((p, i) =>
    validatePositionInput(p, steuermodus, i + 1),
  );

  const sums = sumPositionen(positionen);
  if (money(sums.betrag_brutto).lte(0)) {
    throw new Error("Rechnungsbetrag (Brutto) muss größer als 0 sein.");
  }

  const kunde = input.kunde?.trim() || null;

  return {
    kunde,
    rechnungsdatum,
    leistungszeitraum_von: von,
    leistungszeitraum_bis: bis,
    faellig_am,
    notiz,
    positionen,
    ...sums,
  };
}

export function isEntwurf(r: Pick<Rechnung, "status">): boolean {
  return r.status === "entwurf";
}

export function isFestgeschrieben(r: Pick<Rechnung, "status">): boolean {
  return FESTGESCHRIEBENE_STATUS.has(r.status);
}

export function assertEntwurfEditable(r: Pick<Rechnung, "status">): void {
  if (!isEntwurf(r)) {
    throw new Error(FESTGESCHRIEBEN_ERROR);
  }
}

/**
 * Festschreiben nur für Entwürfe ohne Nummer/Journal.
 * Kund:in und Positionen mit positivem Betrag erforderlich.
 */
export function assertCanFestschreiben(
  rechnung: Rechnung,
  positionen: Rechnungsposition[],
): void {
  if (rechnung.status !== "entwurf") {
    throw new Error("Nur Entwürfe können festgeschrieben werden.");
  }
  if (rechnung.rechnungsnummer) {
    throw new Error(
      "Rechnung hat bereits eine Rechnungsnummer (Nummernkreis wurde verbraucht).",
    );
  }
  if (rechnung.journal_eintrag) {
    throw new Error("Rechnung ist bereits mit einem Journal-Eintrag verknüpft.");
  }
  if (!rechnung.kunde) {
    throw new Error("Kund:in ist für die Festschreibung erforderlich.");
  }
  if (!positionen.length) {
    throw new Error("Mindestens eine Position ist für die Festschreibung erforderlich.");
  }
  if (money(rechnung.betrag_brutto).lte(0)) {
    throw new Error("Rechnungsbetrag muss größer als 0 sein.");
  }
}

/**
 * Vorschau-PDF: dieselben Voraussetzungen wie Festschreiben
 * (Kund:in, Positionen), aber ohne Nummer und ohne Journal.
 */
export function assertCanPreviewRechnungPdf(
  rechnung: Rechnung,
  positionen: Rechnungsposition[],
): void {
  assertCanFestschreiben(rechnung, positionen);
}

/** Gespeichertes Original-PDF nur nach Festschreibung. */
export function assertCanServeOriginalRechnungPdf(
  rechnung: Pick<Rechnung, "status" | "pdf">,
): void {
  if (rechnung.status === "entwurf") {
    throw new Error(PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR);
  }
  if (!rechnung.pdf) {
    throw new Error("Kein PDF an der Rechnung.");
  }
}

export function assertRechnungVorschauNurEntwurf(
  rechnung: Pick<Rechnung, "status">,
): void {
  if (rechnung.status !== "entwurf") {
    throw new Error(PDF_VORSCHAU_NUR_ENTWURF_ERROR);
  }
}

/**
 * Invariante: Entwurf hat keine Rechnungsnummer (Nummern erst bei Festschreibung).
 */
export function assertEntwurfOhneNummer(
  rechnung: Pick<Rechnung, "status" | "rechnungsnummer">,
): void {
  if (rechnung.status === "entwurf" && rechnung.rechnungsnummer) {
    throw new Error(
      "Entwurf darf keine Rechnungsnummer haben (Nummernvergabe erst bei Festschreibung).",
    );
  }
}

export function buildBuchungstextFromRechnung(opts: {
  rechnungsnummer: string;
  kundeName?: string;
  notiz?: string;
}): string {
  const parts: string[] = [];
  if (opts.rechnungsnummer) {
    parts.push(`Rechnung ${opts.rechnungsnummer}`);
  } else {
    parts.push("Rechnung");
  }
  if (opts.kundeName) {
    parts.push(opts.kundeName);
  }
  if (opts.notiz) {
    parts.push(opts.notiz);
  }
  return parts.join(" — ").slice(0, 500);
}

/**
 * Einheitlicher USt-Satz der Positionen für das Journal.
 * Regelbesteuerung: nur wenn alle Positionen denselben Satz 0/7/19 haben.
 * Gemischt oder leer → leer (kein erzwungener Einzel-Satz, keine Kopf-Schätzung).
 * Kleinunternehmerregelung: immer leer.
 */
export function einheitlicherSteuersatz(
  positionen: Array<{ steuersatz?: Steuersatz | "" }>,
  steuermodus: Steuermodus,
): Steuersatz | "" {
  if (steuermodus !== "regelbesteuerung_ist") return "";
  if (positionen.length === 0) return "";

  let gefunden: Steuersatz | "" | null = null;
  for (const p of positionen) {
    const satz: Steuersatz | "" =
      p.steuersatz && VALID_STEUERSATZ.has(p.steuersatz)
        ? (p.steuersatz as Steuersatz)
        : "";
    if (gefunden === null) {
      gefunden = satz;
      continue;
    }
    if (satz !== gefunden) return "";
  }
  return gefunden ?? "";
}

export type UstStaffelZeile = {
  steuersatz: Steuersatz | "";
  betrag_netto: string;
  betrag_ust: string;
};

const UST_STAFFEL_REIHENFOLGE: Array<Steuersatz | ""> = ["19", "7", "0", ""];

/**
 * USt-Ausweis je Steuersatz (Bemessungsgrundlage + Steuerbetrag).
 * § 14 Abs. 4 UStG: Satz, Entgelt und Steuerbetrag; bei mehreren Sätzen getrennt.
 */
export function ustStaffelAusPositionen(
  positionen: Array<{
    steuersatz?: Steuersatz | "";
    betrag_netto: string;
    betrag_ust: string;
  }>,
): UstStaffelZeile[] {
  const buckets = new Map<string, { netto: Decimal; ust: Decimal }>();
  for (const p of positionen) {
    const satz: Steuersatz | "" =
      p.steuersatz && VALID_STEUERSATZ.has(p.steuersatz)
        ? (p.steuersatz as Steuersatz)
        : "";
    const cur = buckets.get(satz) ?? { netto: money(0), ust: money(0) };
    cur.netto = cur.netto.plus(money(p.betrag_netto));
    cur.ust = cur.ust.plus(money(p.betrag_ust));
    buckets.set(satz, cur);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const ia = UST_STAFFEL_REIHENFOLGE.indexOf(a as Steuersatz | "");
      const ib = UST_STAFFEL_REIHENFOLGE.indexOf(b as Steuersatz | "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([satz, b]) => ({
      steuersatz: satz as Steuersatz | "",
      betrag_netto: moneyToString(roundMoney(b.netto)),
      betrag_ust: moneyToString(roundMoney(b.ust)),
    }));
}

/**
 * Journal-Eingabe aus festzuschreibender Rechnung (Einnahme).
 * Steuersatz kommt aus den Positionen (einheitlich), nicht aus Kopf-USt geraten.
 */
export function buildJournalInputFromRechnung(
  rechnung: Rechnung,
  opts: {
    rechnungId: string;
    rechnungsnummer: string;
    kundeName?: string;
    positionen?: Array<{ steuersatz?: Steuersatz | "" }>;
  },
): JournalBuchungInput {
  const text = buildBuchungstextFromRechnung({
    rechnungsnummer: opts.rechnungsnummer,
    kundeName: opts.kundeName,
    notiz: rechnung.notiz,
  });

  return {
    buchungsdatum: rechnung.rechnungsdatum,
    belegdatum: rechnung.rechnungsdatum,
    buchungstext: text,
    richtung: "einnahme",
    betrag_netto: rechnung.betrag_netto,
    betrag_ust: rechnung.betrag_ust,
    betrag_brutto: rechnung.betrag_brutto,
    steuersatz: einheitlicherSteuersatz(
      opts.positionen ?? [],
      rechnung.steuermodus,
    ),
    kontakt: rechnung.kunde,
    quelle_typ: "rechnung",
    quelle_id: opts.rechnungId,
  };
}

export function parseStatus(raw: string): RechnungStatus | "" {
  return VALID_STATUS.has(raw as RechnungStatus)
    ? (raw as RechnungStatus)
    : "";
}

/** Default-Fälligkeit: Rechnungsdatum + 14 Tage (Europe/Berlin Kalender). */
export function defaultFaelligAm(rechnungsdatum: string): string {
  if (!isValidIsoDate(rechnungsdatum)) return "";
  const [y, m, d] = rechnungsdatum.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 14);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Angebote — Entwurf vs. Gesendet, Status-Übergänge (kein Journal)
// ---------------------------------------------------------------------------

const VALID_ANGEBOT_STATUS = new Set<AngebotStatus>([
  "entwurf",
  "gesendet",
  "angenommen",
  "abgelehnt",
  "abgelaufen",
  "abgerechnet",
]);

/** Manuell erlaubte Ziel-Status nach dem Senden */
const VALID_STATUS_ZIEL = new Set<AngebotStatusZiel>([
  "angenommen",
  "abgelehnt",
  "abgelaufen",
  "abgerechnet",
]);

/**
 * Erlaubte Statusübergänge (light, manuell).
 * entwurf → gesendet nur über sendenAngebot (nicht setStatus).
 */
export const ANGEBOT_STATUS_TRANSITIONS: Record<
  AngebotStatus,
  AngebotStatus[]
> = {
  entwurf: [], // nur über Senden
  gesendet: ["angenommen", "abgelehnt", "abgelaufen"],
  angenommen: ["abgerechnet", "abgelehnt", "abgelaufen"],
  abgelehnt: [],
  abgelaufen: [],
  abgerechnet: [],
};

export const ANGEBOT_GESENDET_ERROR =
  "Gesendete Angebote dürfen nicht still geändert oder gelöscht werden. Statuswechsel ist möglich.";

export const ANGEBOT_PDF_IMMUTABLE_ERROR =
  "Das Angebots-PDF ist nach dem Senden unveränderbar (ADR-0012).";

export type ValidatedAngebotInput = {
  kunde: string | null;
  angebotsdatum: string;
  gueltig_bis: string;
  notiz: string;
  positionen: ValidatedPosition[];
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
};

/** Validiert Angebotsposition — gleiche Summenlogik wie Rechnung. */
export function validateAngebotspositionInput(
  input: AngebotspositionInput,
  steuermodus: Steuermodus,
  sortierung: number,
): ValidatedPosition {
  return validatePositionInput(input, steuermodus, sortierung);
}

/** Validiert Angebotskopf + Positionen (Entwurf). */
export function validateAngebotInput(
  input: AngebotInput,
  steuermodus: Steuermodus,
): ValidatedAngebotInput {
  if (!VALID_STEUERMODUS.has(steuermodus)) {
    throw new Error("Ungültiger Steuer-Modus.");
  }

  const angebotsdatum = (input.angebotsdatum ?? "").trim();
  if (!isValidIsoDate(angebotsdatum)) {
    throw new Error("Angebotsdatum muss YYYY-MM-DD sein.");
  }

  const gueltig_bis = (input.gueltig_bis ?? "").trim();
  if (gueltig_bis && !isValidIsoDate(gueltig_bis)) {
    throw new Error("Gültig-bis muss YYYY-MM-DD sein.");
  }
  if (gueltig_bis && gueltig_bis < angebotsdatum) {
    throw new Error("Gültig-bis darf nicht vor dem Angebotsdatum liegen.");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const rawPositions = input.positionen ?? [];
  const nonEmpty = rawPositions.filter(
    (p) =>
      (p.bezeichnung ?? "").trim() ||
      (p.menge ?? "").trim() ||
      (p.einzelpreis ?? "").trim(),
  );

  if (nonEmpty.length === 0) {
    throw new Error("Mindestens eine Position ist erforderlich.");
  }

  // sortierung 1-basiert: PocketBase required number behandelt 0 als „blank“
  const positionen = nonEmpty.map((p, i) =>
    validateAngebotspositionInput(p, steuermodus, i + 1),
  );

  const sums = sumPositionen(positionen);
  if (money(sums.betrag_brutto).lte(0)) {
    throw new Error("Angebotsbetrag (Brutto) muss größer als 0 sein.");
  }

  const kunde = input.kunde?.trim() || null;

  return {
    kunde,
    angebotsdatum,
    gueltig_bis,
    notiz,
    positionen,
    ...sums,
  };
}

export function isAngebotEntwurf(a: Pick<Angebot, "status">): boolean {
  return a.status === "entwurf";
}

/** Inhalt/PDF final (nach Senden) — Statuswechsel bleiben erlaubt. */
export function isAngebotFinalisiert(a: Pick<Angebot, "status">): boolean {
  return a.status !== "entwurf";
}

export function assertAngebotEntwurfEditable(
  a: Pick<Angebot, "status">,
): void {
  if (!isAngebotEntwurf(a)) {
    throw new Error(ANGEBOT_GESENDET_ERROR);
  }
}

/**
 * Senden nur für Entwürfe ohne Nummer.
 * Kund:in und Positionen mit positivem Betrag erforderlich.
 */
export function assertCanSenden(
  angebot: Angebot,
  positionen: Angebotsposition[],
): void {
  if (angebot.status !== "entwurf") {
    throw new Error("Nur Entwürfe können gesendet werden.");
  }
  if (angebot.angebotsnummer) {
    throw new Error(
      "Angebot hat bereits eine Angebotsnummer (Nummernkreis wurde verbraucht).",
    );
  }
  if (!angebot.kunde) {
    throw new Error("Kund:in ist für das Senden erforderlich.");
  }
  if (!positionen.length) {
    throw new Error("Mindestens eine Position ist für das Senden erforderlich.");
  }
  if (money(angebot.betrag_brutto).lte(0)) {
    throw new Error("Angebotsbetrag muss größer als 0 sein.");
  }
}

/**
 * Vorschau-PDF: dieselben Voraussetzungen wie Senden,
 * ohne Nummernverbrauch und ohne Persistenz.
 */
export function assertCanPreviewAngebotPdf(
  angebot: Angebot,
  positionen: Angebotsposition[],
): void {
  assertCanSenden(angebot, positionen);
}

/** Gespeichertes Original-PDF nur nach dem Senden. */
export function assertCanServeOriginalAngebotPdf(
  angebot: Pick<Angebot, "status" | "pdf">,
): void {
  if (angebot.status === "entwurf") {
    throw new Error(PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR);
  }
  if (!angebot.pdf) {
    throw new Error("Kein PDF am Angebot.");
  }
}

export function assertAngebotVorschauNurEntwurf(
  angebot: Pick<Angebot, "status">,
): void {
  if (angebot.status !== "entwurf") {
    throw new Error(PDF_VORSCHAU_NUR_ENTWURF_ERROR);
  }
}

/**
 * Invariante: Entwurf hat keine Angebotsnummer (Nummern erst beim Senden).
 */
export function assertAngebotEntwurfOhneNummer(
  angebot: Pick<Angebot, "status" | "angebotsnummer">,
): void {
  if (angebot.status === "entwurf" && angebot.angebotsnummer) {
    throw new Error(
      "Entwurf darf keine Angebotsnummer haben (Nummernvergabe erst beim Senden).",
    );
  }
}

/**
 * Statuswechsel light: nur erlaubte Übergänge; kein Inhalts-Edit.
 */
export function assertCanChangeAngebotStatus(
  angebot: Angebot,
  ziel: AngebotStatus,
): void {
  if (angebot.status === "entwurf") {
    throw new Error(
      "Entwürfe erhalten den Status „Gesendet“ nur über Senden (Nummer + PDF).",
    );
  }
  if (!VALID_ANGEBOT_STATUS.has(ziel)) {
    throw new Error("Ungültiger Angebotsstatus.");
  }
  if (ziel === "entwurf" || ziel === "gesendet") {
    throw new Error("Dieser Status kann nicht manuell gesetzt werden.");
  }
  const allowed = ANGEBOT_STATUS_TRANSITIONS[angebot.status] ?? [];
  if (!allowed.includes(ziel)) {
    throw new Error(
      `Statuswechsel von „${angebot.status}“ nach „${ziel}“ ist nicht erlaubt.`,
    );
  }
}

/** Übernahme in Rechnung: nur angenommene Angebote ohne bestehende Rechnung. */
export function assertCanUebernehmenInRechnung(angebot: Angebot): void {
  if (angebot.status !== "angenommen") {
    throw new Error(
      "Nur angenommene Angebote können als Rechnung übernommen werden.",
    );
  }
  if (angebot.rechnung) {
    throw new Error("Dieses Angebot ist bereits mit einer Rechnung verknüpft.");
  }
  if (!angebot.kunde) {
    throw new Error("Kund:in fehlt am Angebot.");
  }
}

/** Default Gültig-bis: Angebotsdatum + 30 Tage. */
export function defaultGueltigBis(angebotsdatum: string): string {
  if (!isValidIsoDate(angebotsdatum)) return "";
  const [y, m, d] = angebotsdatum.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 30);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function parseAngebotStatus(raw: string): AngebotStatus | "" {
  return VALID_ANGEBOT_STATUS.has(raw as AngebotStatus)
    ? (raw as AngebotStatus)
    : "";
}

export function parseAngebotStatusZiel(raw: string): AngebotStatusZiel | "" {
  return VALID_STATUS_ZIEL.has(raw as AngebotStatusZiel)
    ? (raw as AngebotStatusZiel)
    : "";
}
