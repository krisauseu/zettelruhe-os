/**
 * Reine Aggregationen über Journal-Zeilen (ohne I/O).
 * Journal = Source of Truth für gebuchte Beträge (ADR-0004).
 *
 * Storno ist eine Gegenbuchung (invertierte Richtung, absolute Beträge).
 * In Auswertungen mindert der Storno die Ursprungskategorie — er darf nicht
 * als Gegenrichtung (Ausgabe-Storno → Einnahme, Rechnungs-Storno → Ausgabe)
 * in die Summen einfließen. Sonst stimmt nur der Überschuss, nicht EÜR/USt.
 */

import {
  money,
  moneyToString,
  percentOf,
  roundMoney,
  subMoney,
  sumMoney,
} from "@/lib/money";
import { invertRichtung } from "@/modules/journal/invariants";
import type {
  Buchungsrichtung,
  JournalEintrag,
  QuelleTyp,
  Steuersatz,
} from "@/modules/journal/types";
import type { Steuermodus } from "@/lib/pb";
import type {
  BwaLight,
  DashboardKennzahlen,
  EurAuswertung,
  EurKategorieId,
  EurKategorieZeile,
  UstSatzZeile,
  UstUebersicht,
  Zeitraum,
} from "./types";

export const JOURNAL_BASIS_HINWEIS =
  "Grundlage ist das festgeschriebene Buchungsjournal nach Zufluss (Ist-Versteuerung / EÜR). Einnahmen aus Rechnungen zählen mit dem Zahlungsdatum (Quelle Zahlung), nicht mit dem Rechnungsdatum. Die Forderungsbuchung zur Festschreibung (Quelle Rechnung) bleibt im Journal sichtbar, fließt hier aber nicht ein. Belege, Kassenbuch und manuelle Buchungen zählen mit ihrem Buchungsdatum.";

const EUR_META: Record<
  EurKategorieId,
  { label: string; richtung: "einnahme" | "ausgabe" }
> = {
  umsatzerloese: {
    label: "Umsatzerlöse (Zahlungen auf Rechnungen)",
    richtung: "einnahme",
  },
  bareinnahmen: { label: "Bareinnahmen (Kassenbuch)", richtung: "einnahme" },
  sonstige_einnahmen: {
    label: "Sonstige Einnahmen",
    richtung: "einnahme",
  },
  betriebsausgaben: {
    label: "Betriebsausgaben (Belege)",
    richtung: "ausgabe",
  },
  barausgaben: { label: "Barausgaben (Kassenbuch)", richtung: "ausgabe" },
  sonstige_ausgaben: { label: "Sonstige Ausgaben", richtung: "ausgabe" },
};

export function isStornoEintrag(
  e: Pick<JournalEintrag, "quelle_typ" | "storno_von">,
): boolean {
  return e.quelle_typ === "storno" || Boolean(e.storno_von);
}

/**
 * EÜR / USt / ZM / DATEV: Zufluss, keine Forderungsbuchung der Rechnung.
 * Storno folgt dem Original (Rechnung-Storno bleibt außen vor).
 */
export function istZuflussRelevant(
  e: Pick<JournalEintrag, "quelle_typ" | "storno_von">,
  originals?: Map<string, JournalEintrag>,
): boolean {
  if (isStornoEintrag(e)) {
    const orig = e.storno_von ? originals?.get(e.storno_von) : undefined;
    if (orig) return istZuflussRelevant(orig, originals);
    return true;
  }
  return e.quelle_typ !== "rechnung";
}

export function filterZuflussJournal(
  eintraege: JournalEintrag[],
  extraOriginale: JournalEintrag[] = [],
): JournalEintrag[] {
  const originals = originalsMap(eintraege, extraOriginale);
  return eintraege.filter((e) => istZuflussRelevant(e, originals));
}

export function indexJournalById(
  eintraege: JournalEintrag[],
): Map<string, JournalEintrag> {
  const map = new Map<string, JournalEintrag>();
  for (const e of eintraege) {
    map.set(e.id, e);
  }
  return map;
}

function quelleFuerKategorie(quelle_typ: QuelleTyp): QuelleTyp {
  return quelle_typ === "storno" ? "manuell" : quelle_typ;
}

/** Light-Mapping Richtung + Quelle → EÜR-Kategorie (ohne Storno-Auflösung). */
export function mapEurKategorieFromQuelle(
  richtung: Buchungsrichtung,
  quelle_typ: QuelleTyp,
): EurKategorieId {
  const quelle = quelleFuerKategorie(quelle_typ);
  if (richtung === "einnahme") {
    if (quelle === "rechnung" || quelle === "zahlung") return "umsatzerloese";
    if (quelle === "kasse") return "bareinnahmen";
    return "sonstige_einnahmen";
  }
  if (quelle === "beleg") return "betriebsausgaben";
  if (quelle === "kasse") return "barausgaben";
  return "sonstige_ausgaben";
}

/**
 * EÜR-Kategorie der wirtschaftlichen Herkunft.
 * Storno → Kategorie des Originals (Lookup oder rekonstruierte Richtung).
 */
export function mapEurKategorie(
  e: JournalEintrag,
  originals?: Map<string, JournalEintrag>,
): EurKategorieId {
  if (isStornoEintrag(e)) {
    const orig = e.storno_von ? originals?.get(e.storno_von) : undefined;
    if (orig) {
      return mapEurKategorieFromQuelle(orig.richtung, orig.quelle_typ);
    }
    if (e.quelle_typ !== "storno") {
      return mapEurKategorieFromQuelle(invertRichtung(e.richtung), e.quelle_typ);
    }
    return mapEurKategorieFromQuelle(invertRichtung(e.richtung), "manuell");
  }
  return mapEurKategorieFromQuelle(e.richtung, e.quelle_typ);
}

/** Wirtschaftliche Richtung vor dem Storno (für BWA/USt). */
export function wirtschaftlicheRichtung(
  e: JournalEintrag,
  originals?: Map<string, JournalEintrag>,
): Buchungsrichtung {
  if (!isStornoEintrag(e)) return e.richtung;
  const orig = e.storno_von ? originals?.get(e.storno_von) : undefined;
  if (orig) return orig.richtung;
  return invertRichtung(e.richtung);
}

function emptyKategorie(id: EurKategorieId): EurKategorieZeile {
  const meta = EUR_META[id];
  return {
    id,
    label: meta.label,
    richtung: meta.richtung,
    summe_brutto: "0.00",
    summe_netto: "0.00",
    summe_ust: "0.00",
    anzahl: 0,
  };
}

type Acc = {
  brutto: ReturnType<typeof money>;
  netto: ReturnType<typeof money>;
  ust: ReturnType<typeof money>;
  anzahl: number;
};

function emptyAcc(): Acc {
  return { brutto: money(0), netto: money(0), ust: money(0), anzahl: 0 };
}

function accAdd(a: Acc, e: JournalEintrag, sign: 1 | -1): void {
  const faktor = sign === 1 ? 1 : -1;
  a.brutto = a.brutto.plus(money(e.betrag_brutto).times(faktor));
  a.netto = a.netto.plus(money(e.betrag_netto).times(faktor));
  a.ust = a.ust.plus(money(e.betrag_ust).times(faktor));
  if (sign === 1) {
    a.anzahl += 1;
  } else if (a.anzahl > 0) {
    a.anzahl -= 1;
  }
}

function originalsMap(
  eintraege: JournalEintrag[],
  extraOriginale: JournalEintrag[] = [],
): Map<string, JournalEintrag> {
  return indexJournalById([...extraOriginale, ...eintraege]);
}

function accToZeile(id: EurKategorieId, a: Acc): EurKategorieZeile {
  const base = emptyKategorie(id);
  return {
    ...base,
    summe_brutto: moneyToString(a.brutto),
    summe_netto: moneyToString(a.netto),
    summe_ust: moneyToString(a.ust),
    anzahl: a.anzahl,
  };
}

/**
 * EÜR light aus Journal-Zeilen (bereits zeitraum-gefiltert).
 * `extraOriginale` nur für Kategorie-Lookup, wenn das Original außerhalb
 * des Zeitraums liegt — Beträge dieser Zeilen fließen nicht ein.
 */
export function buildEur(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  extraOriginale: JournalEintrag[] = [],
): EurAuswertung {
  const ids = Object.keys(EUR_META) as EurKategorieId[];
  const map = new Map<EurKategorieId, Acc>();
  for (const id of ids) map.set(id, emptyAcc());

  const originals = originalsMap(eintraege, extraOriginale);
  const relevant = eintraege.filter((e) => istZuflussRelevant(e, originals));
  for (const e of relevant) {
    const kat = mapEurKategorie(e, originals);
    const sign: 1 | -1 = isStornoEintrag(e) ? -1 : 1;
    accAdd(map.get(kat)!, e, sign);
  }

  const einnahmenIds: EurKategorieId[] = [
    "umsatzerloese",
    "bareinnahmen",
    "sonstige_einnahmen",
  ];
  const ausgabenIds: EurKategorieId[] = [
    "betriebsausgaben",
    "barausgaben",
    "sonstige_ausgaben",
  ];

  const einnahmen = einnahmenIds.map((id) => accToZeile(id, map.get(id)!));
  const ausgaben = ausgabenIds.map((id) => accToZeile(id, map.get(id)!));

  const sumEinB = sumMoney(...einnahmen.map((z) => z.summe_brutto));
  const sumAusB = sumMoney(...ausgaben.map((z) => z.summe_brutto));
  const sumEinN = sumMoney(...einnahmen.map((z) => z.summe_netto));
  const sumAusN = sumMoney(...ausgaben.map((z) => z.summe_netto));

  return {
    zeitraum,
    einnahmen,
    ausgaben,
    summe_einnahmen_brutto: moneyToString(sumEinB),
    summe_ausgaben_brutto: moneyToString(sumAusB),
    ueberschuss_brutto: moneyToString(subMoney(sumEinB, sumAusB)),
    summe_einnahmen_netto: moneyToString(sumEinN),
    summe_ausgaben_netto: moneyToString(sumAusN),
    ueberschuss_netto: moneyToString(subMoney(sumEinN, sumAusN)),
    anzahl_buchungen: relevant.length,
    hinweis_journal_basis: JOURNAL_BASIS_HINWEIS,
  };
}

/**
 * Satz 19/7 aus Journal-Beträgen, wenn das Feld leer ist.
 * Nur bei exakter Übereinstimmung mit percentOf/roundMoney (wie auf der Rechnung).
 * 0 % wird nicht geraten (0-USt vs. ohne Satz vs. Kleinunternehmerregelung).
 * Gemischte Sätze auf einer Zeile bleiben „ohne“.
 */
export function inferSteuersatzFromBetraege(
  betrag_netto: string,
  betrag_ust: string,
): Steuersatz | "" {
  const netto = money(betrag_netto);
  const ust = money(betrag_ust);
  if (!netto.gt(0) || !ust.gt(0)) return "";
  const ustStr = moneyToString(ust);
  for (const satz of ["19", "7"] as const) {
    if (moneyToString(roundMoney(percentOf(netto, satz))) === ustStr) {
      return satz;
    }
  }
  return "";
}

function steuersatzKey(e: JournalEintrag): Steuersatz | "ohne" {
  if (e.steuersatz === "0" || e.steuersatz === "7" || e.steuersatz === "19") {
    return e.steuersatz;
  }
  const inferred = inferSteuersatzFromBetraege(e.betrag_netto, e.betrag_ust);
  if (inferred === "7" || inferred === "19") return inferred;
  return "ohne";
}

/** USt-Übersicht light — nur bei Regelbesteuerung sinnvoll */
export function buildUstUebersicht(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  steuermodus: Steuermodus,
  extraOriginale: JournalEintrag[] = [],
): UstUebersicht {
  const rc = {
    vorhanden: false,
    anzahl: 0,
    grundlage_eu: money(0),
    schuld_eu: money(0),
    grundlage_drittland: money(0),
    schuld_drittland: money(0),
    vorsteuer: money(0),
  };
  for (const e of eintraege) {
    const snapshot = e.rc;
    const steuerdatum = e.rc_steuerdatum || snapshot?.steuerdatum;
    if (!snapshot || !steuerdatum || steuerdatum < zeitraum.von || steuerdatum > zeitraum.bis) continue;
    rc.vorhanden = true;
    rc.anzahl += 1;
    if (snapshot.tatbestand === "eu_dienstleistung") {
      rc.grundlage_eu = rc.grundlage_eu.plus(money(snapshot.grundlage));
      rc.schuld_eu = rc.schuld_eu.plus(money(snapshot.schuld));
    } else {
      rc.grundlage_drittland = rc.grundlage_drittland.plus(money(snapshot.grundlage));
      rc.schuld_drittland = rc.schuld_drittland.plus(money(snapshot.schuld));
    }
    rc.vorsteuer = rc.vorsteuer.plus(money(snapshot.vorsteuer));
  }
  const rcOutput = {
    vorhanden: rc.vorhanden,
    anzahl: rc.anzahl,
    grundlage_eu: moneyToString(rc.grundlage_eu),
    schuld_eu: moneyToString(rc.schuld_eu),
    grundlage_drittland: moneyToString(rc.grundlage_drittland),
    schuld_drittland: moneyToString(rc.schuld_drittland),
    vorsteuer: moneyToString(rc.vorsteuer),
  };

  if (steuermodus === "kleinunternehmer" && !rc.vorhanden) {
    return {
      zeitraum,
      steuermodus,
      verfuegbar: false,
      zeilen: [],
      summe_ust_einnahmen: "0.00",
      summe_vorsteuer: "0.00",
      reverse_charge: rcOutput,
      zahllast: "0.00",
      hinweis:
        "Unter der Kleinunternehmerregelung (§ 19 UStG) entfällt der normale USt-Arbeitsflow. Reverse-Charge-Fälle können trotzdem eine Erklärung und Zahlung erfordern.",
    };
  }

  type UAcc = {
    ust_einnahmen: ReturnType<typeof money>;
    vorsteuer: ReturnType<typeof money>;
    netto_einnahmen: ReturnType<typeof money>;
    netto_ausgaben: ReturnType<typeof money>;
  };
  const bySatz = new Map<Steuersatz | "ohne", UAcc>();

  function get(s: Steuersatz | "ohne"): UAcc {
    let a = bySatz.get(s);
    if (!a) {
      a = {
        ust_einnahmen: money(0),
        vorsteuer: money(0),
        netto_einnahmen: money(0),
        netto_ausgaben: money(0),
      };
      bySatz.set(s, a);
    }
    return a;
  }

  const originals = originalsMap(eintraege, extraOriginale);
  for (const e of steuermodus === "kleinunternehmer" ? [] : eintraege) {
    if (!istZuflussRelevant(e, originals)) continue;
    const k = steuersatzKey(e);
    const a = get(k);
    const richtung = wirtschaftlicheRichtung(e, originals);
    const faktor = isStornoEintrag(e) ? -1 : 1;
    if (richtung === "einnahme") {
      a.ust_einnahmen = a.ust_einnahmen.plus(money(e.betrag_ust).times(faktor));
      a.netto_einnahmen = a.netto_einnahmen.plus(
        money(e.betrag_netto).times(faktor),
      );
    } else {
      a.vorsteuer = a.vorsteuer.plus(money(e.betrag_ust).times(faktor));
      a.netto_ausgaben = a.netto_ausgaben.plus(
        money(e.betrag_netto).times(faktor),
      );
    }
  }

  const order: (Steuersatz | "ohne")[] = ["19", "7", "0", "ohne"];
  const zeilen: UstSatzZeile[] = [];
  for (const s of order) {
    const a = bySatz.get(s);
    if (!a) continue;
    if (
      a.ust_einnahmen.isZero() &&
      a.vorsteuer.isZero() &&
      a.netto_einnahmen.isZero() &&
      a.netto_ausgaben.isZero()
    ) {
      continue;
    }
    zeilen.push({
      steuersatz: s,
      ust_einnahmen: moneyToString(a.ust_einnahmen),
      vorsteuer: moneyToString(a.vorsteuer),
      netto_einnahmen: moneyToString(a.netto_einnahmen),
      netto_ausgaben: moneyToString(a.netto_ausgaben),
    });
  }

  const sumUst = sumMoney(...zeilen.map((z) => z.ust_einnahmen));
  const sumVst = sumMoney(...zeilen.map((z) => z.vorsteuer));
  const rcSchuld = rc.schuld_eu.plus(rc.schuld_drittland);
  const zahllast = subMoney(sumUst.plus(rcSchuld), sumVst.plus(rc.vorsteuer));

  return {
    zeitraum,
    steuermodus,
    verfuegbar: true,
    zeilen,
    summe_ust_einnahmen: moneyToString(sumUst),
    summe_vorsteuer: moneyToString(sumVst),
    reverse_charge: rcOutput,
    zahllast: moneyToString(zahllast),
    hinweis:
      steuermodus === "kleinunternehmer"
        ? "Begrenzte RC-Übersicht unter § 19 UStG. Eigene Umsätze und allgemeine Vorsteuer bleiben gesperrt; nur gespeicherte RC-Schnappschüsse werden ausgewertet. Kein ELSTER-Versand."
        : "USt-Übersicht light aus dem Buchungsjournal. Normale Umsätze folgen dem Buchungsdatum, Reverse Charge dem gespeicherten Steuerdatum. Vorbereitung für Mein Elster, kein ELSTER-Versand. " + JOURNAL_BASIS_HINWEIS,
  };
}

export function buildBwaLight(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  extraOriginale: JournalEintrag[] = [],
): BwaLight {
  let ein = money(0);
  let aus = money(0);
  const originals = originalsMap(eintraege, extraOriginale);
  for (const e of eintraege) {
    if (!istZuflussRelevant(e, originals)) continue;
    const richtung = wirtschaftlicheRichtung(e, originals);
    const faktor = isStornoEintrag(e) ? -1 : 1;
    if (richtung === "einnahme") {
      ein = ein.plus(money(e.betrag_brutto).times(faktor));
    } else {
      aus = aus.plus(money(e.betrag_brutto).times(faktor));
    }
  }
  return {
    zeitraum,
    einnahmen_brutto: moneyToString(ein),
    ausgaben_brutto: moneyToString(aus),
    ergebnis_brutto: moneyToString(subMoney(ein, aus)),
  };
}

export function buildDashboard(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  steuermodus: Steuermodus,
  offenePosten: { summe: string; anzahl: number },
  extraOriginale: JournalEintrag[] = [],
  ustEintraege: JournalEintrag[] = eintraege,
  ustExtraOriginale: JournalEintrag[] = extraOriginale,
): DashboardKennzahlen {
  const bwa = buildBwaLight(eintraege, zeitraum, extraOriginale);
  const ust =
    steuermodus === "regelbesteuerung_ist"
      ? buildUstUebersicht(
          ustEintraege,
          zeitraum,
          steuermodus,
          ustExtraOriginale,
        )
      : null;

  return {
    zeitraum,
    steuermodus,
    einnahmen_brutto: bwa.einnahmen_brutto,
    ausgaben_brutto: bwa.ausgaben_brutto,
    ueberschuss_brutto: bwa.ergebnis_brutto,
    offene_posten_summe: moneyToString(money(offenePosten.summe)),
    offene_posten_anzahl: offenePosten.anzahl,
    ust_zahllast: ust?.verfuegbar ? ust.zahllast : null,
    anzahl_buchungen: filterZuflussJournal(eintraege, extraOriginale).length,
  };
}

/** Summe offener Posten (decimal-sicher) */
export function sumOffenePosten(
  items: { offen: string }[],
): { summe: string; anzahl: number } {
  const summe = sumMoney(...items.map((i) => i.offen));
  return { summe: moneyToString(summe), anzahl: items.length };
}
