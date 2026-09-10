import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import {
  kategorieSelectItemsFromStammdaten,
  listAllKategorien,
} from "@/modules/categories";
import { listKontakte } from "@/modules/contacts";
import {
  festschreibenKassenbuchAction,
} from "@/modules/cash";
import { neueFinanzRecordId } from "@/lib/finanz-transaktion";
import { KassenbuchForm } from "@/modules/cash/kassenbuch-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  richtung?: string;
  vorgang?: string;
}>;

export default async function KassenbuchNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const firma = await getFirmaById(session.firmaId);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";

  const kontakteResult = await listKontakte(session.firmaId, {}, 1, 200).catch(
    () => ({ items: [] as { id: string; name: string }[] }),
  );

  const defaultRichtung =
    sp.richtung === "ausgabe" ? "ausgabe" : "einnahme";
  const kategorien = kategorieSelectItemsFromStammdaten(
    await listAllKategorien(session.firmaId, { nurAktiv: true }),
  );
  const vorgangId = /^[a-z0-9]{15}$/.test(sp.vorgang ?? "")
    ? sp.vorgang!
    : neueFinanzRecordId();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/kassenbuch"
            className="hover:text-foreground hover:underline"
          >
            ← Kassenbuch
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Bareinnahme / Barausgabe
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wird mit Speichern festgeschrieben und ins Buchungsjournal
          übernommen (GoBD-Mindeststandard).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Festschreiben</CardTitle>
          <CardDescription>
            Kein Entwurf — der Eintrag erhält eine Belegnummer und ist danach
            unveränderbar. Korrektur nur über Storno/Gegenbuchung. Der Saldo
            darf nicht negativ werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KassenbuchForm
            action={festschreibenKassenbuchAction}
            steuermodus={steuermodus}
            kontakte={kontakteResult.items.map((k) => ({
              id: k.id,
              name: k.name,
            }))}
            kategorien={kategorien}
            error={sp.error ?? null}
            defaultRichtung={defaultRichtung}
            vorgangId={vorgangId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
