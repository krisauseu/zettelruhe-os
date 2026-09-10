/** Domain-Typen: USt-IdNr. und BZSt-Bestätigungsschnappschuss (ADR-0021). */

export type UstIdPruefungArt = "einfach" | "qualifiziert";
export type UstIdPruefungZiel = "firma" | "kontakt";

export type EvatrAbfrage = {
  anfragendeUstid: string;
  angefragteUstid: string;
  firmenname?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
};

export type EvatrAntwort = {
  id: string;
  anfrageZeitpunkt: string;
  status: string;
  statusMeldung: string;
  gueltigZumAnfragezeitpunkt: boolean;
  gueltigAb: string;
  gueltigBis: string;
  ergFirmenname: string;
  ergStrasse: string;
  ergPlz: string;
  ergOrt: string;
  roh: string;
};

export type UstIdPruefung = {
  id: string;
  firma: string;
  ziel_typ: UstIdPruefungZiel;
  ziel_id: string;
  art: UstIdPruefungArt;
  anfragende_ust_id: string;
  abgefragte_ust_id: string;
  bzst_id: string;
  anfrage_zeitpunkt: string;
  status: string;
  status_meldung: string;
  gueltig_zum_anfragezeitpunkt: boolean;
  gueltig_ab: string;
  gueltig_bis: string;
  erg_firmenname: string;
  erg_strasse: string;
  erg_plz: string;
  erg_ort: string;
  anfrage_name: string;
  anfrage_strasse: string;
  anfrage_plz: string;
  anfrage_ort: string;
  roh: string;
  created?: string;
};

export type UstIdPruefungInput = {
  ziel_typ: UstIdPruefungZiel;
  ziel_id: string;
  art: UstIdPruefungArt;
  anfragende_ust_id: string;
  abgefragte_ust_id: string;
  antwort: EvatrAntwort;
  anfrage_name?: string;
  anfrage_strasse?: string;
  anfrage_plz?: string;
  anfrage_ort?: string;
};

/** Letzter Schnappschuss zur aktuell gespeicherten Nummer (kein Stamm-Stempel). */
export type UstIdPruefungBlick = {
  anfrage_zeitpunkt: string;
  status: string;
  status_meldung: string;
  abgefragte_ust_id: string;
  gueltig_zum_anfragezeitpunkt: boolean;
};
