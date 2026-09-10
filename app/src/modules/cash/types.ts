/**
 * Domain-Typen: Kassenbuch (Bareinnahmen/-ausgaben, fortlaufender Saldo)
 * Anlegen = Festschreibung; fließt ins Buchungsjournal (quelle_typ=kasse).
 * Getrennt von Bankkonten (Abschn. 11). Eine Kasse pro Firma in v1 light.
 */

import type { Buchungsrichtung, Steuersatz } from "@/modules/journal/types";

export type { Buchungsrichtung, Steuersatz };

/** Festgeschriebener Kassenbuch-Eintrag (unveränderbar; Korrektur = Storno) */
export type KassenbuchEintrag = {
  id: string;
  firma: string;
  /** YYYY-MM-DD */
  datum: string;
  richtung: Buchungsrichtung;
  betrag_netto: string;
  betrag_ust: string;
  /** Kassenwirksamer Betrag — Grundlage für den Saldo */
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
  /** Buchungstext / Beschreibung */
  text: string;
  kategorie: string;
  notiz: string;
  kontakt: string | null;
  /** Aus Nummernkreis Firma (bei Festschreibung) */
  belegnummer: string;
  /** Verweis auf Journal-Eintrag */
  journal_eintrag: string | null;
  /** ISO-8601 UTC */
  festgeschrieben_am: string;
  /** Gegenbuchung: Verweis auf stornierten Eintrag */
  storno_von: string | null;
  created?: string;
  updated?: string;
};

/**
 * Eingabe Bareinnahme/Barausgabe.
 * Kein Entwurf — Anlegen = Festschreibung.
 */
export type KassenbuchInput = {
  datum: string;
  richtung: Buchungsrichtung;
  /** Brutto- oder Netto-Eingabe; Repository normalisiert */
  betrag_netto?: string;
  betrag_ust?: string;
  betrag_brutto?: string;
  steuersatz?: Steuersatz | "";
  text: string;
  kategorie?: string;
  notiz?: string;
  kontakt?: string | null;
};

export type KassenbuchFilter = {
  q?: string;
  richtung?: Buchungsrichtung | "";
  /** YYYY-MM-DD inklusiv */
  von?: string;
  bis?: string;
};

export type KassenbuchListResult = {
  items: KassenbuchEintrag[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Aktueller Kassensaldo (alle Einträge, chronologisch) */
  saldo: string;
};

/** Eintrag inkl. fortlaufendem Saldo nach diesem Eintrag (chronologisch) */
export type KassenbuchEintragMitSaldo = KassenbuchEintrag & {
  saldo_nach: string;
};
