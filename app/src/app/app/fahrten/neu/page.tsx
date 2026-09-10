import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { listKontakte } from "@/modules/contacts";
import { listProjekte } from "@/modules/projects";
import { createFahrtAction } from "@/modules/travel";
import { FahrtForm } from "@/modules/travel/fahrt-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function FahrtNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;

  const [kundenResult, projekteResult] = await Promise.all([
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
    listProjekte(session.firmaId, { aktiv: true }, 1, 200),
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Fahrt anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kilometererfassung — standardmäßig abrechenbar an Kund:in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fahrt</CardTitle>
          <CardDescription>
            Kund:in und Kilometer sind Pflicht. Optional steuerlich relevant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FahrtForm
            action={createFahrtAction}
            kunden={kunden}
            projekte={projekte}
            submitLabel="Anlegen"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
