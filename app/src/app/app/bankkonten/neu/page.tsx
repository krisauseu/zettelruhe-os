import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { createBankkontoAction, BankkontoForm } from "@/modules/banking";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function BankkontoNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireFirmaSession();
  const sp = await searchParams;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/bankkonten"
            className="hover:text-foreground hover:underline"
          >
            ← Bankkonten
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Bankkonto anlegen
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Name, optional Kontoinhaber, IBAN und BIC. Mehrere Bankkonten
            möglich; Kassenbuch bleibt getrennt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sp.error ? (
            <p className="text-sm text-destructive" role="alert">
              {sp.error}
            </p>
          ) : null}
          <BankkontoForm
            action={createBankkontoAction}
            submitLabel="Anlegen"
          />
        </CardContent>
      </Card>
    </div>
  );
}
