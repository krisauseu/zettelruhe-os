/**
 * Übersicht unter den KPI-Karten: Verlauf, Fälligkeiten.
 * Reine Aggregation, kein I/O.
 */

import { money, moneyToString } from "@/lib/money";
import type {
  Buchungsrichtung,
  JournalEintrag,
  QuelleTyp,
} from "@/modules/journal/types";
import {
  buildBwaLight,
  indexJournalById,
  isStornoEintrag,
  wirtschaftlicheRichtung,
} from "./aggregate";
import {
  addDaysYmd,
  daysBetweenYmd,
  isDateInZeitraum,
  monthsInZeitraum,
  parseYmd,
  quarterOfMonth,
} from "./periods";
import type { Zeitraum } from "./types";

export type VerlaufMonat = {
  key: string;
  von: string;
  bis: string;
  jahr: number;
  monat: number;
  label_kurz: string;
  label_lang: string;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ueberschuss_brutto: string;
};

export type FaelligkeitLage = "ueberfaellig" | "faellig_bald";

export type FaelligkeitEintrag = {
  rechnungId: string;
  rechnungsnummer: string;
  kundeName: string | null;
  faellig_am: string;
  offen: string;
  status: string;
  /** Ganze Tage; 0 wenn nicht überfällig oder ohne Datum. */
  tage_verzug: number;
  lage: FaelligkeitLage;
};

export type FaelligkeitenBlick = {
  heute: string;
  horizon_tage: number;
  horizon_bis: string;
  ueberfaellig: FaelligkeitEintrag[];
  bald: FaelligkeitEintrag[];
};

export type OffenerPostenBlick = {
  rechnungId: string;
  rechnungsnummer: string;
  kundeName: string | null;
  faellig_am: string;
  offen: string;
  status: string;
};

const MONAT_KURZ = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  timeZone: "UTC",
});
const MONAT_LANG = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monatLabels(
  jahr: number,
  monat: number,
): { kurz: string; lang: string } {
  const d = new Date(Date.UTC(jahr, monat - 1, 1));
  return {
    kurz: MONAT_KURZ.format(d),
    lang: MONAT_LANG.format(d),
  };
}

/**
 * Originale außerhalb des Slices (anderer Monat derselben Ladung).
 */
function originaleFuerSlice(
  alle: JournalEintrag[],
  extra: JournalEintrag[],
): JournalEintrag[] {
  return [...extra, ...alle];
}

export function buildMonatlicheReihe(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  extraOriginale: JournalEintrag[] = [],
): VerlaufMonat[] {
  const monate = monthsInZeitraum(zeitraum);
  const extras = originaleFuerSlice(eintraege, extraOriginale);
  return monate.map((m) => {
    const slice = eintraege.filter((e) =>
      isDateInZeitraum(e.buchungsdatum, { von: m.von, bis: m.bis }),
    );
    const bwa = buildBwaLight(slice, { von: m.von, bis: m.bis }, extras);
    const labels = monatLabels(m.jahr, m.monat);
    return {
      key: m.key,
      von: m.von,
      bis: m.bis,
      jahr: m.jahr,
      monat: m.monat,
      label_kurz: labels.kurz,
      label_lang: labels.lang,
      einnahmen_brutto: bwa.einnahmen_brutto,
      ausgaben_brutto: bwa.ausgaben_brutto,
      ueberschuss_brutto: bwa.ergebnis_brutto,
    };
  });
}

export function buildFaelligkeiten(
  items: OffenerPostenBlick[],
  heute: string,
  horizonTage = 14,
): FaelligkeitenBlick {
  const horizon_bis = addDaysYmd(heute, horizonTage);
  const ueberfaellig: FaelligkeitEintrag[] = [];
  const bald: FaelligkeitEintrag[] = [];

  for (const p of items) {
    const faellig = (p.faellig_am ?? "").trim();
    if (faellig && faellig < heute) {
      ueberfaellig.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: faellig,
        offen: p.offen,
        status: p.status,
        tage_verzug: daysBetweenYmd(faellig, heute),
        lage: "ueberfaellig",
      });
      continue;
    }
    if (faellig && faellig >= heute && faellig <= horizon_bis) {
      bald.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: faellig,
        offen: p.offen,
        status: p.status,
        tage_verzug: 0,
        lage: "faellig_bald",
      });
      continue;
    }
    if (!faellig && p.status === "ueberfaellig") {
      ueberfaellig.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: "",
        offen: p.offen,
        status: p.status,
        tage_verzug: 0,
        lage: "ueberfaellig",
      });
    }
  }

  ueberfaellig.sort((a, b) => {
    if (a.tage_verzug !== b.tage_verzug) return b.tage_verzug - a.tage_verzug;
    if (a.faellig_am !== b.faellig_am) {
      return (a.faellig_am || "0000") < (b.faellig_am || "0000") ? -1 : 1;
    }
    return a.rechnungsnummer.localeCompare(b.rechnungsnummer, "de");
  });
  bald.sort((a, b) => {
    if (a.faellig_am !== b.faellig_am) {
      return a.faellig_am < b.faellig_am ? -1 : 1;
    }
    return a.rechnungsnummer.localeCompare(b.rechnungsnummer, "de");
  });

  return {
    heute,
    horizon_tage: horizonTage,
    horizon_bis,
    ueberfaellig,
    bald,
  };
}

export const OHNE_KATEGORIE_LABEL = "ohne Kategorie";
export const WEITERE_KATEGORIE_KEY = "__weitere__";
export const WEITERE_KATEGORIE_LABEL = "Weitere";
export const AUSGABEN_KATEGORIEN_TOP = 5;
export const LETZTE_BUCHUNGEN_ANZAHL = 6;

export type KategorieSchnappschuesse = {
  beleg: Map<string, string>;
  kasse: Map<string, string>;
};

export type AusgabenKategorieZeile = {
  key: string;
  label: string;
  summe_brutto: string;
  anteil: number;
};

export type AusgabenKategorienBlick = {
  zeitraum: Zeitraum;
  label: string;
  zeilen: AusgabenKategorieZeile[];
  summe_brutto: string;
  anzahl: number;
};

export type LetzteBuchung = {
  id: string;
  buchungsdatum: string;
  buchungstext: string;
  richtung: Buchungsrichtung;
  betrag_brutto: string;
  quelle_typ: QuelleTyp;
  href: string;
};

function quelleFuerSchnappschuss(
  e: JournalEintrag,
  originals: Map<string, JournalEintrag>,
): JournalEintrag {
  if (isStornoEintrag(e) && e.storno_von) {
    return originals.get(e.storno_von) ?? e;
  }
  return e;
}

function istAusgabenBelegOderKasse(
  e: JournalEintrag,
  originals: Map<string, JournalEintrag>,
): boolean {
  const src = quelleFuerSchnappschuss(e, originals);
  if (src.quelle_typ !== "beleg" && src.quelle_typ !== "kasse") {
    return false;
  }
  return wirtschaftlicheRichtung(e, originals) === "ausgabe";
}

function snapshotKategorie(
  src: JournalEintrag,
  schnappschuesse: KategorieSchnappschuesse,
): string {
  if (src.quelle_typ === "beleg") {
    return (schnappschuesse.beleg.get(src.quelle_id) ?? "").trim();
  }
  if (src.quelle_typ === "kasse") {
    return (schnappschuesse.kasse.get(src.quelle_id) ?? "").trim();
  }
  return "";
}

/** Beleg- und Kassenbuch-IDs, deren Schnappschuss die Kategorie trägt. */
export function sammelnKategorieQuelleIds(
  eintraege: JournalEintrag[],
  extraOriginale: JournalEintrag[] = [],
): { beleg: string[]; kasse: string[] } {
  const originals = indexJournalById([...extraOriginale, ...eintraege]);
  const beleg = new Set<string>();
  const kasse = new Set<string>();
  for (const e of eintraege) {
    if (!istAusgabenBelegOderKasse(e, originals)) continue;
    const src = quelleFuerSchnappschuss(e, originals);
    const id = src.quelle_id.trim();
    if (!id) continue;
    if (src.quelle_typ === "beleg") beleg.add(id);
    if (src.quelle_typ === "kasse") kasse.add(id);
  }
  return { beleg: [...beleg], kasse: [...kasse] };
}

export function monatKategorienLabel(zeitraum: Zeitraum): string {
  const { y, m } = parseYmd(zeitraum.von);
  return monatLabels(y, m).lang;
}

export function quartalKategorienLabel(zeitraum: Zeitraum): string {
  const { y, m } = parseYmd(zeitraum.von);
  return `${quarterOfMonth(m)}. Quartal ${y}`;
}

/**
 * Ausgaben nach Kategorie-Schnappschuss (ADR-0017) am Beleg / Kassenbuch.
 * Beträge aus dem Journal; Storno mindert die Ursprungskategorie.
 * Leerer Schnappschuss → „ohne Kategorie“, kein Raten.
 */
export function buildAusgabenNachKategorien(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  schnappschuesse: KategorieSchnappschuesse,
  extraOriginale: JournalEintrag[] = [],
  opts?: { top?: number; label?: string },
): AusgabenKategorienBlick {
  const originals = indexJournalById([...extraOriginale, ...eintraege]);
  const slice = eintraege.filter((e) =>
    isDateInZeitraum(e.buchungsdatum, zeitraum),
  );
  const acc = new Map<string, ReturnType<typeof money>>();
  let anzahl = 0;

  for (const e of slice) {
    if (!istAusgabenBelegOderKasse(e, originals)) continue;
    const src = quelleFuerSchnappschuss(e, originals);
    const name = snapshotKategorie(src, schnappschuesse);
    const key = name || OHNE_KATEGORIE_LABEL;
    const sign = isStornoEintrag(e) ? -1 : 1;
    const prev = acc.get(key) ?? money(0);
    acc.set(key, prev.plus(money(e.betrag_brutto).times(sign)));
    anzahl += 1;
  }

  const ranked = [...acc.entries()]
    .map(([key, summe]) => ({ key, label: key, summe }))
    .filter((r) => r.summe.gt(0))
    .sort((a, b) => {
      const cmp = b.summe.comparedTo(a.summe);
      if (cmp !== 0) return cmp;
      return a.label.localeCompare(b.label, "de");
    });

  const topN = opts?.top ?? AUSGABEN_KATEGORIEN_TOP;
  const head = ranked.slice(0, topN);
  const rest = ranked.slice(topN);
  const restSumme = rest.reduce((s, r) => s.plus(r.summe), money(0));
  const raw = [
    ...head,
    ...(rest.length > 0
      ? [
          {
            key: WEITERE_KATEGORIE_KEY,
            label: WEITERE_KATEGORIE_LABEL,
            summe: restSumme,
          },
        ]
      : []),
  ];
  const total = raw.reduce((s, r) => s.plus(r.summe), money(0));

  return {
    zeitraum,
    label: opts?.label ?? "",
    zeilen: raw.map((r) => ({
      key: r.key,
      label: r.label,
      summe_brutto: moneyToString(r.summe),
      anteil: total.gt(0) ? r.summe.dividedBy(total).toNumber() : 0,
    })),
    summe_brutto: moneyToString(total),
    anzahl,
  };
}

export function hrefFuerJournalQuelle(e: JournalEintrag): string {
  const id = e.quelle_id.trim();
  if (e.quelle_typ === "beleg" && id) return `/app/belege/${id}`;
  if (e.quelle_typ === "kasse" && id) return `/app/kassenbuch/${id}`;
  if (e.quelle_typ === "rechnung" && id) return `/app/rechnungen/${id}`;
  return `/app/journal/${e.id}`;
}

/** Neueste zuerst — Aufrufer liefert die Journal-Liste bereits so sortiert. */
export function buildLetzteBuchungen(
  items: JournalEintrag[],
  limit = LETZTE_BUCHUNGEN_ANZAHL,
): LetzteBuchung[] {
  return items.slice(0, limit).map((e) => ({
    id: e.id,
    buchungsdatum: e.buchungsdatum,
    buchungstext: e.buchungstext,
    richtung: e.richtung,
    betrag_brutto: e.betrag_brutto,
    quelle_typ: e.quelle_typ,
    href: hrefFuerJournalQuelle(e),
  }));
}
