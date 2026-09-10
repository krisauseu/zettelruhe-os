import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  RECHNUNG_STATUS_LABELS,
  formatDateDe,
} from "@/lib/labels";
import { listOffenePosten } from "@/modules/payments";
import type { RechnungStatus } from "@/modules/sales/types";
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

export default async function ZahlungenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listOffenePosten(session.firmaId, page, 50);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Zahlungen"
        description="Offene Posten — festgeschriebene Rechnungen mit Restbetrag. Zahlungen erfassen Sie auf der jeweiligen Rechnung. Jede Zahlung erzeugt eine Zufluss-Buchung im Journal."
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Offene Posten</CardTitle>
          <CardDescription>
            Offen, teilbezahlt oder überfällig. Zahlung auf der Rechnung oder
            per Kontoauszug-Matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <EmptyState
              title="Keine offenen Posten"
              description="Festgeschriebene Rechnungen ohne vollständige Zahlung erscheinen hier."
              actionHref="/app/rechnungen"
              actionLabel="Zu den Rechnungen"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fällig</TableHead>
                  <TableHead>Rechnung</TableHead>
                  <TableHead>Kund:in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead className="text-right">Bezahlt</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((p) => (
                  <TableRow key={p.rechnungId}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {p.faellig_am ? formatDateDe(p.faellig_am) : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/rechnungen/${p.rechnungId}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.rechnungsnummer || "Rechnung"}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDateDe(p.rechnungsdatum)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.kundeName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "ueberfaellig"
                            ? "outline"
                            : p.status === "teilbezahlt"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {RECHNUNG_STATUS_LABELS[
                          p.status as RechnungStatus
                        ] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatMoneyDe(p.betrag_brutto, { currency: true })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatMoneyDe(p.bezahlt, { currency: true })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatMoneyDe(p.offen, { currency: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
        <p className="text-center text-sm text-muted-foreground">
          Seite {result.page} von {result.totalPages} ({result.totalItems}{" "}
          Posten)
        </p>
      ) : null}
    </div>
  );
}
