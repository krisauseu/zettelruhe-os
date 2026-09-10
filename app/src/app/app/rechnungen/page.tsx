import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { RECHNUNG_STATUS_LABELS, formatDateDe } from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import {
  listRechnungen,
  type RechnungStatus,
} from "@/modules/sales";
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
  status?: string;
  von?: string;
  bis?: string;
}>;

export default async function RechnungenListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const statusRaw = sp.status?.trim() ?? "";
  const status = (
    [
      "entwurf",
      "offen",
      "teilbezahlt",
      "bezahlt",
      "ueberfaellig",
      "storniert",
    ] as const
  ).includes(statusRaw as RechnungStatus)
    ? (statusRaw as RechnungStatus)
    : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, kundenResult] = await Promise.all([
    listRechnungen(
      session.firmaId,
      {
        q: q || undefined,
        status: status || undefined,
        von: von || undefined,
        bis: bis || undefined,
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
        title="Rechnungen"
        description="Freie Rechnungen — Entwurf mit Vorschau, bei Festschreibung Nummer, Original-PDF und Buchungsjournal."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/rechnungen/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Rechnung anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Text, Status oder Zeitraum filtern.
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
                placeholder="Nummer, Notiz …"
              />
            </div>
            <div className="flex w-40 flex-col gap-1.5">
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
                <option value="entwurf">Entwurf</option>
                <option value="offen">Offen</option>
                <option value="teilbezahlt">Teilbezahlt</option>
                <option value="bezahlt">Bezahlt</option>
                <option value="ueberfaellig">Überfällig</option>
                <option value="storniert">Storniert</option>
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
          {result.items.length === 0 ? (
            <EmptyState
              title={q || status ? "Keine Rechnungen gefunden" : "Noch keine Rechnungen"}
              description={
                q || status
                  ? "Filter anpassen oder neue Rechnung anlegen."
                  : "Entwurf anlegen und bei Festschreibung Nummer, PDF und Buchungsjournal erzeugen."
              }
              actionHref="/app/rechnungen/neu"
              actionLabel="Erste Rechnung anlegen"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Datum</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Kund:in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((r) => {
                  const label =
                    r.rechnungsnummer ||
                    (r.status === "entwurf" ? "Entwurf" : "Rechnung");
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateDe(r.rechnungsdatum)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/app/rechnungen/${r.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {label}
                        </Link>
                        {r.pdf ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            mit PDF
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.kunde ? (kundeName.get(r.kunde) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "bezahlt"
                              ? "success"
                              : r.status === "storniert"
                                ? "danger"
                                : r.status === "entwurf"
                                  ? "secondary"
                                  : r.status === "ueberfaellig"
                                    ? "warning"
                                    : "default"
                          }
                        >
                          {RECHNUNG_STATUS_LABELS[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyDe(r.betrag_brutto, { currency: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>{result.totalItems} Rechnung/Rechnungen</p>
        {result.totalPages > 1 ? (
          <p>
            Seite {result.page} / {result.totalPages}
          </p>
        ) : null}
      </div>
    </div>
  );
}
