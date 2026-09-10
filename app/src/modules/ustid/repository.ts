/**
 * Persistenz der BZSt-Schnappschüsse (append-only, ADR-0021).
 */

import { createRecord, listRecords, pbEq } from "@/lib/pb";
import type {
  UstIdPruefung,
  UstIdPruefungArt,
  UstIdPruefungBlick,
  UstIdPruefungInput,
  UstIdPruefungZiel,
} from "./types";

const COL = "ust_id_pruefungen";

type PbPruefung = {
  id: string;
  firma: string;
  ziel_typ: UstIdPruefungZiel;
  ziel_id: string;
  art: UstIdPruefungArt;
  anfragende_ust_id: string;
  abgefragte_ust_id: string;
  bzst_id?: string;
  anfrage_zeitpunkt?: string;
  status: string;
  status_meldung?: string;
  gueltig_zum_anfragezeitpunkt?: boolean;
  gueltig_ab?: string;
  gueltig_bis?: string;
  erg_firmenname?: string;
  erg_strasse?: string;
  erg_plz?: string;
  erg_ort?: string;
  anfrage_name?: string;
  anfrage_strasse?: string;
  anfrage_plz?: string;
  anfrage_ort?: string;
  roh?: string;
  created?: string;
};

function mapPruefung(r: PbPruefung): UstIdPruefung {
  return {
    id: r.id,
    firma: r.firma,
    ziel_typ: r.ziel_typ,
    ziel_id: r.ziel_id,
    art: r.art,
    anfragende_ust_id: r.anfragende_ust_id,
    abgefragte_ust_id: r.abgefragte_ust_id,
    bzst_id: r.bzst_id ?? "",
    anfrage_zeitpunkt: r.anfrage_zeitpunkt ?? "",
    status: r.status,
    status_meldung: r.status_meldung ?? "",
    gueltig_zum_anfragezeitpunkt: Boolean(r.gueltig_zum_anfragezeitpunkt),
    gueltig_ab: r.gueltig_ab ?? "",
    gueltig_bis: r.gueltig_bis ?? "",
    erg_firmenname: r.erg_firmenname ?? "",
    erg_strasse: r.erg_strasse ?? "",
    erg_plz: r.erg_plz ?? "",
    erg_ort: r.erg_ort ?? "",
    anfrage_name: r.anfrage_name ?? "",
    anfrage_strasse: r.anfrage_strasse ?? "",
    anfrage_plz: r.anfrage_plz ?? "",
    anfrage_ort: r.anfrage_ort ?? "",
    roh: r.roh ?? "",
    created: r.created,
  };
}

export function toPruefungBlick(p: UstIdPruefung): UstIdPruefungBlick {
  return {
    anfrage_zeitpunkt: p.anfrage_zeitpunkt || p.created || "",
    status: p.status,
    status_meldung: p.status_meldung,
    abgefragte_ust_id: p.abgefragte_ust_id,
    gueltig_zum_anfragezeitpunkt: p.gueltig_zum_anfragezeitpunkt,
  };
}

export async function createUstIdPruefung(
  firmaId: string,
  input: UstIdPruefungInput,
): Promise<UstIdPruefung> {
  const a = input.antwort;
  const r = await createRecord<PbPruefung>(COL, {
    firma: firmaId,
    ziel_typ: input.ziel_typ,
    ziel_id: input.ziel_id,
    art: input.art,
    anfragende_ust_id: input.anfragende_ust_id,
    abgefragte_ust_id: input.abgefragte_ust_id,
    bzst_id: a.id,
    anfrage_zeitpunkt: a.anfrageZeitpunkt,
    status: a.status,
    status_meldung: a.statusMeldung,
    gueltig_zum_anfragezeitpunkt: a.gueltigZumAnfragezeitpunkt,
    gueltig_ab: a.gueltigAb,
    gueltig_bis: a.gueltigBis,
    erg_firmenname: a.ergFirmenname,
    erg_strasse: a.ergStrasse,
    erg_plz: a.ergPlz,
    erg_ort: a.ergOrt,
    anfrage_name: (input.anfrage_name ?? "").trim(),
    anfrage_strasse: (input.anfrage_strasse ?? "").trim(),
    anfrage_plz: (input.anfrage_plz ?? "").trim(),
    anfrage_ort: (input.anfrage_ort ?? "").trim(),
    roh: a.roh,
  });
  return mapPruefung(r);
}

export async function listUstIdPruefungen(
  firmaId: string,
  opts: {
    ziel_typ?: UstIdPruefungZiel;
    ziel_id?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<UstIdPruefung[]> {
  const parts = [pbEq("firma", firmaId)];
  if (opts.ziel_typ) parts.push(pbEq("ziel_typ", opts.ziel_typ));
  if (opts.ziel_id) parts.push(pbEq("ziel_id", opts.ziel_id));
  // anfrage_zeitpunkt existiert immer; created fehlt, wenn PB Autodate nicht
  // still ergänzt hat (PB 0.23+). sort=-created liefert dann 400.
  const result = await listRecords<PbPruefung>(COL, {
    page: opts.page ?? 1,
    perPage: opts.perPage ?? 20,
    filter: parts.join(" && "),
    sort: "-anfrage_zeitpunkt",
  });
  return result.items.map(mapPruefung);
}

/** Neuester Schnappschuss zur aktuell gespeicherten abgefragten Nummer. */
export async function getAktuellePruefung(
  firmaId: string,
  zielTyp: UstIdPruefungZiel,
  zielId: string,
  abgefragteUstId: string,
): Promise<UstIdPruefung | null> {
  const id = (abgefragteUstId ?? "").trim();
  if (!id) return null;
  const items = await listUstIdPruefungen(firmaId, {
    ziel_typ: zielTyp,
    ziel_id: zielId,
    perPage: 30,
  });
  return items.find((p) => p.abgefragte_ust_id === id) ?? null;
}

/** Letzte Verwendung der eigenen Nummer als Anfragende (kein Isoliert-Stempel). */
export async function getLetzteAnfragendeVerwendung(
  firmaId: string,
  anfragendeUstId: string,
): Promise<UstIdPruefung | null> {
  const id = (anfragendeUstId ?? "").trim();
  if (!id) return null;
  const items = await listUstIdPruefungen(firmaId, { perPage: 30 });
  return items.find((p) => p.anfragende_ust_id === id) ?? null;
}

export async function getAktuellePruefungenFuerKontakte(
  firmaId: string,
  kontakte: { id: string; ust_id: string }[],
): Promise<Map<string, UstIdPruefung>> {
  const wanted = kontakte.filter((k) => k.ust_id);
  const map = new Map<string, UstIdPruefung>();
  if (wanted.length === 0) return map;

  let items: UstIdPruefung[];
  try {
    items = await listUstIdPruefungen(firmaId, {
      ziel_typ: "kontakt",
      perPage: 200,
    });
  } catch {
    return map;
  }
  for (const k of wanted) {
    const hit = items.find(
      (p) => p.ziel_id === k.id && p.abgefragte_ust_id === k.ust_id,
    );
    if (hit) map.set(k.id, hit);
  }
  return map;
}
