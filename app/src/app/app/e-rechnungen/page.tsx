import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  E_RECHNUNG_EMPFANG_STATUS_LABELS,
  E_RECHNUNG_FORMAT_LABELS,
  E_RECHNUNG_PARSE_STATUS_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import {
  listERechnungEmpfang,
  type EInvoiceParseStatus,
  type ERechnungEmpfangStatus,
} from "@/modules/einvoice";
import { buttonVariants } from "@/components/ui/button";
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
  status?: string;
  parse_status?: string;
}>;

export default async function ERechnungenListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const status =
    sp.status === "neu" ||
    sp.status === "beleg_erstellt" ||
    sp.status === "archiviert"
      ? (sp.status as ERechnungEmpfangStatus)
      : "";
  const parse_status =
    sp.parse_status === "ok" || sp.parse_status === "fehler"
      ? (sp.parse_status as EInvoiceParseStatus)
      : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listERechnungEmpfang(
    session.firmaId,
    {
      q: q || undefined,
      status: status || undefined,
      parse_status: parse_status || undefined,
    },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="E-Rechnungen"
        description="Empfang: XRechnung-XML, CII-XML oder PDF mit eingebettetem XML (auch Flate). Original archivieren, Beleg vorbefüllen. Versand von der festgeschriebenen Rechnung aus."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/e-rechnungen/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            E-Rechnung empfangen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Nummer, Lieferant:in, Status oder Parse-Ergebnis filtern.
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
                placeholder="Nummer, Lieferant:in, Dateiname …"
              />
            </div>
            <div className="flex w-44 flex-col gap-1.5">
              <Label
                htmlFor="status"
                className="text-xs text-muted-foreground"
              >
                Status
              </Label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Alle</option>
                <option value="neu">Neu</option>
                <option value="beleg_erstellt">Beleg angelegt</option>
                <option value="archiviert">Archiviert</option>
              </select>
            </div>
            <div className="flex w-40 flex-col gap-1.5">
              <Label
                htmlFor="parse_status"
                className="text-xs text-muted-foreground"
              >
                Parse
              </Label>
              <select
                id="parse_status"
                name="parse_status"
                defaultValue={parse_status}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Alle</option>
                <option value="ok">Geparst</option>
                <option value="fehler">Parse-Fehler</option>
              </select>
            </div>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Filtern
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Empfangene E-Rechnungen
            {result.totalItems > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({result.totalItems})
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {result.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Noch keine E-Rechnung empfangen.{" "}
              <Link
                href="/app/e-rechnungen/neu"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Datei hochladen
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empfangen</TableHead>
                  <TableHead>Rechnungsdatum</TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Lieferant:in</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/app/e-rechnungen/${item.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {formatDateTimeDe(item.empfangen_am)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {item.rechnungsdatum
                        ? formatDateDe(item.rechnungsdatum)
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.rechnungsnummer || "—"}
                    </TableCell>
                    <TableCell>{item.lieferant_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.betrag_brutto
                        ? formatMoneyDe(item.betrag_brutto, {
                            currency: true,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {E_RECHNUNG_FORMAT_LABELS[item.format]}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            item.status === "neu" ? "default" : "secondary"
                          }
                        >
                          {E_RECHNUNG_EMPFANG_STATUS_LABELS[item.status]}
                        </Badge>
                        {item.parse_status === "fehler" ? (
                          <Badge variant="outline" className="text-destructive">
                            {E_RECHNUNG_PARSE_STATUS_LABELS.fehler}
                          </Badge>
                        ) : null}
                      </div>
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
            Seite {result.page} von {result.totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/app/e-rechnungen?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}${parse_status ? `&parse_status=${parse_status}` : ""}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Zurück
              </Link>
            ) : null}
            {page < result.totalPages ? (
              <Link
                href={`/app/e-rechnungen?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}${parse_status ? `&parse_status=${parse_status}` : ""}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Weiter
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
