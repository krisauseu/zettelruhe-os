import { RcDetails } from "@/modules/expenses/rc-details";
import { calculateRc } from "@/modules/expenses/reverse-charge";
import { todayBerlin } from "@/modules/expenses/invariants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  BELEG_STATUS_LABELS,
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
  formatDateTimeDe,
  STEUERSATZ_LABELS,
} from "@/lib/labels";
import {
  kategorieSelectItemsFromStammdaten,
  listAllKategorien,
} from "@/modules/categories";
import { listKontakte, getKontakt } from "@/modules/contacts";
import {
  deleteBelegAction,
  festschreibenBelegAction,
  belegPartnerId,
  getBeleg,
  partnerLabelFuerRichtung,
  updateBelegAction,
} from "@/modules/expenses";
import { BelegForm } from "@/modules/expenses/beleg-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string;
  saved?: string;
  festgeschrieben?: string;
}>;

export default async function BelegDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const beleg = await getBeleg(session.firmaId, id);
  if (!beleg) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  const kontakteResult = await listKontakte(session.firmaId, {}, 1, 200);
  const lieferanten = kontakteResult.items
    .filter((k) => k.ist_lieferant)
    .map((k) => ({ id: k.id, name: k.name, land: k.land, ust_id: k.ust_id, ausgaben_steuerstandard: k.ausgaben_steuerstandard }));
  const kunden = kontakteResult.items
    .filter((k) => k.ist_kunde)
    .map((k) => ({ id: k.id, name: k.name, land: k.land, ust_id: k.ust_id, ausgaben_steuerstandard: k.ausgaben_steuerstandard }));
  const kategorien = kategorieSelectItemsFromStammdaten(
    await listAllKategorien(session.firmaId),
    beleg.kategorie,
  );

  const partnerId = belegPartnerId(beleg);
  let partnerName: string | null = null;
  if (partnerId) {
    const k = await getKontakt(session.firmaId, partnerId);
    partnerName = k?.name ?? null;
  }

  let rcError = "";
  let rcPreview = null;
  if (beleg.rc) {
    if ("schuld" in beleg.rc) rcPreview = beleg.rc;
    else try { rcPreview = calculateRc(beleg.rc, beleg, steuermodus, todayBerlin()); }
    catch (e) { rcError = e instanceof Error ? e.message : "RC-Angaben prüfen."; }
  }
  const istEntwurf = beleg.status === "entwurf";
  const title =
    beleg.notiz.trim() ||
    beleg.belegnummer ||
    (istEntwurf ? "Beleg-Entwurf" : "Beleg");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/belege"
            className="hover:text-foreground hover:underline"
          >
            ← Belege
          </Link>
        </p>
        <PageHeader
          className="mt-2"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {title}
              <Badge
                variant={
                  beleg.status === "festgeschrieben" ? "success" : "secondary"
                }
              >
                {BELEG_STATUS_LABELS[beleg.status]}
              </Badge>
              <Badge
                variant={beleg.richtung === "einnahme" ? "success" : "muted"}
              >
                {BUCHUNGSRICHTUNG_LABELS[beleg.richtung]}
              </Badge>
            </span>
          }
          description={
            beleg.festgeschrieben_am
              ? `Festgeschrieben am ${formatDateTimeDe(beleg.festgeschrieben_am)}`
              : "Sie können den Beleg bis zur Buchung noch bearbeiten."
          }
        />
        {sp.error ? (
          <p className="mt-2 text-sm text-destructive">{sp.error}</p>
        ) : null}
        {sp.saved ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Gespeichert.
          </p>
        ) : null}
        {sp.festgeschrieben ? (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Beleg festgeschrieben und ins Buchungsjournal übernommen.
          </p>
        ) : null}
      </div>

      {rcPreview && <RcDetails rc={rcPreview} />}
      {beleg.rc && <div className="space-y-2 rounded-md border p-3 text-sm">
        <p>Gespeicherte Auswahl am Beleg. Vorgangsbezug: {beleg.rc.vorgang}</p>
        <p>Leistungsabschnitt: {beleg.rc.leistung_von} bis {beleg.rc.leistung_bis}. Zahlung: {beleg.rc.zahlungsdatum || "kein Datum"}, {beleg.rc.zahlungsbetrag} EUR.</p>
        <p className="whitespace-pre-wrap">Nachweis: {beleg.rc.nachweis}</p>
        {rcError && <p className="text-destructive">Sie können diesen Beleg noch nicht buchen: {rcError}</p>}
      </div>}

      {!istEntwurf ? (
        <Card>
          <CardHeader>
            <CardTitle>Beleg</CardTitle>
            <CardDescription>
              Nur Lesen — festgeschriebene Belege und Dateien sind
              unveränderbar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {beleg.belegnummer ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Belegnummer
                  </dt>
                  <dd className="mt-1 font-mono text-sm">{beleg.belegnummer}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Belegdatum
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDateDe(beleg.belegdatum)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Buchungsdatum
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDateDe(beleg.buchungsdatum || beleg.belegdatum)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {partnerLabelFuerRichtung(beleg.richtung)}
                </dt>
                <dd className="mt-1 text-sm">
                  {partnerName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kategorie
                </dt>
                <dd className="mt-1 text-sm">{beleg.kategorie || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Netto
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {formatMoneyDe(beleg.betrag_netto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  USt
                  {beleg.steuersatz
                    ? ` (${STEUERSATZ_LABELS[beleg.steuersatz] ?? beleg.steuersatz})`
                    : ""}
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {formatMoneyDe(beleg.betrag_ust, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Brutto
                </dt>
                <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
                  {formatMoneyDe(beleg.betrag_brutto, { currency: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Konto
                </dt>
                <dd className="mt-1 text-sm">{beleg.konto || "—"}</dd>
              </div>
              {beleg.notiz ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bezeichnung
                  </dt>
                  <dd className="mt-1 text-sm whitespace-pre-wrap">
                    {beleg.notiz}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datei
                </dt>
                <dd className="mt-1 text-sm">
                  {beleg.datei.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {beleg.datei.map((name) => (
                        <li key={name}>
                          <Link
                            href={`/app/belege/${beleg.id}/datei?${new URLSearchParams({ name }).toString()}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {name} (anzeigen/herunterladen)
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {beleg.journal_eintrag ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Buchungsjournal
                  </dt>
                  <dd className="mt-1 text-sm">
                    <Link
                      href={`/app/journal/${beleg.journal_eintrag}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Journal-Eintrag öffnen
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Entwurf bearbeiten</CardTitle>
              <CardDescription>
                Speichern aktualisiert den Entwurf. Beim Buchen entsteht der
                Journal-Eintrag.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BelegForm
                key={`${beleg.id}:${beleg.updated ?? beleg.created ?? ""}`}
                action={updateBelegAction}
                steuermodus={steuermodus}
                lieferanten={lieferanten}
                kunden={kunden}
                kategorien={kategorien}
                error={sp.error ?? null}
                beleg={beleg}
                mode="edit"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Beleg buchen</CardTitle>
              <CardDescription>
                Vergibt die Belegnummer, schreibt ins Buchungsjournal und
                sperrt danach Metadaten sowie Datei (GoBD-Mindeststandard).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={festschreibenBelegAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" disabled={!!rcError}>Beleg buchen</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entwurf löschen</CardTitle>
              <CardDescription>
                Nur möglich, solange der Beleg nicht festgeschrieben ist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deleteBelegAction}>
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variant="danger" size="sm">
                  Entwurf löschen
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
