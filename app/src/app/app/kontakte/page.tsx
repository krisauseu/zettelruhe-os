import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { kontaktRollenLabel } from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import type { KontaktFilter } from "@/modules/contacts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  rolle?: string;
  page?: string;
}>;

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const rolleRaw = sp.rolle ?? "alle";
  const rolle: KontaktFilter["rolle"] =
    rolleRaw === "kunde" || rolleRaw === "lieferant" ? rolleRaw : "alle";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listKontakte(
    session.firmaId,
    { q: q || undefined, rolle },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Kontakte"
        description="Kund:innen und Lieferant:innen der Firma."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/kontakte/import"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            CSV-Import
          </Link>
        ) : null}
        <Link
          href="/app/kontakte/export"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          CSV-Export
        </Link>
        {session.kannSchreiben ? (
          <Link
            href="/app/kontakte/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Kontakt anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suche & Filter</CardTitle>
          <CardDescription>
            Nach Name, Kontaktnummer, E-Mail, Ort, Telefon oder USt-IdNr.
            filtern.
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
                placeholder="Name, Nr., E-Mail …"
              />
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1.5">
              <Label htmlFor="rolle" className="text-xs text-muted-foreground">
                Rolle
              </Label>
              <Select id="rolle" name="rolle" defaultValue={rolle}>
                <option value="alle">Alle</option>
                <option value="kunde">Kund:innen</option>
                <option value="lieferant">Lieferant:innen</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <EmptyState
              title={q ? "Keine Kontakte gefunden" : "Noch keine Kontakte"}
              description={
                q
                  ? "Filter anpassen oder neuen Kontakt anlegen."
                  : "Kund:innen und Lieferant:innen legen den Grundstein für Rechnungen und Belege."
              }
              actionHref="/app/kontakte/neu"
              actionLabel="Ersten Kontakt anlegen"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nr.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Ort</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {k.kontaktnummer || "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/kontakte/${k.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {k.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{kontaktRollenLabel(k)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[k.plz, k.ort].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.telefon || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {result.totalItems} Kontakt(e) · Seite {result.page} /{" "}
            {result.totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                href={`/app/kontakte?q=${encodeURIComponent(q)}&rolle=${rolle}&page=${page - 1}`}
              >
                Zurück
              </Link>
            ) : null}
            {page < result.totalPages ? (
              <Link
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                href={`/app/kontakte?q=${encodeURIComponent(q)}&rolle=${rolle}&page=${page + 1}`}
              >
                Weiter
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {result.totalItems} Kontakt(e)
        </p>
      )}
    </div>
  );
}
