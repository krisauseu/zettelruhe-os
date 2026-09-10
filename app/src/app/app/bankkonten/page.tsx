import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { listBankkonten } from "@/modules/banking";
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
  deleted?: string;
}>;

export default async function BankkontenListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listBankkonten(
    session.firmaId,
    { q: q || undefined },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Bankkonten"
        description="Stammdaten für unbare Zahlwege und Kontoauszugs-Import. Getrennt vom Kassenbuch."
      >
        <Link
          href="/app/kontoauszug"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Kontoauszug
        </Link>
        {session.kannSchreiben ? (
          <Link
            href="/app/bankkonten/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Bankkonto anlegen
          </Link>
        ) : null}
      </PageHeader>

      {sp.deleted ? (
        <p className="text-sm text-success" role="status">
          Bankkonto gelöscht.
        </p>
      ) : null}

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Name, Kontoinhaber, IBAN oder Notiz suchen.
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
                placeholder="Name oder IBAN…"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {result.totalItems === 0
              ? "Keine Bankkonten"
              : `${result.totalItems} Bankkonto${result.totalItems === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Noch kein Bankkonto angelegt. Legen Sie eines an, um
              Kontoauszüge zu importieren.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontoinhaber</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>BIC</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link
                        href={`/app/bankkonten/${k.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {k.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {k.kontoinhaber || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {k.iban || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {k.bic || "—"}
                    </TableCell>
                    <TableCell>
                      {k.aktiv ? (
                        <Badge variant="secondary">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline">Inaktiv</Badge>
                      )}
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
