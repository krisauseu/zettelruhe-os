import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { searchFirma, type SearchHitKind } from "@/modules/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<SearchHitKind, string> = {
  kontakt: "Kontakt",
  rechnung: "Rechnung",
  beleg: "Beleg",
  angebot: "Angebot",
};

type SearchParams = Promise<{ q?: string }>;

export default async function SuchePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const result =
    q.length >= 2 ? await searchFirma(session.firmaId, q) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Suche"
        description="Light-Suche über Kontakte, Rechnungen, Belege und Angebote."
      />

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suchbegriff</CardTitle>
          <CardDescription>Mindestens 2 Zeichen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q">Begriff</Label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Name, Nummer, Notiz …"
                autoFocus
              />
            </div>
            <Button type="submit" variant="secondary">
              Suchen
            </Button>
          </form>
        </CardContent>
      </Card>

      {q.length > 0 && q.length < 2 ? (
        <Card>
          <EmptyState
            title="Zu kurz"
            description="Bitte mindestens zwei Zeichen eingeben."
          />
        </Card>
      ) : null}

      {result && result.hits.length === 0 ? (
        <Card>
          <EmptyState
            title="Keine Treffer"
            description={`Für „${result.q}“ wurde nichts gefunden. Filter in den jeweiligen Listen nutzen, um breiter zu suchen.`}
          />
        </Card>
      ) : null}

      {result && result.hits.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {result.hits.length} Treffer
              {result.truncated ? " (begrenzt)" : ""}
            </CardTitle>
            <CardDescription>
              für „{result.q}“
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {result.hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={hit.href}
                    className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {KIND_LABELS[hit.kind]}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">
                        {hit.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!q ? (
        <Card>
          <EmptyState
            title="Noch nichts gesucht"
            description="Name einer Kund:in, Rechnungsnummer oder Belegkategorie eingeben."
          />
        </Card>
      ) : null}
    </div>
  );
}
