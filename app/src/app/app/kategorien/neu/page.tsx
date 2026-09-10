import Link from "next/link";
import { createKategorieAction } from "@/modules/categories";
import { KategorieForm } from "@/modules/categories/kategorie-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function KategorieNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

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
          Kategorie anlegen
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Gilt für Belege und Kassenbuch. Der gewählte Name wird am Eintrag
            als Text gespeichert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KategorieForm
            action={createKategorieAction}
            submitLabel="Anlegen"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
