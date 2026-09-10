import type { AusgabenSteuerstandard } from "./steuerstandard";
/** Domain-Typen: Kontakte (Kund:innen & Lieferant:innen) */

export type Kontakt = {
  id: string;
  firma: string;
  name: string;
  /** Fortlaufende Nummer der Firma; nicht die PocketBase-ID. */
  kontaktnummer: string;
  ist_kunde: boolean;
  ist_lieferant: boolean;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
  telefon: string;
  iban: string;
  bic: string;
  ausgaben_steuerstandard?: AusgabenSteuerstandard;
  ust_id: string;
  /** Leitweg-ID (Behörde) oder Käuferreferenz (B2B) — XRechnung BT-10 */
  leitweg_id: string;
  notiz: string;
  created?: string;
  updated?: string;
};

export type KontaktInput = {
  name: string;
  ist_kunde: boolean;
  ist_lieferant: boolean;
  /** Nur Neuanlage/Import; leer = Auto-vergabe. Update ändert sie nicht. */
  kontaktnummer?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
  iban?: string;
  bic?: string;
  ausgaben_steuerstandard?: AusgabenSteuerstandard;
  ust_id?: string;
  leitweg_id?: string;
  notiz?: string;
};

export type Ansprechpartner = {
  id: string;
  firma: string;
  kontakt: string;
  name: string;
  email: string;
  telefon: string;
  position: string;
};

export type AnsprechpartnerInput = {
  name: string;
  email?: string;
  telefon?: string;
  position?: string;
};

export type KontaktFilter = {
  q?: string;
  rolle?: "kunde" | "lieferant" | "alle";
};

export type KontaktListResult = {
  items: Kontakt[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
