import Link from "next/link";
import { createKontaktAction } from "@/modules/contacts";
import { KontaktForm } from "@/modules/contacts/kontakt-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function KontaktNeuPage({
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
            href="/app/kontakte"
            className="hover:text-foreground hover:underline"
          >
            ← Kontakte
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Kontakt anlegen
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Kund:in und/oder Lieferant:in. Die Kontaktnummer wird automatisch
            vergeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KontaktForm
            action={createKontaktAction}
            submitLabel="Anlegen"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
