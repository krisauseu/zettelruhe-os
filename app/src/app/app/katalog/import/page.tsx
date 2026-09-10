import Link from "next/link";
import { importKatalogAction } from "@/modules/catalog";
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

export default async function KatalogImportPage({
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
            href="/app/katalog"
            className="hover:text-foreground hover:underline"
          >
            ← Katalog
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          CSV-Import Katalog
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datei hochladen</CardTitle>
          <CardDescription>
            Pflicht:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              bezeichnung
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">preis</code>
            . Optional: Einheit, Steuersatz (0/7/19), Notiz, aktiv.
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

          <form action={importKatalogAction} className="flex flex-col gap-4">
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
                href="/app/katalog/export?template=1"
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
