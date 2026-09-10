import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  STEUERMODUS_LABELS,
  STEUERSATZ_LABELS,
  WIEDERKEHR_RHYTHMUS_LABELS,
  formatDateDe,
  formatDateTimeDe,
} from "@/lib/labels";
import { listKontakte, getKontakt } from "@/modules/contacts";
import { listKatalog } from "@/modules/catalog";
import {
  deleteWiederkehrAction,
  erzeugeFaelligeAction,
  erzeugeJetztAction,
  getWiederkehrendeRechnungMitPositionen,
  setWiederkehrAktivAction,
  todayBerlin,
  updateWiederkehrAction,
} from "@/modules/sales";
import { WiederkehrendForm } from "@/modules/sales/wiederkehrend-form";
import { Button } from "@/components/ui/button";
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

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  erzeugt?: string;
  erzeugtCount?: string;
}>;

export default async function WiederkehrDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const vorlage = await getWiederkehrendeRechnungMitPositionen(
    session.firmaId,
    id,
  );
  if (!vorlage) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? vorlage.steuermodus;
  const showUst = vorlage.steuermodus === "regelbesteuerung_ist";
  const heute = todayBerlin();
  const faellig = vorlage.aktiv && vorlage.naechstes_datum <= heute;

  const [kundenResult, katalogResult] = await Promise.all([
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
    listKatalog(session.firmaId, { nurAktiv: true }, 1, 200),
  ]);

  const kunden = kundenResult.items.map((k) => ({
    id: k.id,
    name: k.name,
  }));
  const katalog = katalogResult.items.map((p) => ({
    id: p.id,
    bezeichnung: p.bezeichnung,
    einheit: p.einheit,
    preis: p.preis,
    steuersatz: p.steuersatz || "",
  }));

  let kundeName: string | null = null;
  if (vorlage.kunde) {
    const k = await getKontakt(session.firmaId, vorlage.kunde);
    kundeName = k?.name ?? null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/wiederkehrende-rechnungen"
            className="hover:text-foreground hover:underline"
          >
            ← Wiederkehrende Rechnungen
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {vorlage.bezeichnung}
          </h1>
          <Badge variant={vorlage.aktiv ? "success" : "secondary"}>
            {vorlage.aktiv ? "Aktiv" : "Pausiert"}
          </Badge>
          {faellig ? <Badge variant="outline">fällig</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {WIEDERKEHR_RHYTHMUS_LABELS[vorlage.rhythmus]}
          {vorlage.rhythmus === "tage" && vorlage.intervall_tage
            ? ` · alle ${vorlage.intervall_tage} Tage`
            : ""}
          {" · nächstes Datum "}
          {formatDateDe(vorlage.naechstes_datum)}
        </p>
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
        {sp.saved ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Gespeichert.
          </p>
        ) : null}
        {sp.erzeugt ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Rechnungs-Entwurf erzeugt.{" "}
            <Link
              href={`/app/rechnungen/${sp.erzeugt}`}
              className="underline underline-offset-4"
            >
              Entwurf öffnen
            </Link>
          </p>
        ) : null}
        {sp.erzeugtCount ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            {sp.erzeugtCount} Rechnungs-Entwurf/Entwürfe erzeugt (fällige
            Perioden).
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Übersicht</CardTitle>
          <CardDescription>
            Kund:in {kundeName || "—"} ·{" "}
            {STEUERMODUS_LABELS[vorlage.steuermodus]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Betrag
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">
                {formatMoneyDe(vorlage.betrag_brutto, { currency: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Zahlungsziel
              </dt>
              <dd className="mt-1 text-sm">
                {vorlage.zahlungsziel_tage} Tage
              </dd>
            </div>
            {vorlage.zuletzt_erzeugt_am ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Zuletzt erzeugt
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDateTimeDe(vorlage.zuletzt_erzeugt_am)}
                </dd>
              </div>
            ) : null}
            {vorlage.letzte_rechnung ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Letzte Rechnung
                </dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/app/rechnungen/${vorlage.letzte_rechnung}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Entwurf/Rechnung öffnen
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positionen</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Bezeichnung</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Einzel</TableHead>
                {showUst ? (
                  <TableHead className="text-right">USt</TableHead>
                ) : null}
                <TableHead className="text-right">Summe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vorlage.positionen.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.bezeichnung}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {p.menge}
                    {p.einheit ? ` ${p.einheit}` : ""}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoneyDe(p.einzelpreis)}
                  </TableCell>
                  {showUst ? (
                    <TableCell className="text-right text-xs">
                      {p.steuersatz
                        ? (STEUERSATZ_LABELS[p.steuersatz] ?? p.steuersatz)
                        : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoneyDe(
                      showUst ? p.betrag_netto : p.betrag_brutto,
                      { currency: true },
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktionen</CardTitle>
          <CardDescription>
            Erzeugt Rechnungs-Entwürfe über den bestehenden Sales-Pfad (kein
            Auto-Festschreiben).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={erzeugeJetztAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" size="sm">
              Jetzt erzeugen
            </Button>
          </form>
          {faellig ? (
            <form action={erzeugeFaelligeAction}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="secondary" size="sm">
                Fällige nachholen
              </Button>
            </form>
          ) : null}
          <form action={setWiederkehrAktivAction}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="aktiv"
              value={vorlage.aktiv ? "0" : "1"}
            />
            <Button type="submit" variant="outline" size="sm">
              {vorlage.aktiv ? "Pausieren" : "Aktivieren"}
            </Button>
          </form>
          <form action={deleteWiederkehrAction}>
            <input type="hidden" name="id" value={id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive"
            >
              Vorlage löschen
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorlage bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <WiederkehrendForm
            action={updateWiederkehrAction}
            steuermodus={steuermodus}
            kunden={kunden}
            katalog={katalog}
            error={sp.error ?? null}
            vorlage={vorlage}
            mode="edit"
          />
        </CardContent>
      </Card>
    </div>
  );
}
