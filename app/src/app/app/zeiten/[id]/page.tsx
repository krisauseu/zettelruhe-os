import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { ABRECHNUNGSSTATUS_LABELS, formatDateDe } from "@/lib/labels";
import { listKontakte } from "@/modules/contacts";
import { listProjekte } from "@/modules/projects";
import {
  deleteZeiteintragAction,
  formatDauerDe,
  getZeiteintrag,
  setZeiteintragStatusAction,
  updateZeiteintragAction,
} from "@/modules/time";
import { ZeitForm } from "@/modules/time/zeit-form";
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

export default async function ZeitDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const eintrag = await getZeiteintrag(session.firmaId, id);
  if (!eintrag) notFound();

  const readOnly = eintrag.status === "abgerechnet" && Boolean(eintrag.rechnung);

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
            href="/app/zeiten"
            className="hover:text-foreground hover:underline"
          >
            ← Zeiten
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {formatDateDe(eintrag.datum)} · {formatDauerDe(eintrag.dauer_minuten)}
          </h1>
          <Badge>{ABRECHNUNGSSTATUS_LABELS[eintrag.status]}</Badge>
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
              Dieser Zeiteintrag ist mit einer Rechnung verknüpft und nicht mehr
              editierbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Beschreibung: </span>
              {eintrag.beschreibung || "—"}
            </p>
            {eintrag.rechnung ? (
              <Link
                href={`/app/rechnungen/${eintrag.rechnung}`}
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
              <ZeitForm
                action={updateZeiteintragAction}
                eintrag={eintrag}
                kunden={kunden}
                projekte={projekte}
                submitLabel="Speichern"
                error={sp.error ?? null}
              />
            </CardContent>
          </Card>

          {eintrag.status === "abrechenbar" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Zur Abrechnung</CardTitle>
                <CardDescription>
                  Status auf abgerechnet setzen (ohne Rechnungspositionen) —
                  oder unter Zeiten mit Kund:in-Filter „Als Rechnung
                  übernehmen“.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={setZeiteintragStatusAction}>
                  <input type="hidden" name="id" value={eintrag.id} />
                  <input type="hidden" name="status" value="abgerechnet" />
                  <Button type="submit" variant="secondary" size="sm">
                    Als abgerechnet markieren
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <form action={deleteZeiteintragAction}>
            <input type="hidden" name="id" value={eintrag.id} />
            <Button type="submit" variant="danger" size="sm">
              Zeiteintrag löschen
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
