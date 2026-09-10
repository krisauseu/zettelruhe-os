import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  formatDateDe,
  formatDateTimeDe,
  STEUERSATZ_LABELS,
} from "@/lib/labels";
import {
  findKassenbuchStornoFuer,
  getKassenbuchEintrag,
  getSaldoNachEintrag,
  storniereKassenbuchAction,
  todayBerlin,
} from "@/modules/cash";
import { getKontakt } from "@/modules/contacts";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function KassenbuchDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const eintrag = await getKassenbuchEintrag(session.firmaId, id);
  if (!eintrag) notFound();

  const storno = eintrag.storno_von
    ? null
    : await findKassenbuchStornoFuer(session.firmaId, id);

  const saldoNach = await getSaldoNachEintrag(session.firmaId, id);

  let kontaktName: string | null = null;
  if (eintrag.kontakt) {
    const k = await getKontakt(session.firmaId, eintrag.kontakt);
    kontaktName = k?.name ?? null;
  }

  const istStornoBuchung = Boolean(eintrag.storno_von);
  const istBereitsStorniert = Boolean(storno);
  const kannStornieren = !istStornoBuchung && !istBereitsStorniert;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/kassenbuch"
            className="hover:text-foreground hover:underline"
          >
            ← Kassenbuch
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {eintrag.belegnummer}
          </h1>
          <Badge
            variant={eintrag.richtung === "einnahme" ? "success" : "muted"}
          >
            {eintrag.richtung === "einnahme" ? "Bareinnahme" : "Barausgabe"}
          </Badge>
          {istStornoBuchung ? (
            <Badge variant="secondary">Gegenbuchung</Badge>
          ) : null}
          {istBereitsStorniert ? (
            <Badge variant="secondary">Storniert</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Festgeschrieben am {formatDateTimeDe(eintrag.festgeschrieben_am)}
        </p>
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eintrag</CardTitle>
          <CardDescription>
            Nur Lesen — festgeschriebene Einträge sind unveränderbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Text
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {eintrag.text}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Datum
              </dt>
              <dd className="mt-1 text-sm">{formatDateDe(eintrag.datum)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Belegnummer
              </dt>
              <dd className="mt-1 font-mono text-sm">{eintrag.belegnummer}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Netto
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">
                {formatMoneyDe(eintrag.betrag_netto, { currency: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                USt
                {eintrag.steuersatz
                  ? ` (${STEUERSATZ_LABELS[eintrag.steuersatz] ?? eintrag.steuersatz})`
                  : ""}
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">
                {formatMoneyDe(eintrag.betrag_ust, { currency: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Brutto (Kasse)
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                {formatMoneyDe(eintrag.betrag_brutto, { currency: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saldo danach
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">
                {saldoNach
                  ? formatMoneyDe(saldoNach, { currency: true })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kategorie
              </dt>
              <dd className="mt-1 text-sm">{eintrag.kategorie || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kontakt
              </dt>
              <dd className="mt-1 text-sm">
                {kontaktName ? (
                  <Link
                    href={`/app/kontakte/${eintrag.kontakt}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {kontaktName}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {eintrag.notiz ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notiz
                </dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">
                  {eintrag.notiz}
                </dd>
              </div>
            ) : null}
            {eintrag.journal_eintrag ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Buchungsjournal
                </dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/app/journal/${eintrag.journal_eintrag}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Journal-Eintrag öffnen
                  </Link>
                </dd>
              </div>
            ) : null}
            {eintrag.storno_von ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Storno von
                </dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/app/kassenbuch/${eintrag.storno_von}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Ursprünglicher Eintrag
                  </Link>
                </dd>
              </div>
            ) : null}
            {storno ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Gegenbuchung
                </dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/app/kassenbuch/${storno.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {storno.belegnummer}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {kannStornieren ? (
        <Card>
          <CardHeader>
            <CardTitle>Storno / Gegenbuchung</CardTitle>
            <CardDescription>
              Erzeugt eine entgegengesetzte Kassenbuch-Buchung und storniert
              den Journal-Eintrag. Der Original-Eintrag bleibt unverändert.
              Der Saldo darf dabei nicht negativ werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmForm
              action={storniereKassenbuchAction}
              title="Kassenbuch-Eintrag stornieren?"
              message="Es wird eine entgegengesetzte Kassenbuch-Buchung erzeugt. Der Original-Eintrag bleibt unverändert. Der Saldo darf dabei nicht negativ werden."
              confirmLabel="Jetzt stornieren"
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="id" value={id} />
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="datum">Datum Storno</Label>
                <Input
                  id="datum"
                  name="datum"
                  type="date"
                  defaultValue={todayBerlin()}
                />
              </div>
              <Button type="submit" variant="danger" size="sm">
                Gegenbuchung festschreiben
              </Button>
            </ConfirmForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
