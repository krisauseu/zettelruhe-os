import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { BUCHUNGSRICHTUNG_LABELS } from "@/lib/labels";
import { listKategorien } from "@/modules/categories";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  page?: string;
  alle?: string;
}>;

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const nurAktiv = sp.alle !== "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listKategorien(
    session.firmaId,
    { q: q || undefined, nurAktiv },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Kategorien"
        description="Gemeinsame Auswahlliste für Belege und Kassenbuch."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/kategorien/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Kategorie anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Name oder Notiz suchen. Inaktive bleiben an gespeicherten
            Zeilen stehen, erscheinen aber nicht in neuen Auswahllisten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q">Suche</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name oder Notiz"
              />
            </div>
            {nurAktiv ? null : <input type="hidden" name="alle" value="1" />}
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
            {nurAktiv ? (
              <Link
                href={`/app/kategorien?alle=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Inaktive zeigen
              </Link>
            ) : (
              <Link
                href={q ? `/app/kategorien?q=${encodeURIComponent(q)}` : "/app/kategorien"}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Nur aktive
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {result.totalItems}{" "}
            {result.totalItems === 1 ? "Kategorie" : "Kategorien"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <EmptyState
              title="Noch keine Kategorien"
              description="Legen Sie Einträge an, damit Beleg und Kassenbuch eine gemeinsame Auswahlliste haben."
              actionHref="/app/kategorien/neu"
              actionLabel="Kategorie anlegen"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead>Notiz</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link
                        href={`/app/kategorien/${k.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {k.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">
                        {BUCHUNGSRICHTUNG_LABELS[k.richtung]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {k.notiz || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.aktiv ? "secondary" : "outline"}>
                        {k.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
