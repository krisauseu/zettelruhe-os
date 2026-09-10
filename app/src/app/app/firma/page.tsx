import Link from "next/link";
import { getFirmaById } from "@/lib/pb";
import { requireFirmaSession } from "@/lib/session";
import { FirmaForm } from "@/modules/platform/firma-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SCHNAPPSCHUSS_NICHT_LESBAR,
  eigeneLageHinweis,
  eigeneUstIdLage,
  getLetzteAnfragendeVerwendung,
  pruefeEigeneUstIdAction,
} from "@/modules/ustid";
import { PruefungAnzeige } from "@/modules/ustid/pruefung-anzeige";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  saved?: string;
  created?: string;
  success?: string;
}>;

export default async function FirmaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const firma = await getFirmaById(session.firmaId);
  const sp = await searchParams;

  if (!firma) {
    return <p className="text-muted-foreground">Keine Firma vorhanden.</p>;
  }

  const lage = eigeneUstIdLage(firma.ust_id);
  let letzteAnfrage = null;
  let schnappschussHinweis: string | null = null;
  if (firma.ust_id) {
    try {
      letzteAnfrage = await getLetzteAnfragendeVerwendung(
        session.firmaId,
        firma.ust_id,
      );
    } catch {
      schnappschussHinweis = SCHNAPPSCHUSS_NICHT_LESBAR;
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Firma"
        description="Stammdaten, Steuer-Modus, Dokumenten-Layout und Nummernkreise der aktiven Firma. Festgeschriebene Belege bleiben beim Steuer-Modus-Wechsel unverändert."
      >
        {session.kannFirmaAnlegen ? (
          <Link
            href="/app/firma/neu"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Weitere Firma anlegen
          </Link>
        ) : null}
      </PageHeader>

      {sp.success ? (
        <p
          className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          {sp.success}
        </p>
      ) : null}

      <FirmaForm
        firma={firma}
        error={sp.error ?? null}
        readOnly={!session.kannVerwalten}
      />

      <Card>
        <CardHeader>
          <CardTitle>Eigene USt-IdNr. und das BZSt</CardTitle>
          <CardDescription>
            Das Auslandsverfahren bestätigt ausländische Nummern gegenüber
            dieser DE-Nummer. Eine isolierte Bestätigung der eigenen Nummer
            gibt es dort nicht.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{eigeneLageHinweis(lage)}</p>
          {schnappschussHinweis ? (
            <p className="text-muted-foreground" role="status">
              {schnappschussHinweis}
            </p>
          ) : null}
          {letzteAnfrage ? (
            <PruefungAnzeige
              pruefung={letzteAnfrage}
              title="Zuletzt als anfragende Nummer verwendet"
            />
          ) : null}
          {firma.steuermodus === "kleinunternehmer" ? (
            <p className="text-xs text-muted-foreground">
              Unter der Kleinunternehmerregelung kann eine USt-IdNr.
              vorkommen. USt-Übersicht und Zusammenfassende Meldung bleiben
              nicht relevant.
            </p>
          ) : null}
          {session.kannSchreiben ? (
            <form action={pruefeEigeneUstIdAction}>
              <Button type="submit" variant="secondary" size="sm">
                Gespeicherte Nummer prüfen (Syntax, kein BZSt-Stempel)
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
