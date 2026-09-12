import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import {
  kategorieSelectItemsFromStammdaten,
  listAllKategorien,
} from "@/modules/categories";
import { listKontakte } from "@/modules/contacts";
import { createBelegAction } from "@/modules/expenses";
import { BelegForm } from "@/modules/expenses/beleg-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function BelegNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
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
    await listAllKategorien(session.firmaId, { nurAktiv: true }),
  );

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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Beleg anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erstellen Sie zuerst einen Entwurf. Eine Datei können Sie jederzeit
          nachtragen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entwurf</CardTitle>
          <CardDescription>
            Metadaten und Datei können Sie bearbeiten, bis Sie den Beleg
            buchen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BelegForm
            action={createBelegAction}
            steuermodus={steuermodus}
            lieferanten={lieferanten}
            kunden={kunden}
            kategorien={kategorien}
            error={sp.error ?? null}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  );
}
