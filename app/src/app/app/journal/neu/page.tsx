import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { festschreibenManuelleBuchungAction } from "@/modules/journal";
import { BuchungForm } from "@/modules/journal/buchung-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function JournalNeuPage({
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
            href="/app/journal"
            className="hover:text-foreground hover:underline"
          >
            ← Buchungsjournal
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Manuelle Buchung
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wird mit Speichern festgeschrieben (GoBD-Mindeststandard).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Festschreiben</CardTitle>
          <CardDescription>
            Kein Entwurf — der Eintrag ist danach unveränderbar. Korrektur nur
            über Storno/Gegenbuchung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BuchungForm
            action={festschreibenManuelleBuchungAction}
            steuermodus={steuermodus}
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
