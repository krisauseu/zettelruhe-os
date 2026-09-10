import Link from "next/link";
import { importKontakteAction } from "@/modules/contacts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function KontakteImportPage({
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
          CSV-Import Kontakte
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datei hochladen</CardTitle>
          <CardDescription>
            Semikolon- oder Komma-getrennt. Pflichtspalte:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">name</code>{" "}
            (Alias: Firma). Bool-Spalten:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ist_kunde
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ist_lieferant
            </code>{" "}
            (ja/nein/1/0).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sp.success ? (
            <p className="text-sm text-success" role="status">
              {sp.success}
            </p>
          ) : null}
          {sp.error ? (
            <p className="text-sm text-destructive" role="alert">
              {sp.error}
            </p>
          ) : null}

          <form action={importKontakteAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">CSV-Datei</Label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".csv,text/csv,text/plain"
                required
                className="block w-full text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Importieren</Button>
              <Link
                href="/app/kontakte/export?template=1"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Vorlage herunterladen
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
