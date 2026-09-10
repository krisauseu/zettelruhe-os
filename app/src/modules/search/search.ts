/**
 * Volltextsuche light (BA14): parallele Listen-Filter über bestehende Repositories.
 * Kein eigener Suchindex, kein Elasticsearch.
 */

import { listKontakte } from "@/modules/contacts";
import { listBelege } from "@/modules/expenses";
import { listAngebote, listRechnungen } from "@/modules/sales";
import { RECHNUNG_STATUS_LABELS, ANGEBOT_STATUS_LABELS, BELEG_STATUS_LABELS } from "@/lib/labels";
import type { SearchHit, SearchResult } from "./types";

const PER_KIND = 8;
const MAX_HITS = 32;

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 120);
}

export async function searchFirma(
  firmaId: string,
  rawQuery: string,
): Promise<SearchResult> {
  const q = normalizeSearchQuery(rawQuery);
  if (q.length < 2) {
    return { q, hits: [], truncated: false };
  }

  const [kontakte, rechnungen, belege, angebote] = await Promise.all([
    listKontakte(firmaId, { q }, 1, PER_KIND),
    listRechnungen(firmaId, { q }, 1, PER_KIND),
    listBelege(firmaId, { q }, 1, PER_KIND),
    listAngebote(firmaId, { q }, 1, PER_KIND),
  ]);

  const hits: SearchHit[] = [];

  for (const k of kontakte.items) {
    const roles = [
      k.ist_kunde ? "Kund:in" : null,
      k.ist_lieferant ? "Lieferant:in" : null,
    ]
      .filter(Boolean)
      .join(", ");
    hits.push({
      kind: "kontakt",
      id: k.id,
      title: k.name,
      subtitle:
        [k.kontaktnummer, roles, k.ort, k.email].filter(Boolean).join(" · ") ||
        "Kontakt",
      href: `/app/kontakte/${k.id}`,
    });
  }

  for (const r of rechnungen.items) {
    hits.push({
      kind: "rechnung",
      id: r.id,
      title: r.rechnungsnummer || "Rechnungs-Entwurf",
      subtitle: `${RECHNUNG_STATUS_LABELS[r.status] ?? r.status}${r.notiz ? ` · ${r.notiz.slice(0, 60)}` : ""}`,
      href: `/app/rechnungen/${r.id}`,
    });
  }

  for (const b of belege.items) {
    const bezeichnung = b.notiz.trim();
    hits.push({
      kind: "beleg",
      id: b.id,
      title: bezeichnung || b.belegnummer || b.kategorie || "Beleg",
      subtitle: [
        BELEG_STATUS_LABELS[b.status] ?? b.status,
        bezeichnung && b.belegnummer ? b.belegnummer : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/app/belege/${b.id}`,
    });
  }

  for (const a of angebote.items) {
    hits.push({
      kind: "angebot",
      id: a.id,
      title: a.angebotsnummer || "Angebots-Entwurf",
      subtitle: `${ANGEBOT_STATUS_LABELS[a.status] ?? a.status}${a.notiz ? ` · ${a.notiz.slice(0, 60)}` : ""}`,
      href: `/app/angebote/${a.id}`,
    });
  }

  const truncated = hits.length > MAX_HITS;
  return {
    q,
    hits: hits.slice(0, MAX_HITS),
    truncated,
  };
}
