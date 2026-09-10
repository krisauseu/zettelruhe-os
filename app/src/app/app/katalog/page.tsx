import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import { STEUERSATZ_LABELS } from "@/lib/labels";
import { listKatalog } from "@/modules/catalog";
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
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  page?: string;
  alle?: string;
}>;

export default async function KatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();

  const firma = await getFirmaById(session.firmaId);
  const showUst = firma?.steuermodus === "regelbesteuerung_ist";

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const nurAktiv = sp.alle !== "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listKatalog(
    session.firmaId,
    { q: q || undefined, nurAktiv },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Katalog"
        description={`Produkte und Leistungen mit Preisen${showUst ? " und Steuersätzen" : ""}.`}
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/katalog/import"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            CSV-Import
          </Link>
        ) : null}
        <Link
          href="/app/katalog/export"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          CSV-Export
        </Link>
        {session.kannSchreiben ? (
          <Link
            href="/app/katalog/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Position anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suche</CardTitle>
          <CardDescription>
            Nach Bezeichnung oder Einheit filtern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q" className="text-xs text-muted-foreground">
                Suche
              </Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Bezeichnung …"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="alle"
                value="1"
                defaultChecked={!nurAktiv}
                className="h-4 w-4 rounded border-input text-primary accent-primary"
              />
              Auch inaktive
            </label>
            <Button type="submit" variant="secondary">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Keine Positionen gefunden.{" "}
              <Link
                href="/app/katalog/neu"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Erste Position anlegen
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Preis</TableHead>
                  {showUst ? <TableHead>USt</TableHead> : null}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/app/katalog/${p.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.bezeichnung}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.einheit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-foreground">
                      {formatMoneyDe(p.preis, { currency: true })}
                    </TableCell>
                    {showUst ? (
                      <TableCell className="text-muted-foreground">
                        {p.steuersatz
                          ? (STEUERSATZ_LABELS[p.steuersatz] ?? p.steuersatz)
                          : "—"}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Badge variant={p.aktiv ? "success" : "muted"}>
                        {p.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {result.totalItems} Position(en)
      </p>
    </div>
  );
}
