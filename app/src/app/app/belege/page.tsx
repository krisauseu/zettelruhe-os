import Link from "next/link";
import { Paperclip } from "lucide-react";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  BELEG_STATUS_LABELS,
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
} from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import {
  belegBezeichnungLabel,
  belegPartnerId,
  listBelege,
  type BelegStatus,
  type Buchungsrichtung,
} from "@/modules/expenses";
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
  richtung?: string;
  von?: string;
  bis?: string;
}>;

export default async function BelegeListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const status =
    sp.status === "entwurf" || sp.status === "festgeschrieben"
      ? (sp.status as BelegStatus)
      : "";
  const richtung =
    sp.richtung === "einnahme" || sp.richtung === "ausgabe"
      ? (sp.richtung as Buchungsrichtung)
      : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, kontakteResult] = await Promise.all([
    listBelege(
      session.firmaId,
      {
        q: q || undefined,
        status: status || undefined,
        richtung: richtung || undefined,
        von: von || undefined,
        bis: bis || undefined,
      },
      page,
      50,
    ),
    listKontakte(session.firmaId, {}, 1, 200),
  ]);
  const kontaktName = new Map(
    kontakteResult.items.map((k) => [k.id, k.name]),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Belege"
        description="Ausgaben und Einnahmen mit Beleg. Als Entwurf speichern und danach buchen."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/belege/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Beleg anlegen
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Text, Status, Richtung oder Zeitraum filtern.
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
                placeholder="Kategorie, Bezeichnung, Nummer, Lieferant:in, Kund:in …"
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
                <option value="festgeschrieben">Festgeschrieben</option>
              </select>
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
                <option value="ausgabe">Ausgabe</option>
                <option value="einnahme">Einnahme</option>
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
              title={q || status ? "Keine Belege gefunden" : "Noch keine Belege"}
              description={
                q || status
                  ? "Filter anpassen oder neuen Beleg anlegen."
                  : "Ausgaben und Einnahmen mit Beleg. Als Entwurf speichern und danach buchen."
              }
              actionHref="/app/belege/neu"
              actionLabel="Ersten Beleg anlegen"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Datum</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Lieferant:in / Kund:in</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((b) => {
                  const hatBezeichnung = Boolean(b.notiz.trim());
                  const bezeichnung = belegBezeichnungLabel(b.notiz);
                  const hatMeta = Boolean(b.belegnummer) || b.datei.length > 0;
                  const partnerId = belegPartnerId(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateDe(b.belegdatum)}
                      </TableCell>
                      <TableCell className="max-w-[20rem]">
                        <Link
                          href={`/app/belege/${b.id}`}
                          className="group block"
                        >
                          <span
                            className={cn(
                              "font-medium break-words group-hover:text-primary group-hover:underline",
                              hatBezeichnung
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {bezeichnung}
                          </span>
                          {hatMeta ? (
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {b.belegnummer ? (
                                <span>{b.belegnummer}</span>
                              ) : null}
                              <BelegDateiHinweis anzahl={b.datei.length} />
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {partnerId
                          ? (kontaktName.get(partnerId) ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.kategorie || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            b.status === "festgeschrieben"
                              ? "success"
                              : "secondary"
                          }
                        >
                          {BELEG_STATUS_LABELS[b.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <Badge
                            variant={
                              b.richtung === "einnahme" ? "success" : "muted"
                            }
                          >
                            {BUCHUNGSRICHTUNG_LABELS[b.richtung]}
                          </Badge>
                          <span className="font-mono text-xs tabular-nums">
                            {formatMoneyDe(b.betrag_brutto, {
                              currency: true,
                            })}
                          </span>
                        </span>
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
        <p>{result.totalItems} Beleg/Belege</p>
        {result.totalPages > 1 ? (
          <p>
            Seite {result.page} / {result.totalPages}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BelegDateiHinweis({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null;
  const label = anzahl === 1 ? "mit Datei" : `mit ${anzahl} Dateien`;
  return (
    <span
      className="inline-flex items-center text-muted-foreground"
      title={label}
      aria-label={label}
    >
      <Paperclip className="size-3.5 shrink-0" aria-hidden />
      {anzahl > 1 ? (
        <span className="ml-0.5 tabular-nums">{anzahl}</span>
      ) : null}
    </span>
  );
}
