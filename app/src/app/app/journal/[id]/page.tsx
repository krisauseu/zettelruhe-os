import { RcDetails } from "@/modules/expenses/rc-details";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import {
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
  formatDateTimeDe,
  QUELLE_TYP_LABELS,
  STEUERSATZ_LABELS,
} from "@/lib/labels";
import {
  findStornoFuer,
  getJournalEintrag,
  storniereBuchungAction,
  todayBerlin,
} from "@/modules/journal";
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

export default async function JournalDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const eintrag = await getJournalEintrag(session.firmaId, id);
  if (!eintrag) notFound();

  const storno = eintrag.storno_von
    ? null
    : await findStornoFuer(session.firmaId, id);

  const istStornoBuchung = Boolean(eintrag.storno_von);
  const istBereitsStorniert = Boolean(storno);
  const kannStornieren = !istStornoBuchung && !istBereitsStorniert;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/journal"
            className="hover:text-foreground hover:underline"
          >
            ← Buchungsjournal
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Journal-Nr. {eintrag.laufende_nr}
          </h1>
          <Badge
            variant={eintrag.richtung === "einnahme" ? "success" : "muted"}
          >
            {BUCHUNGSRICHTUNG_LABELS[eintrag.richtung]}
          </Badge>
          {istStornoBuchung ? (
            <Badge variant="secondary">Gegenbuchung</Badge>
          ) : null}
          {istBereitsStorniert ? (
            <Badge variant="secondary">Storniert</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Festgeschrieben am{" "}
          {formatDateTimeDe(eintrag.festgeschrieben_am)}
        </p>
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
      </div>

      {eintrag.rc && <>
        <RcDetails rc={eintrag.rc} />
        <p className="text-sm whitespace-pre-wrap">Vorgang: {eintrag.rc.vorgang}. Nachweis: {eintrag.rc.nachweis}</p>
        {eintrag.rc.korrektur && <p className="text-sm">Korrektur: {eintrag.rc.korrektur.art}, Datum {eintrag.rc.korrektur.datum}. Nachweis: {eintrag.rc.korrektur.nachweis}</p>}
      </>}
      <Card>
        <CardHeader>
          <CardTitle>Buchung</CardTitle>
          <CardDescription>
            Nur Lesen — festgeschriebene Einträge sind unveränderbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Buchungstext
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {eintrag.buchungstext}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Buchungsdatum
              </dt>
              <dd className="mt-1 text-sm">
                {formatDateDe(eintrag.buchungsdatum)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Belegdatum
              </dt>
              <dd className="mt-1 text-sm">
                {eintrag.belegdatum
                  ? formatDateDe(eintrag.belegdatum)
                  : "—"}
              </dd>
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
                Brutto
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                {formatMoneyDe(eintrag.betrag_brutto, { currency: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Konto
              </dt>
              <dd className="mt-1 text-sm">{eintrag.konto || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quelle
              </dt>
              <dd className="mt-1 text-sm">
                {QUELLE_TYP_LABELS[eintrag.quelle_typ] ?? eintrag.quelle_typ}
                {eintrag.quelle_id ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    ({eintrag.quelle_id})
                  </span>
                ) : null}
              </dd>
            </div>
            {eintrag.storno_von ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Storno von
                </dt>
                <dd className="mt-1 text-sm">
                  <Link
                    href={`/app/journal/${eintrag.storno_von}`}
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
                    href={`/app/journal/${storno.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Journal-Nr. {storno.laufende_nr}
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
              Erzeugt eine neue, entgegengesetzte Buchung. Der Original-Eintrag
              bleibt unverändert erhalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmForm
              action={storniereBuchungAction}
              title="Gegenbuchung festschreiben?"
              message="Es wird eine neue, entgegengesetzte Buchung erzeugt. Der Original-Eintrag bleibt unverändert."
              confirmLabel="Jetzt stornieren"
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="id" value={id} />
              {eintrag.rc && <>
                <Label htmlFor="rc_korrektur_art">RC-Korrekturgrund *</Label>
                <select className="h-9 rounded-md border bg-background px-3 text-sm" id="rc_korrektur_art" name="rc_korrektur_art" required defaultValue="">
                  <option value="">Bitte wählen</option>
                  <option value="erfassungsfehler">Erfassungsfehler: ursprüngliche Steuerperiode und Abfluss berichtigen</option>
                  <option value="vollstaendige_rueckzahlung">Nachgewiesene vollständige Rückzahlung: spätere Rückzahlungsperiode</option>
                </select>
                <p className="text-sm">Bei Rückzahlung unten das tatsächliche Rückzahlungsdatum eintragen; eine Gutschrift allein reicht nicht. Bei Erfassungsfehler das Berichtigungsdatum angeben, der ursprüngliche Steuerzeitpunkt bleibt erhalten. Teilminderungen und Zahlungsketten werden nicht unterstützt.</p>
                <Label htmlFor="rc_korrektur_nachweis">Nachweis der RC-Korrektur *</Label>
                <Input id="rc_korrektur_nachweis" name="rc_korrektur_nachweis" required minLength={3} maxLength={2000} />
              </>}
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="buchungsdatum">Buchungsdatum Storno</Label>
                <Input
                  id="buchungsdatum"
                  name="buchungsdatum"
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
