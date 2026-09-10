import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe } from "@/lib/labels";
import {
  listKassenbuch,
  type Buchungsrichtung,
} from "@/modules/cash";
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
  richtung?: string;
  von?: string;
  bis?: string;
}>;

export default async function KassenbuchListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const richtung =
    sp.richtung === "einnahme" || sp.richtung === "ausgabe"
      ? (sp.richtung as Buchungsrichtung)
      : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listKassenbuch(
    session.firmaId,
    {
      q: q || undefined,
      richtung: richtung || undefined,
      von: von || undefined,
      bis: bis || undefined,
    },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Kassenbuch"
        description="Bareinnahmen und Barausgaben mit fortlaufendem Saldo. Anlegen = Festschreibung; fließt ins Buchungsjournal."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/kassenbuch/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Eintrag erfassen
          </Link>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aktueller Saldo</CardTitle>
          <CardDescription>
            Summe aller Bareinnahmen abzüglich Barausgaben (eine Kasse pro
            Firma). Negativer Saldo ist nicht erlaubt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {formatMoneyDe(result.saldo, { currency: true })}
          </p>
        </CardContent>
      </Card>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Text, Richtung oder Zeitraum filtern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q" className="text-xs text-muted-foreground">
                Suche
              </Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Text, Belegnummer …"
              />
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label
                htmlFor="richtung"
                className="text-xs text-muted-foreground"
              >
                Richtung
              </Label>
              <select
                id="richtung"
                name="richtung"
                defaultValue={richtung}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Alle</option>
                <option value="einnahme">Bareinnahme</option>
                <option value="ausgabe">Barausgabe</option>
              </select>
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor="von" className="text-xs text-muted-foreground">
                Von
              </Label>
              <Input id="von" name="von" type="date" defaultValue={von} />
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor="bis" className="text-xs text-muted-foreground">
                Bis
              </Label>
              <Input id="bis" name="bis" type="date" defaultValue={bis} />
            </div>
            <Button type="submit" variant="secondary">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {result.itemsMitSaldo.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Noch keine Kassenbuch-Einträge.{" "}
              <Link
                href="/app/kassenbuch/neu"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Erste Bareinnahme oder Barausgabe erfassen
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Datum</TableHead>
                  <TableHead>Belegnr.</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.itemsMitSaldo.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateDe(e.datum)}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {e.belegnummer}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/kassenbuch/${e.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {e.text}
                      </Link>
                      {e.storno_von ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Gegenbuchung
                        </span>
                      ) : null}
                      {e.kategorie ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {e.kategorie}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.richtung === "einnahme" ? "success" : "muted"
                        }
                      >
                        {e.richtung === "einnahme"
                          ? "Bareinnahme"
                          : "Barausgabe"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {e.richtung === "ausgabe" ? "−" : ""}
                      {formatMoneyDe(e.betrag_brutto, { currency: true })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatMoneyDe(e.saldo_nach, { currency: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>{result.totalItems} Eintrag/Einträge</p>
        {result.totalPages > 1 ? (
          <p>
            Seite {result.page} / {result.totalPages}
          </p>
        ) : null}
      </div>
    </div>
  );
}
