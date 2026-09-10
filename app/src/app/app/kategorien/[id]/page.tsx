import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  countKategorieVerwendung,
  deleteKategorieAction,
  getKategorie,
  updateKategorieAction,
} from "@/modules/categories";
import { KategorieForm } from "@/modules/categories/kategorie-form";
import { ConfirmForm } from "@/components/ui/confirm-form";
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
type SearchParams = Promise<{ error?: string; saved?: string; created?: string }>;

export default async function KategorieDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;
  const kategorie = await getKategorie(session.firmaId, id);
  if (!kategorie) notFound();

  const usage = await countKategorieVerwendung(session.firmaId, kategorie.name);
  const verwendet = usage.belege + usage.kasse > 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/kategorien"
            className="hover:text-foreground hover:underline"
          >
            ← Kategorien
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {kategorie.name}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bearbeiten</CardTitle>
          <CardDescription>
            Umbenennen ändert nur die Liste. Bereits gespeicherte Belege und
            Kassenbuch-Zeilen behalten den alten Namen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KategorieForm
            action={updateKategorieAction}
            kategorie={kategorie}
            submitLabel="Speichern"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Kategorie löschen</CardTitle>
          <CardDescription>
            {verwendet
              ? `In Verwendung: ${usage.belege} Beleg(e), ${usage.kasse} Kassenbuch-Zeile(n). Löschen ist gesperrt — deaktivieren Sie die Kategorie.`
              : "Nur möglich, wenn kein Beleg und keine Kassenbuch-Zeile diesen Namen trägt."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verwendet ? (
            <p className="text-sm text-muted-foreground">
              Löschen würde die Auswahlliste und die Historie auseinanderlaufen
              lassen. Bitte auf inaktiv setzen.
            </p>
          ) : (
            <ConfirmForm
              action={deleteKategorieAction}
              title="Kategorie löschen?"
              message={`„${kategorie.name}“ wird aus der Auswahlliste entfernt.`}
              confirmLabel="Endgültig löschen"
            >
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="danger" size="sm">
                Endgültig löschen
              </Button>
            </ConfirmForm>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
