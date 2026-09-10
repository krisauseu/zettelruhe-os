import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import {
  deleteKatalogAction,
  getKatalogPosition,
  updateKatalogAction,
} from "@/modules/catalog";
import { KatalogForm } from "@/modules/catalog/katalog-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function KatalogDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();

  const { id } = await params;
  const sp = await searchParams;
  const position = await getKatalogPosition(session.firmaId, id);
  if (!position) notFound();

  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/katalog"
            className="hover:text-foreground hover:underline"
          >
            ← Katalog
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {position.bezeichnung}
        </h1>
        {sp.saved ? (
          <p className="mt-1 text-sm text-success">Gespeichert.</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bearbeiten</CardTitle>
          <CardDescription>Preis und Stammdaten anpassen.</CardDescription>
        </CardHeader>
        <CardContent>
          <KatalogForm
            action={updateKatalogAction}
            position={position}
            steuermodus={steuermodus}
            submitLabel="Speichern"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Position löschen</CardTitle>
          <CardDescription>
            Entfernt die Katalog-Position. Bestehende Belege bleiben unberührt
            (noch nicht in Abschnitt 2).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteKatalogAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="danger" size="sm">
              Endgültig löschen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
