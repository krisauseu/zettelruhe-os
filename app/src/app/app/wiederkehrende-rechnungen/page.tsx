import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  WIEDERKEHR_RHYTHMUS_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import {
  listWiederkehrendeRechnungen,
  todayBerlin,
} from "@/modules/sales";
import {
  isSmtpConfigured,
  listRecentJobRuns,
  runJobsTickAction,
  JOB_KEY_WIEDERKEHREND,
} from "@/modules/jobs";
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
  aktiv?: string;
  error?: string;
  job?: string;
  jobMsg?: string;
}>;

export default async function WiederkehrendeRechnungenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const aktivRaw = sp.aktiv?.trim() ?? "";
  const aktiv =
    aktivRaw === "1" ? true : aktivRaw === "0" ? false : ("" as const);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const heute = todayBerlin();

  const [result, runs] = await Promise.all([
    listWiederkehrendeRechnungen(
      session.firmaId,
      {
        q: q || undefined,
        aktiv: aktiv === "" ? "" : aktiv,
      },
      page,
      50,
    ),
    listRecentJobRuns(JOB_KEY_WIEDERKEHREND, 3).catch(() => []),
  ]);

  const smtpOk = isSmtpConfigured();
  const lastRun = runs[0] ?? null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Wiederkehrende Rechnungen"
        description={
          <>
            Vorlagen mit Rhythmus — der Job erzeugt Rechnungs-Entwürfe
            (Nummernkreis erst bei Festschreibung). Heute:{" "}
            {formatDateDe(heute)}.
          </>
        }
      >
        {session.kannSchreiben ? (
          <>
            <form action={runJobsTickAction}>
              <input
                type="hidden"
                name="returnTo"
                value="/app/wiederkehrende-rechnungen"
              />
              <Button type="submit" variant="secondary" size="sm">
                Fällige jetzt erzeugen
              </Button>
            </form>
            <Link
              href="/app/wiederkehrende-rechnungen/neu"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Vorlage anlegen
            </Link>
          </>
        ) : null}
      </PageHeader>

      {sp.error ? (
        <p className="text-sm text-destructive">{sp.error}</p>
      ) : null}
      {sp.jobMsg ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Job ({sp.job ?? "ok"}): {sp.jobMsg}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Job &amp; Versand</CardTitle>
          <CardDescription>
            In-Process-Scheduler im Next-Container mit DB-Lock. SMTP:{" "}
            {smtpOk ? "konfiguriert" : "nicht konfiguriert"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {lastRun ? (
            <p>
              Letzter Lauf: {formatDateTimeDe(lastRun.gestartet_am)} —{" "}
              {lastRun.status}
              {lastRun.ergebnis ? ` · ${lastRun.ergebnis}` : ""}
            </p>
          ) : (
            <p>Noch kein Job-Lauf protokolliert.</p>
          )}
        </CardContent>
      </Card>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="q">Suche</Label>
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Bezeichnung…"
              />
            </div>
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor="aktiv">Status</Label>
              <select
                id="aktiv"
                name="aktiv"
                defaultValue={aktivRaw}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Alle</option>
                <option value="1">Aktiv</option>
                <option value="0">Pausiert</option>
              </select>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Filtern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Rhythmus</TableHead>
                <TableHead>Nächstes Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Noch keine wiederkehrenden Rechnungen.
                  </TableCell>
                </TableRow>
              ) : (
                result.items.map((w) => {
                  const faellig = w.aktiv && w.naechstes_datum <= heute;
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link
                          href={`/app/wiederkehrende-rechnungen/${w.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {w.bezeichnung}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {WIEDERKEHR_RHYTHMUS_LABELS[w.rhythmus]}
                        {w.rhythmus === "tage" && w.intervall_tage
                          ? ` (${w.intervall_tage} T.)`
                          : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateDe(w.naechstes_datum)}
                        {faellig ? (
                          <Badge variant="outline" className="ml-2">
                            fällig
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={w.aktiv ? "success" : "secondary"}
                        >
                          {w.aktiv ? "Aktiv" : "Pausiert"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatMoneyDe(w.betrag_brutto, { currency: true })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
        <p className="text-sm text-muted-foreground">
          Seite {result.page} von {result.totalPages} ({result.totalItems}{" "}
          Einträge)
        </p>
      ) : null}
    </div>
  );
}
