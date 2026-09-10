import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { ANGEBOT_STATUS_LABELS, formatDateDe } from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import {
  listAngebote,
  parseAngebotStatus,
  type AngebotStatus,
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

function statusBadgeVariant(
  status: AngebotStatus,
): "default" | "secondary" | "success" | "outline" | "muted" {
  switch (status) {
    case "angenommen":
    case "abgerechnet":
      return "success";
    case "abgelehnt":
      return "muted";
    case "gesendet":
      return "default";
    case "abgelaufen":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function AngeboteListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const status = parseAngebotStatus(sp.status ?? "") || "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, kundenResult] = await Promise.all([
    listAngebote(
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
        title="Angebote"
        description="Noch nicht verbindliche Verkaufsdokumente — Entwurf mit Vorschau, beim Senden Nummer und Original-PDF (ohne Buchungsjournal, ohne SMTP-Pflicht)."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/angebote/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Angebot anlegen
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
                <option value="entwurf">Entwurf</option>
                <option value="gesendet">Gesendet</option>
                <option value="angenommen">Angenommen</option>
                <option value="abgelehnt">Abgelehnt</option>
                <option value="abgelaufen">Abgelaufen</option>
                <option value="abgerechnet">Abgerechnet</option>
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
            <p className="p-6 text-sm text-muted-foreground">
              Noch keine Angebote.{" "}
              <Link
                href="/app/angebote/neu"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Erstes Angebot anlegen
              </Link>
            </p>
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
                {result.items.map((a) => {
                  const label =
                    a.angebotsnummer ||
                    (a.status === "entwurf" ? "Entwurf" : "Angebot");
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateDe(a.angebotsdatum)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/app/angebote/${a.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {label}
                        </Link>
                        {a.pdf ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            mit PDF
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.kunde ? (kundeName.get(a.kunde) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(a.status)}>
                          {ANGEBOT_STATUS_LABELS[a.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyDe(a.betrag_brutto, { currency: true })}
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
        <p>{result.totalItems} Angebot/Angebote</p>
        {result.totalPages > 1 ? (
          <p>
            Seite {result.page} / {result.totalPages}
          </p>
        ) : null}
      </div>
    </div>
  );
}
