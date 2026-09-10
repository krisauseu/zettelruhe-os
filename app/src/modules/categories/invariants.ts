/**
 * Reine Domain-Invarianten Kategorien (ohne I/O).
 */

import type { Buchungsrichtung } from "@/modules/journal/types";
import type { KategorieSelectItem } from "./types";

export const KATEGORIE_NAME_MAX = 120;

export const KATEGORIE_IN_VERWENDUNG_ERROR =
  "Kategorie wird noch an Belegen oder im Kassenbuch verwendet und kann nicht gelöscht werden. Deaktivieren Sie sie stattdessen.";

export const KATEGORIE_NAME_DOPPELT_ERROR =
  "Eine Kategorie mit diesem Namen existiert bereits.";

export const KATEGORIE_RICHTUNG_MISMATCH_ERROR =
  "Die Kategorie passt nicht zur gewählten Richtung.";

const VALID_RICHTUNG = new Set<Buchungsrichtung>(["einnahme", "ausgabe"]);

/** Trim + Whitespace zusammenziehen. */
export function normalizeKategorieName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function kategorieNameKey(name: string): string {
  return normalizeKategorieName(name).toLocaleLowerCase("de-DE");
}

export function parseKategorieRichtung(
  raw: string | undefined | null,
): Buchungsrichtung {
  return raw === "einnahme" ? "einnahme" : "ausgabe";
}

export type ValidatedKategorieInput = {
  name: string;
  richtung: Buchungsrichtung;
  aktiv: boolean;
  notiz: string;
};

export function validateKategorieInput(input: {
  name: string;
  richtung?: string;
  aktiv?: boolean;
  notiz?: string;
}): ValidatedKategorieInput {
  const name = normalizeKategorieName(input.name);
  if (!name) {
    throw new Error("Name der Kategorie ist erforderlich.");
  }
  if (name.length > KATEGORIE_NAME_MAX) {
    throw new Error(`Name ist zu lang (max. ${KATEGORIE_NAME_MAX} Zeichen).`);
  }

  const richtungRaw = (input.richtung ?? "").trim();
  const richtung: Buchungsrichtung = richtungRaw
    ? (richtungRaw as Buchungsrichtung)
    : "ausgabe";
  if (!VALID_RICHTUNG.has(richtung)) {
    throw new Error("Richtung muss Einnahme oder Ausgabe sein.");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  return {
    name,
    richtung,
    aktiv: input.aktiv !== false,
    notiz,
  };
}

/**
 * Leere Kategorie bleibt zulässig. Unbekannte Namen (Text-Schnappschuss
 * ohne Stammdaten) ebenfalls. Gefundene Stammdaten müssen zur Buchungsrichtung
 * passen.
 */
export function assertKategoriePasstZurRichtung(
  kategorieName: string,
  buchungsrichtung: Buchungsrichtung,
  kategorieRichtung: Buchungsrichtung | null,
): void {
  if (!normalizeKategorieName(kategorieName)) return;
  if (kategorieRichtung == null) return;
  if (kategorieRichtung !== buchungsrichtung) {
    throw new Error(KATEGORIE_RICHTUNG_MISMATCH_ERROR);
  }
}

/** Aktive Namen plus aktueller Schnappschuss, falls der nicht mehr in der Liste steht. */
export function kategorieNamenFuerSelect(
  namen: string[],
  aktuell?: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of namen) {
    const t = normalizeKategorieName(n);
    if (!t) continue;
    const key = kategorieNameKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  const cur = normalizeKategorieName(aktuell ?? "");
  if (cur && !seen.has(kategorieNameKey(cur))) {
    out.push(cur);
  }
  out.sort((a, b) => a.localeCompare(b, "de"));
  return out;
}

/** Aktive Stammdaten plus inaktiver aktueller Schnappschuss, falls vorhanden. */
export function kategorieSelectItemsFromStammdaten(
  kategorien: Array<{
    name: string;
    richtung: Buchungsrichtung;
    aktiv: boolean;
  }>,
  aktuell?: string,
): KategorieSelectItem[] {
  const cur = kategorieNameKey(aktuell ?? "");
  return kategorien
    .filter(
      (k) => k.aktiv || (cur !== "" && kategorieNameKey(k.name) === cur),
    )
    .map((k) => ({ name: k.name, richtung: k.richtung }));
}

/** Historischer Name, der nicht in den Stammdaten steht, mit der Ursprungsrichtung. */
export function kategorieSelectItemsMitSchnappschuss(
  items: KategorieSelectItem[],
  aktuell: string | undefined,
  aktuellRichtung: Buchungsrichtung,
): KategorieSelectItem[] {
  const cur = normalizeKategorieName(aktuell ?? "");
  if (!cur) return items;
  const key = kategorieNameKey(cur);
  if (items.some((i) => kategorieNameKey(i.name) === key)) return items;
  return [...items, { name: cur, richtung: aktuellRichtung }];
}

/**
 * Namen für eine Buchungsrichtung. `selected` ist leer, wenn `aktuell`
 * nicht zu dieser Richtung gehört (Reset bei Richtungswechsel).
 */
export function kategorienFuerRichtung(
  items: KategorieSelectItem[],
  richtung: Buchungsrichtung,
  aktuell?: string,
): { namen: string[]; selected: string } {
  const namen = kategorieNamenFuerSelect(
    items.filter((i) => i.richtung === richtung).map((i) => i.name),
  );
  const cur = normalizeKategorieName(aktuell ?? "");
  if (!cur) return { namen, selected: "" };
  const match = namen.find((n) => kategorieNameKey(n) === kategorieNameKey(cur));
  return { namen, selected: match ?? "" };
}
