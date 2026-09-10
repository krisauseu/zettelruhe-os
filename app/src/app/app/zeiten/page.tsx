import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import {
  ABRECHNUNGSSTATUS_LABELS,
  formatDateDe,
} from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import {
  formatDauerDe,
  listZeiteintraege,
  type Abrechnungsstatus,
  uebernehmenZeitenFahrtenAlsRechnungAction,
} from "@/modules/time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  kunde?: string;
  status?: string;
  von?: string;
  bis?: string;
  page?: string;
  error?: string;
  projekt?: string;
}>;

function statusBadgeVariant(
  status: Abrechnungsstatus,
): "default" | "secondary" | "outline" {
  if (status === "abrechenbar") return "default";
  if (status === "abgerechnet") return "secondary";
  return "outline";
}

export default async function ZeitenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const kunde = sp.kunde?.trim() ?? "";
  const projekt = sp.projekt?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const statusRaw = sp.status ?? "";
  const status =
    statusRaw === "abrechenbar" ||
    statusRaw === "nicht_abrechenbar" ||
    statusRaw === "abgerechnet"
      ? (statusRaw as Abrechnungsstatus)
      : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, kundenResult] = await Promise.all([
    listZeiteintraege(
      session.firmaId,
      {
        q: q || undefined,
        kunde: kunde || undefined,
        projekt: projekt || undefined,
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
        title="Zeiten"
        description="Zeiteinträge je Kund:in — Grundlage für die Abrechnung."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/zeiten/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Zeiteintrag anlegen
          </Link>
        ) : null}
      </PageHeader>

      {sp.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {sp.error}
        </p>
      ) : null}

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Kund:in, Status oder Zeitraum filtern.
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
                placeholder="Beschreibung …"
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
            <div className="flex w-44 flex-col gap-1.5">
              <Label htmlFor="status" className="text-xs text-muted-foreground">
                Status
              </Label>
              <Select id="status" name="status" defaultValue={statusRaw}>
                <option value="">Alle</option>
                <option value="abrechenbar">Abrechenbar</option>
                <option value="nicht_abrechenbar">Nicht abrechenbar</option>
                <option value="abgerechnet">Abgerechnet</option>
              </Select>
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
            {projekt ? (
              <input type="hidden" name="projekt" value={projekt} />
            ) : null}
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      {kunde ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Als Rechnung übernehmen</CardTitle>
            <CardDescription>
              Alle abrechenbaren Zeiten und Fahrten von{" "}
              <strong>{kundeName.get(kunde) ?? "dieser Kund:in"}</strong> als
              Rechnungs-Entwurf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uebernehmenZeitenFahrtenAlsRechnungAction}>
              <input type="hidden" name="kunde" value={kunde} />
              <input type="hidden" name="return_to" value="/app/zeiten" />
              <Button type="submit" size="sm">
                Als Rechnung übernehmen
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Zeiteinträge gefunden.{" "}
              <Link
                href="/app/zeiten/neu"
                className="text-primary underline-offset-4 hover:underline"
              >
                Ersten Eintrag anlegen
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kund:in</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      <Link
                        href={`/app/zeiten/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatDateDe(e.datum)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {kundeName.get(e.kunde) ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDauerDe(e.dauer_minuten)}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-sm">
                      {e.beschreibung || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(e.status)}>
                        {ABRECHNUNGSSTATUS_LABELS[e.status]}
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
