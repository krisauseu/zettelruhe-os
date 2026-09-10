import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe } from "@/lib/labels";
import {
  DEFAULT_AUSWERTUNG_PRESET,
  getEurAuswertung,
  normalizeZeitraumPreset,
  zeitraumFromSearchParams,
} from "@/modules/reporting";
import { ZeitraumFilter } from "@/modules/reporting/zeitraum-filter";
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
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  von?: string;
  bis?: string;
}>;

export default async function EurPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const preset = normalizeZeitraumPreset(sp.preset, DEFAULT_AUSWERTUNG_PRESET);
  const zeitraum = zeitraumFromSearchParams(sp, DEFAULT_AUSWERTUNG_PRESET);
  const eur = await getEurAuswertung(session.firmaId, zeitraum);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="EÜR"
        description={
          <>
            Einnahmen-Überschuss-Rechnung light ·{" "}
            {formatDateDe(zeitraum.von)} – {formatDateDe(zeitraum.bis)} ·{" "}
            {eur.anzahl_buchungen} Buchungen
          </>
        }
      />

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Kategorien light — nicht 1:1 Finanzamts-Software.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Einnahmen (Brutto)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatMoneyDe(eur.summe_einnahmen_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ausgaben (Brutto)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatMoneyDe(eur.summe_ausgaben_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Überschuss (Brutto)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatMoneyDe(eur.ueberschuss_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Netto:{" "}
            {formatMoneyDe(eur.ueberschuss_netto, { currency: true })}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Einnahmen nach Kategorie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">USt</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eur.einnahmen.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {z.anzahl}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_netto, { currency: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_ust, { currency: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_brutto, { currency: true })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell>Summe Einnahmen</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatMoneyDe(eur.summe_einnahmen_netto, { currency: true })}
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatMoneyDe(eur.summe_einnahmen_brutto, {
                    currency: true,
                  })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">USt / Vorsteuer</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eur.ausgaben.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {z.anzahl}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_netto, { currency: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_ust, { currency: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoneyDe(z.summe_brutto, { currency: true })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell>Summe Ausgaben</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatMoneyDe(eur.summe_ausgaben_netto, { currency: true })}
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatMoneyDe(eur.summe_ausgaben_brutto, {
                    currency: true,
                  })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hinweis</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {eur.hinweis_journal_basis}
        </CardContent>
      </Card>
    </div>
  );
}
