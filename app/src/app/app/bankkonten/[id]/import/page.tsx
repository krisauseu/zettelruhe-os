import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  BANK_CSV_DEFAULT_HEADER,
  getBankkonto,
  importBankAuszugAction,
  MT940_DIALEKT_HINWEIS,
} from "@/modules/banking";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function BankImportPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const { id } = await params;
  const sp = await searchParams;

  const konto = await getBankkonto(session.firmaId, id);
  if (!konto) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/app/bankkonten/${id}`}
            className="hover:text-foreground hover:underline"
          >
            ← {konto.name}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Kontoauszug importieren
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV (de-DE) oder klassisches SWIFT-MT940 / STA. Doppelte Zeilen
          werden über den Idempotenz-Schlüssel übersprungen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auszugsdatei</CardTitle>
          <CardDescription>
            Dateityp wird am Inhalt erkannt. {MT940_DIALEKT_HINWEIS} CSV:
            Semikolon oder Komma; negativ = Ausgang.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sp.error ? (
            <p className="text-sm text-destructive" role="alert">
              {sp.error}
            </p>
          ) : null}

          {!konto.aktiv ? (
            <p className="text-sm text-destructive" role="alert">
              Dieses Bankkonto ist deaktiviert. Import ist nicht möglich.
            </p>
          ) : !session.kannSchreiben ? (
            <p className="text-sm text-muted-foreground" role="status">
              Import nur mit Schreibrecht. Rolle Lesen sieht den Auszug, legt
              nichts an.
            </p>
          ) : (
            <form action={importBankAuszugAction} className="flex flex-col gap-4">
              <input type="hidden" name="bankkonto" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">Datei (CSV, STA, MT940, TXT)</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,.sta,.txt,.mt940,text/csv,text/plain"
                  required
                  className="block w-full text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
              </div>
              <Button type="submit">Importieren</Button>
            </form>
          )}

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Beispiel CSV
            </p>
            <pre className="mt-1 overflow-x-auto text-xs text-foreground">
              {BANK_CSV_DEFAULT_HEADER}
              {"\n"}
              12.08.2026;119,00;Rechnung R-0001;Muster GmbH;DE89370400440532013000;R-0001
              {"\n"}
              13.08.2026;-25,50;Lastschrift Hosting;Provider AG;;
            </pre>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Beispiel MT940 / STA (Ausschnitt)
            </p>
            <pre className="mt-1 overflow-x-auto text-xs text-foreground">
              {`:20:STARTUMS
:25:DE89370400440532013000
:61:260812C119,00NTRFR-0001
:86:Rechnung R-0001
:62F:C260812EUR119,00`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
