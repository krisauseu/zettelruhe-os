import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { listKontakte } from "@/modules/contacts";
import { listProjekte } from "@/modules/projects";
import { createZeiteintragAction } from "@/modules/time";
import { ZeitForm } from "@/modules/time/zeit-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function ZeitNeuPage({
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
            href="/app/zeiten"
            className="hover:text-foreground hover:underline"
          >
            ← Zeiten
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Zeiteintrag anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manuelle Erfassung — kein Live-Timer nötig.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zeiteintrag</CardTitle>
          <CardDescription>
            Kund:in und Dauer sind Pflicht. Status standardmäßig abrechenbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitForm
            action={createZeiteintragAction}
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
