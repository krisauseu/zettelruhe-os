import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { listKontakte } from "@/modules/contacts";
import { listKatalog } from "@/modules/catalog";
import { createAngebotAction } from "@/modules/sales";
import { AngebotForm } from "@/modules/sales/angebot-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function AngebotNeuPage({
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
            href="/app/angebote"
            className="hover:text-foreground hover:underline"
          >
            ← Angebote
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Angebot anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zuerst als Entwurf speichern, dann senden (Nummer + PDF). Kein
          Buchungsjournal — erst bei Rechnung.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entwurf</CardTitle>
          <CardDescription>
            Positionen und Kopfdaten sind editierbar, bis das Angebot gesendet
            wird. Die Angebotsnummer wird erst beim Senden vergeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AngebotForm
            action={createAngebotAction}
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
