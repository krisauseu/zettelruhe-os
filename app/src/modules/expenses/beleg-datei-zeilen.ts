/** Eine Dateizeile mit Anzeigen/Entfernen neben dem Dateinamen. */
export type BelegDateiZeile = {
  key: string;
  name: string;
  anzeigenHref: string | null;
  kind: "saved" | "pending";
  pendingIndex?: number;
};

export function belegDateiHref(belegId: string, filename: string): string {
  const q = new URLSearchParams({ name: filename });
  return `/app/belege/${belegId}/datei?${q.toString()}`;
}

/**
 * Eine Zeile je Datei. Neue Auswahl hängt an gespeicherten Dateien an
 * (kein stilles Ersetzen).
 */
export function belegDateiZeilen(input: {
  savedNames: string[];
  pending: { name: string; previewUrl: string }[];
  belegId?: string;
}): BelegDateiZeile[] {
  const saved = input.savedNames
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({
      key: `saved:${name}`,
      name,
      anzeigenHref: input.belegId ? belegDateiHref(input.belegId, name) : null,
      kind: "saved" as const,
    }));
  const pending = input.pending.map((p, i) => ({
    key: `pending:${i}:${p.name}`,
    name: p.name,
    anzeigenHref: p.previewUrl,
    kind: "pending" as const,
    pendingIndex: i,
  }));
  return [...saved, ...pending];
}
