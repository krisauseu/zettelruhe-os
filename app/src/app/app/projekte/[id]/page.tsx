import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { listKontakte } from "@/modules/contacts";
import {
  deleteProjektAction,
  getProjekt,
  updateProjektAction,
} from "@/modules/projects";
import { ProjektForm } from "@/modules/projects/projekt-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function ProjektDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const projekt = await getProjekt(session.firmaId, id);
  if (!projekt) notFound();

  const kundenResult = await listKontakte(
    session.firmaId,
    { rolle: "kunde" },
    1,
    200,
  );
  const kunden = kundenResult.items.map((k) => ({ id: k.id, name: k.name }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/app/projekte"
              className="hover:text-foreground hover:underline"
            >
              ← Projekte
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {projekt.name}
          </h1>
        </div>
        <Link
          href={`/app/zeiten?projekt=${projekt.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Zeiten anzeigen
        </Link>
      </div>

      {sp.saved ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Gespeichert.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bearbeiten</CardTitle>
          <CardDescription>
            Stammdaten des Projekts. Inaktive Projekte bleiben in der Historie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProjektForm
            action={updateProjektAction}
            projekt={projekt}
            kunden={kunden}
            submitLabel="Speichern"
            error={sp.error ?? null}
          />

          <form action={deleteProjektAction} className="border-t border-border pt-4">
            <input type="hidden" name="id" value={projekt.id} />
            <Button type="submit" variant="danger" size="sm">
              Projekt löschen
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Bestehende Zeiten/Fahrten behalten ihre Referenz (ohne Cascade).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
