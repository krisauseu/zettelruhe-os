export type SearchHitKind = "kontakt" | "rechnung" | "beleg" | "angebot";

export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResult = {
  q: string;
  hits: SearchHit[];
  truncated: boolean;
};
