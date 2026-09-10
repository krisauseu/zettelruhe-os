import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { listKontakte } from "@/modules/contacts";
import { createProjektAction } from "@/modules/projects";
import { ProjektForm } from "@/modules/projects/projekt-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function ProjektNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const kundenResult = await listKontakte(
    session.firmaId,
    { rolle: "kunde" },
    1,
    200,
  );
  const kunden = kundenResult.items.map((k) => ({ id: k.id, name: k.name }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
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
          Projekt anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Light Stammdaten — optional für Zeiten und Fahrten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projekt</CardTitle>
          <CardDescription>
            Kund:in und Name sind Pflicht. Keine Budget-Pflicht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjektForm
            action={createProjektAction}
            kunden={kunden}
            submitLabel="Anlegen"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
