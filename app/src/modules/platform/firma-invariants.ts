/**
 * Reine Domain-Invarianten Multi-Firma dünn (ohne I/O).
 */

import type { SkrWahl, Steuermodus } from "@/lib/pb";

export const FIRMA_NAME_MAX = 200;

export const FIRMA_NAME_DOPPELT_ERROR =
  "Eine Firma mit diesem Namen existiert bereits.";

export type NeueFirmaInput = {
  name: string;
  steuermodus: Steuermodus;
  skr: SkrWahl;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  steuernummer: string;
  ust_id: string;
};

export function normalizeFirmaName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function isDuplicateFirmaNameError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /name:.*unique/i.test(msg) || /value must be unique/i.test(msg);
}

export function validateNeueFirmaInput(input: {
  name: string;
  steuermodus: string;
  skr: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  steuernummer?: string;
  ust_id?: string;
}): NeueFirmaInput {
  const name = normalizeFirmaName(input.name);
  if (!name) {
    throw new Error("Name der Firma ist erforderlich.");
  }
  if (name.length > FIRMA_NAME_MAX) {
    throw new Error(`Name ist zu lang (max. ${FIRMA_NAME_MAX} Zeichen).`);
  }

  if (
    input.steuermodus !== "kleinunternehmer" &&
    input.steuermodus !== "regelbesteuerung_ist"
  ) {
    throw new Error("Ungültiger Steuer-Modus.");
  }

  if (input.skr !== "skr03" && input.skr !== "skr04") {
    throw new Error("Ungültige SKR-Wahl.");
  }

  const land = (input.land ?? "DE").trim().toUpperCase() || "DE";
  if (land.length !== 2) {
    throw new Error("Land muss ein ISO-Code mit 2 Buchstaben sein.");
  }

  return {
    name,
    steuermodus: input.steuermodus,
    skr: input.skr,
    strasse: (input.strasse ?? "").trim(),
    plz: (input.plz ?? "").trim(),
    ort: (input.ort ?? "").trim(),
    land,
    steuernummer: (input.steuernummer ?? "").trim(),
    ust_id: (input.ust_id ?? "").replace(/[\s.\-/]/g, "").toUpperCase(),
  };
}

/** Ziel-ID für den Firmenwechsel; leere Wahl ablehnen. */
export function validateFirmaWechselZiel(firmaId: string): string {
  const id = (firmaId ?? "").trim();
  if (!id) {
    throw new Error("Bitte eine Firma wählen.");
  }
  return id;
}
