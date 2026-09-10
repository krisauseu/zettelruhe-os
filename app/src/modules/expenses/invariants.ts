import { validateRcInput, type RcInput } from "./reverse-charge";
/**
 * Reine Domain-Invarianten Belege (ohne I/O).
 * Entwurf editierbar; nach Festschreibung immutable (ADR-0004, ADR-0012).
 */

import { money } from "@/lib/money";
import {
  isValidIsoDate,
  normalizeBetraege,
  todayBerlin,
  festschreibungsZeitpunktUtc,
  type NormalizedBetraege,
} from "@/modules/journal/invariants";
import type { JournalBuchungInput } from "@/modules/journal/types";
import {
  BELEG_DATEI_MAX_ANZAHL,
  type Beleg,
  type BelegInput,
  type BelegPartnerOption,
  type BelegStatus,
  type Buchungsrichtung,
} from "./types";

export { BELEG_DATEI_MAX_ANZAHL };

export { isValidIsoDate, todayBerlin, festschreibungsZeitpunktUtc };

const VALID_RICHTUNG = new Set<Buchungsrichtung>(["einnahme", "ausgabe"]);
const VALID_STATUS = new Set<BelegStatus>(["entwurf", "festgeschrieben"]);

/** Erlaubte MIME-Typen für Belegdateien */
export const BELEG_DATEI_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max. Dateigröße 15 MiB */
export const BELEG_DATEI_MAX_BYTES = 15 * 1024 * 1024;

export const FESTGESCHRIEBEN_ERROR =
  "Festgeschriebene Belege dürfen nicht still geändert oder gelöscht werden. Korrektur über neuen Beleg bzw. Storno im Buchungsjournal.";

export const DATEI_IMMUTABLE_ERROR =
  "Belegdateien sind nach der Festschreibung unveränderbar (ADR-0012).";

export const AUSGABE_KUNDE_ERROR =
  "Eine Ausgabe kann keiner Kund:in zugeordnet werden.";

export const EINNAHME_LIEFERANT_ERROR =
  "Eine Einnahme kann keiner Lieferant:in zugeordnet werden.";

export const PARTNER_ANLEGEN_HREF = "/app/kontakte/neu";

export type ValidatedBelegInput = {
  rc?: RcInput | null;
  belegdatum: string;
  buchungsdatum: string;
  richtung: Buchungsrichtung;
  lieferant: string | null;
  kunde: string | null;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Beleg["steuersatz"];
  kategorie: string;
  notiz: string;
  konto: string;
};

/** Validiert und normalisiert Beleg-Eingabe (Entwurf). */
export function validateBelegInput(input: BelegInput): ValidatedBelegInput {
  const belegdatum = (input.belegdatum ?? "").trim();
  if (!isValidIsoDate(belegdatum)) {
    throw new Error("Belegdatum muss YYYY-MM-DD sein.");
  }

  const buchungsdatumRaw = (input.buchungsdatum ?? "").trim();
  const buchungsdatum = buchungsdatumRaw || belegdatum;
  if (!isValidIsoDate(buchungsdatum)) {
    throw new Error("Buchungsdatum muss YYYY-MM-DD sein.");
  }

  if (!VALID_RICHTUNG.has(input.richtung)) {
    throw new Error("Richtung muss Einnahme oder Ausgabe sein.");
  }

  const betraege: NormalizedBetraege = normalizeBetraege({
    betrag_netto: input.betrag_netto,
    betrag_ust: input.betrag_ust,
    betrag_brutto: input.betrag_brutto,
    steuersatz: input.steuersatz,
  });

  if (money(betraege.betrag_brutto).isZero()) {
    throw new Error("Bruttobetrag muss größer als 0 sein.");
  }

  const kategorie = (input.kategorie ?? "").trim();
  if (kategorie.length > 120) {
    throw new Error("Kategorie ist zu lang (max. 120 Zeichen).");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Bezeichnung ist zu lang (max. 2000 Zeichen).");
  }

  const lieferant = input.lieferant?.trim() || null;
  const kunde = input.kunde?.trim() || null;
  assertPartnerPasstZurRichtung(input.richtung, lieferant, kunde);

  return {
    ...(input.rc !== undefined ? { rc: validateRcInput(input.rc) } : {}),
    belegdatum,
    buchungsdatum,
    richtung: input.richtung,
    lieferant: input.richtung === "ausgabe" ? lieferant : null,
    kunde: input.richtung === "einnahme" ? kunde : null,
    ...betraege,
    kategorie,
    notiz,
    konto: (input.konto ?? "").trim(),
  };
}

export function assertPartnerPasstZurRichtung(
  richtung: Buchungsrichtung,
  lieferant: string | null,
  kunde: string | null,
): void {
  if (richtung === "ausgabe" && kunde) {
    throw new Error(AUSGABE_KUNDE_ERROR);
  }
  if (richtung === "einnahme" && lieferant) {
    throw new Error(EINNAHME_LIEFERANT_ERROR);
  }
}

export function partnerLabelFuerRichtung(richtung: Buchungsrichtung): string {
  return richtung === "einnahme" ? "Kund:in" : "Lieferant:in";
}

export function partnerFeldFuerRichtung(
  richtung: Buchungsrichtung,
): "kunde" | "lieferant" {
  return richtung === "einnahme" ? "kunde" : "lieferant";
}

export function partnerEmptyHintFuerRichtung(
  richtung: Buchungsrichtung,
): string {
  return richtung === "einnahme"
    ? "Noch keine Kund:innen vorhanden."
    : "Noch keine Lieferant:innen vorhanden.";
}

/**
 * Optionen und Auswahl für das Partnerfeld. `selected` ist leer, wenn
 * `aktuellId` nicht zur aktuellen Richtung gehört (Reset beim Wechsel).
 */
export function partnerSelectFuerRichtung(
  lieferanten: BelegPartnerOption[],
  kunden: BelegPartnerOption[],
  richtung: Buchungsrichtung,
  aktuellId?: string,
): {
  label: string;
  fieldName: "kunde" | "lieferant";
  items: BelegPartnerOption[];
  selected: string;
  emptyHint: string;
} {
  const items = richtung === "einnahme" ? kunden : lieferanten;
  const cur = (aktuellId ?? "").trim();
  const selected = items.some((i) => i.id === cur) ? cur : "";
  return {
    label: partnerLabelFuerRichtung(richtung),
    fieldName: partnerFeldFuerRichtung(richtung),
    items,
    selected,
    emptyHint: partnerEmptyHintFuerRichtung(richtung),
  };
}

/** Kontakt-ID des Geschäftspartners gemäß Buchungsrichtung. */
export function belegPartnerId(
  beleg: Pick<Beleg, "richtung" | "lieferant" | "kunde">,
): string | null {
  return beleg.richtung === "einnahme" ? beleg.kunde : beleg.lieferant;
}

export function isEntwurf(beleg: Pick<Beleg, "status">): boolean {
  return beleg.status === "entwurf";
}

export function isFestgeschrieben(beleg: Pick<Beleg, "status">): boolean {
  return beleg.status === "festgeschrieben";
}

export function assertEntwurfEditable(beleg: Pick<Beleg, "status">): void {
  if (!isEntwurf(beleg)) {
    throw new Error(FESTGESCHRIEBEN_ERROR);
  }
}

export function assertCanFestschreiben(beleg: Beleg): void {
  if (beleg.status !== "entwurf") {
    throw new Error("Nur Entwürfe können festgeschrieben werden.");
  }
  if (beleg.journal_eintrag) {
    throw new Error("Beleg ist bereits mit einem Journal-Eintrag verknüpft.");
  }
}

/** PB-File-Feld: ein Name oder Liste → bereinigte Namensliste. */
export function normalizeBelegDateiNamen(
  raw: string | string[] | null | undefined,
): string[] {
  if (typeof raw === "string") {
    const n = raw.trim();
    return n ? [n] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => String(n).trim()).filter(Boolean);
}

export function assertBelegDateiAnzahl(
  existing: number,
  adding: number,
): void {
  if (existing + adding > BELEG_DATEI_MAX_ANZAHL) {
    throw new Error(
      `Höchstens ${BELEG_DATEI_MAX_ANZAHL} Dateien je Beleg.`,
    );
  }
}

/** Validiert Upload (MIME + Größe). */
export function validateBelegDatei(file: {
  type: string;
  size: number;
  name?: string;
}): void {
  if (!file || file.size <= 0) {
    throw new Error("Datei ist leer.");
  }
  if (file.size > BELEG_DATEI_MAX_BYTES) {
    throw new Error("Datei ist zu groß (max. 15 MB).");
  }
  const mime = (file.type || "").toLowerCase();
  // Manche Browser senden leeren type — Endung prüfen
  if (mime && !BELEG_DATEI_MIME.has(mime)) {
    throw new Error(
      "Ungültiger Dateityp. Erlaubt: PDF, JPEG, PNG, WebP, GIF.",
    );
  }
  if (!mime && file.name) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".pdf") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif");
    if (!ok) {
      throw new Error(
        "Ungültiger Dateityp. Erlaubt: PDF, JPEG, PNG, WebP, GIF.",
      );
    }
  }
}

/**
 * Buchungstext für Journal aus Beleg-Metadaten.
 */
export function buildBuchungstextFromBeleg(beleg: {
  kategorie: string;
  notiz: string;
  belegnummer?: string;
  richtung: Buchungsrichtung;
}): string {
  const parts: string[] = [];
  if (beleg.belegnummer) {
    parts.push(`Beleg ${beleg.belegnummer}`);
  }
  if (beleg.kategorie) {
    parts.push(beleg.kategorie);
  }
  if (beleg.notiz) {
    parts.push(beleg.notiz);
  }
  if (parts.length === 0) {
    parts.push(beleg.richtung === "einnahme" ? "Einnahmebeleg" : "Ausgabenbeleg");
  }
  return parts.join(" — ").slice(0, 500);
}

/**
 * Journal-Eingabe aus festzuschreibendem Beleg.
 * belegId + belegnummer werden vom Repository gesetzt.
 */
export function buildJournalInputFromBeleg(
  beleg: Beleg,
  opts: { belegId: string; belegnummer: string },
): JournalBuchungInput {
  if (beleg.rc) throw new Error("RC-Journalprojektion ausschließlich über die atomare RC-Finanzoperation.");
  const text = buildBuchungstextFromBeleg({
    ...beleg,
    belegnummer: opts.belegnummer,
  });

  return {
    buchungsdatum: beleg.buchungsdatum || beleg.belegdatum,
    belegdatum: beleg.belegdatum,
    buchungstext: text,
    richtung: beleg.richtung,
    betrag_netto: beleg.betrag_netto,
    betrag_ust: beleg.betrag_ust,
    betrag_brutto: beleg.betrag_brutto,
    steuersatz: beleg.steuersatz,
    konto: beleg.konto || undefined,
    kontakt: belegPartnerId(beleg),
    quelle_typ: "beleg",
    quelle_id: opts.belegId,
  };
}

export function parseStatus(raw: string): BelegStatus | "" {
  return VALID_STATUS.has(raw as BelegStatus) ? (raw as BelegStatus) : "";
}

/** Anzeige-Label für die Beleg-Bezeichnung; leer → Platzhalter für Altdaten. */
export function belegBezeichnungLabel(
  notiz: string | null | undefined,
): string {
  const t = (notiz ?? "").trim();
  return t || "Ohne Bezeichnung";
}
