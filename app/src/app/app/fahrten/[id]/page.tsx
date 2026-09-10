import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { ABRECHNUNGSSTATUS_LABELS, formatDateDe } from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import { listProjekte } from "@/modules/projects";
import {
  deleteFahrtAction,
  formatKmDe,
  getFahrt,
  setFahrtStatusAction,
  updateFahrtAction,
} from "@/modules/travel";
import { FahrtForm } from "@/modules/travel/fahrt-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function FahrtDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const fahrt = await getFahrt(session.firmaId, id);
  if (!fahrt) notFound();

  const readOnly = fahrt.status === "abgerechnet" && Boolean(fahrt.rechnung);

  const [kundenResult, projekteResult] = await Promise.all([
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
    listProjekte(session.firmaId, {}, 1, 200),
  ]);

  const kunden = kundenResult.items.map((k) => ({ id: k.id, name: k.name }));
  const projekte = projekteResult.items.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/fahrten"
            className="hover:text-foreground hover:underline"
          >
            ← Fahrten
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {formatDateDe(fahrt.datum)} · {formatKmDe(fahrt.km)} km
          </h1>
          <Badge>{ABRECHNUNGSSTATUS_LABELS[fahrt.status]}</Badge>
        </div>
      </div>

      {sp.saved ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Gespeichert.
        </p>
      ) : null}

      {readOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Abgerechnet</CardTitle>
            <CardDescription>
              Diese Fahrt ist mit einer Rechnung verknüpft und nicht mehr
              editierbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Strecke: </span>
              {fahrt.strecke || "—"}
            </p>
            {fahrt.rechnung ? (
              <Link
                href={`/app/rechnungen/${fahrt.rechnung}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Zur Rechnung
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Bearbeiten</CardTitle>
              <CardDescription>
                Inhalt und Status (light). Nach Verknüpfung mit Rechnung
                immutable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FahrtForm
                action={updateFahrtAction}
                fahrt={fahrt}
                kunden={kunden}
                projekte={projekte}
                submitLabel="Speichern"
                error={sp.error ?? null}
              />
            </CardContent>
          </Card>

          {fahrt.status === "abrechenbar" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Zur Abrechnung</CardTitle>
                <CardDescription>
                  Status auf abgerechnet setzen — oder mit Kund:in-Filter „Als
                  Rechnung übernehmen“.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={setFahrtStatusAction}>
                  <input type="hidden" name="id" value={fahrt.id} />
                  <input type="hidden" name="status" value="abgerechnet" />
                  <Button type="submit" variant="secondary" size="sm">
                    Als abgerechnet markieren
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <form action={deleteFahrtAction}>
            <input type="hidden" name="id" value={fahrt.id} />
            <Button type="submit" variant="danger" size="sm">
              Fahrt löschen
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
