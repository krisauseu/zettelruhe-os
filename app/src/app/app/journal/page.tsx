import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
  QUELLE_TYP_LABELS,
} from "@/lib/labels";
import { listJournal, type Buchungsrichtung, type QuelleTyp } from "@/modules/journal";
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
  richtung?: string;
  von?: string;
  bis?: string;
  quelle?: string;
}>;

export default async function JournalListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const von = sp.von?.trim() ?? "";
  const bis = sp.bis?.trim() ?? "";
  const richtung =
    sp.richtung === "einnahme" || sp.richtung === "ausgabe"
      ? (sp.richtung as Buchungsrichtung)
      : "";
  const quelle = (sp.quelle?.trim() ?? "") as QuelleTyp | "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listJournal(
    session.firmaId,
    {
      q: q || undefined,
      richtung: richtung || undefined,
      von: von || undefined,
      bis: bis || undefined,
      quelle_typ: quelle || undefined,
    },
    page,
    50,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Buchungsjournal"
        description="Unveränderbare, fortlaufende Buchungen. Anlegen = Festschreibung. Zahlungen erzeugen eine Zufluss-Buchung; die Rechnung bleibt die Forderungsbuchung bei Festschreibung."
      >
        {session.kannSchreiben ? (
          <Link
            href="/app/journal/neu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Manuelle Buchung
          </Link>
        ) : null}
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Text, Richtung, Zeitraum oder Quelle filtern.
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
                placeholder="Buchungstext …"
              />
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
                <option value="einnahme">Einnahme</option>
                <option value="ausgabe">Ausgabe</option>
              </select>
            </div>
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor="quelle" className="text-xs text-muted-foreground">
                Quelle
              </Label>
              <select
                id="quelle"
                name="quelle"
                defaultValue={quelle}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Alle</option>
                <option value="zahlung">Zahlung</option>
                <option value="rechnung">Rechnung</option>
                <option value="beleg">Beleg</option>
                <option value="kasse">Kassenbuch</option>
                <option value="manuell">Manuell</option>
                <option value="storno">Storno</option>
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
            <div
              className="flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground"
              role="status"
            >
              <p className="font-medium text-foreground">Noch keine Buchungen</p>
              <p className="max-w-prose leading-relaxed">
                Das Journal füllt sich bei Festschreibung von Belegen, Rechnungen
                und Kassenbuch, bei Zahlungen auf Rechnungen — oder durch
                manuelle Buchung.
              </p>
              <Link
                href="/app/journal/neu"
                className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                Erste manuelle Buchung festschreiben
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">Nr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Text</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {e.laufende_nr}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateDe(e.buchungsdatum)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/journal/${e.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {e.buchungstext}
                      </Link>
                      {e.storno_von ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Gegenbuchung
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.richtung === "einnahme" ? "success" : "muted"
                        }
                      >
                        {BUCHUNGSRICHTUNG_LABELS[e.richtung]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {QUELLE_TYP_LABELS[e.quelle_typ] ?? e.quelle_typ}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatMoneyDe(e.betrag_brutto, { currency: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>{result.totalItems} Eintrag/Einträge</p>
        {result.totalPages > 1 ? (
          <p>
            Seite {result.page} / {result.totalPages}
          </p>
        ) : null}
      </div>
    </div>
  );
}
