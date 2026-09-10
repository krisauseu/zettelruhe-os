/**
 * Reine Domain-Invarianten Projekte (ohne I/O).
 * Light Stammdaten: Name + Kund:in Pflicht, optional Notiz/Status aktiv.
 */

import type { ProjektInput } from "./types";

export type ValidatedProjektInput = {
  kunde: string;
  name: string;
  notiz: string;
  aktiv: boolean;
};

/** Validiert und normalisiert Projekt-Eingabe. */
export function validateProjektInput(input: ProjektInput): ValidatedProjektInput {
  const kunde = (input.kunde ?? "").trim();
  if (!kunde) {
    throw new Error("Kund:in ist erforderlich.");
  }

  const name = (input.name ?? "").trim();
  if (!name) {
    throw new Error("Name ist erforderlich.");
  }
  if (name.length > 200) {
    throw new Error("Name ist zu lang (max. 200 Zeichen).");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const aktiv = input.aktiv !== false;

  return { kunde, name, notiz, aktiv };
}
