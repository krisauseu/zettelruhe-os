import Link from "next/link";
import { requireInstanzEigentuemerSession } from "@/lib/session";
import { FirmaAnlegenForm } from "@/modules/platform/firma-anlegen-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function FirmaNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireInstanzEigentuemerSession();
  const sp = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/firma"
            className="hover:text-foreground hover:underline"
          >
            ← Firma
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Weitere Firma anlegen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eigene Bücher, eigener Steuer-Modus, eigene Nummernkreise. Nach dem
          Anlegen bist du Eigentümer:in dieser Firma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Nach dem Anlegen wird diese Firma aktiv. Belege und Rechnungen der
            bisherigen Firma bleiben isoliert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FirmaAnlegenForm error={sp.error ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
