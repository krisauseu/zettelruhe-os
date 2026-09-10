import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  BANK_BEWEGUNG_STATUS_LABELS,
  BANK_RICHTUNG_LABELS,
  formatDateDe,
} from "@/lib/labels";
import {
  anzeigeVerwendungszweck,
  deleteBankkontoAction,
  getBankkonto,
  listBankBewegungen,
  updateBankkontoAction,
  BankkontoForm,
} from "@/modules/banking";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  import?: string;
}>;

export default async function BankkontoDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const konto = await getBankkonto(session.firmaId, id);
  if (!konto) notFound();

  const bewegungen = await listBankBewegungen(
    session.firmaId,
    { bankkonto: id },
    1,
    30,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/app/bankkonten"
              className="hover:text-foreground hover:underline"
            >
              ← Bankkonten
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {konto.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {konto.kontoinhaber ? `${konto.kontoinhaber} · ` : ""}
            <span className="font-mono">
              {konto.iban || "ohne IBAN"}
              {konto.bic ? ` · ${konto.bic}` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.kannSchreiben ? (
            <Link
              href={`/app/bankkonten/${id}/import`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Auszug importieren
            </Link>
          ) : null}
          <Link
            href={`/app/kontoauszug?bankkonto=${id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Kontoauszug
          </Link>
        </div>
      </div>

      {sp.saved ? (
        <p className="text-sm text-success" role="status">
          Gespeichert.
        </p>
      ) : null}
      {sp.import ? (
        <p className="text-sm text-success" role="status">
          {sp.import}
        </p>
      ) : null}
      {sp.error ? (
        <p className="text-sm text-destructive" role="alert">
          {sp.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Änderungen greifen sofort; bestehende Auszugszeilen bleiben
            erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankkontoForm
            action={updateBankkontoAction}
            bankkonto={konto}
            submitLabel="Speichern"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Letzte Auszugszeilen ({bewegungen.totalItems})
          </CardTitle>
          <CardDescription>
            Offen / gematcht / ignoriert — Matching im Kontoauszug.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {bewegungen.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Noch keine importierten Zeilen.{" "}
              <Link
                href={`/app/bankkonten/${id}/import`}
                className="underline hover:text-foreground"
              >
                CSV oder MT940 importieren
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bewegungen.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateDe(b.datum)}
                    </TableCell>
                    <TableCell>
                      {BANK_RICHTUNG_LABELS[b.richtung] ?? b.richtung}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.richtung === "ausgang" ? "−" : ""}
                      {formatMoneyDe(b.betrag, { currency: true })}
                    </TableCell>
                    <TableCell
                      className="max-w-[22rem] text-sm"
                      title={b.verwendungszweck || undefined}
                    >
                      <span className="line-clamp-2 break-words">
                        {anzeigeVerwendungszweck(b) || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === "gematcht"
                            ? "default"
                            : b.status === "offen"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {BANK_BEWEGUNG_STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Löschen</CardTitle>
          <CardDescription>
            Nur möglich, wenn noch keine Auszugszeilen existieren. Sonst
            deaktivieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteBankkontoAction}>
            <input type="hidden" name="id" value={konto.id} />
            <Button type="submit" variant="danger" size="sm">
              Bankkonto löschen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
