import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { listKontakte } from "@/modules/contacts";
import { listKatalog } from "@/modules/catalog";
import { createWiederkehrAction } from "@/modules/sales";
import { WiederkehrendForm } from "@/modules/sales/wiederkehrend-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function NeueWiederkehrendeRechnungPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  const [kundenResult, katalogResult] = await Promise.all([
    listKontakte(session.firmaId, { rolle: "kunde" }, 1, 200),
    listKatalog(session.firmaId, { nurAktiv: true }, 1, 200),
  ]);

  const kunden = kundenResult.items.map((k) => ({
    id: k.id,
    name: k.name,
  }));
  const katalog = katalogResult.items.map((p) => ({
    id: p.id,
    bezeichnung: p.bezeichnung,
    einheit: p.einheit,
    preis: p.preis,
    steuersatz: p.steuersatz || "",
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/wiederkehrende-rechnungen"
            className="hover:text-foreground hover:underline"
          >
            ← Wiederkehrende Rechnungen
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Vorlage anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Periodische Rechnungs-Entwürfe aus Kund:in, Positionen und Rhythmus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wiederkehrende Rechnung</CardTitle>
          <CardDescription>
            Der Job erzeugt Entwürfe; Festschreiben und Nummernkreis bleiben
            manuell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WiederkehrendForm
            action={createWiederkehrAction}
            steuermodus={steuermodus}
            kunden={kunden}
            katalog={katalog}
            error={sp.error ?? null}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  );
}
