import Link from "next/link";
import { getFirmaById } from "@/lib/pb";
import { requireFirmaSession } from "@/lib/session";
import { createKatalogAction } from "@/modules/catalog";
import { KatalogForm } from "@/modules/catalog/katalog-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function KatalogNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
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
          Position anlegen
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produkt / Leistung</CardTitle>
          <CardDescription>
            Bezeichnung, Einheit und Preis (cent-genau).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KatalogForm
            action={createKatalogAction}
            steuermodus={steuermodus}
            submitLabel="Anlegen"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
