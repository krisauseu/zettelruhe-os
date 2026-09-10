import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { listKontakte } from "@/modules/contacts";
import { listProjekte } from "@/modules/projects";
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
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  kunde?: string;
  aktiv?: string;
  page?: string;
}>;

export default async function ProjektePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const kunde = sp.kunde?.trim() ?? "";
  const aktivRaw = sp.aktiv ?? "";
  const aktiv =
    aktivRaw === "1" ? true : aktivRaw === "0" ? false : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, kundenResult] = await Promise.all([
    listProjekte(
      session.firmaId,
      {
        q: q || undefined,
        kunde: kunde || undefined,
        aktiv,
      },
      page,
      50,
    ),
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
  ]);

  const kundeName = new Map(kundenResult.items.map((k) => [k.id, k.name]));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Projekte"
        description="Optionale Arbeitseinheiten je Kund:in — Zeiten und Fahrten können zugeordnet werden."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/projekte/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Projekt anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Name, Kund:in oder Aktiv-Status filtern.
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
                placeholder="Name, Notiz …"
              />
            </div>
            <div className="flex w-48 flex-col gap-1.5">
              <Label htmlFor="kunde" className="text-xs text-muted-foreground">
                Kund:in
              </Label>
              <Select id="kunde" name="kunde" defaultValue={kunde}>
                <option value="">Alle</option>
                {kundenResult.items.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor="aktiv" className="text-xs text-muted-foreground">
                Status
              </Label>
              <Select id="aktiv" name="aktiv" defaultValue={aktivRaw}>
                <option value="">Alle</option>
                <option value="1">Aktiv</option>
                <option value="0">Inaktiv</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Projekte gefunden.{" "}
              <Link
                href="/app/projekte/neu"
                className="text-primary underline-offset-4 hover:underline"
              >
                Erstes Projekt anlegen
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kund:in</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/app/projekte/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.notiz ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {p.notiz}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {kundeName.get(p.kunde) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.aktiv ? "default" : "secondary"}>
                        {p.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {result.totalPages > 1 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Seite {result.page} von {result.totalPages} · {result.totalItems}{" "}
              Einträge
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
