/**
 * Domain-Typen: gemeinsame Kategorien für Belege und Kassenbuch (ADR-0017).
 * Persistiert als Stammdaten; am Beleg/Kassenbuch bleibt `kategorie` Text.
 * `richtung` nutzt dieselben Werte wie Beleg/Kassenbuch (`einnahme` | `ausgabe`).
 */

import type { Buchungsrichtung } from "@/modules/journal/types";

export type { Buchungsrichtung };

export type Kategorie = {
  id: string;
  firma: string;
  name: string;
  richtung: Buchungsrichtung;
  aktiv: boolean;
  notiz: string;
  created?: string;
  updated?: string;
};

export type KategorieInput = {
  name: string;
  richtung?: Buchungsrichtung;
  aktiv?: boolean;
  notiz?: string;
};

/** Eintrag für richtungsgefilterte Auswahllisten. */
export type KategorieSelectItem = {
  name: string;
  richtung: Buchungsrichtung;
};

export type KategorieFilter = {
  q?: string;
  nurAktiv?: boolean;
};

export type KategorieListResult = {
  items: Kategorie[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type KategorieVerwendung = {
  belege: number;
  kasse: number;
};
