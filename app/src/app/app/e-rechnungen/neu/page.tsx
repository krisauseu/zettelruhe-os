import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { uploadERechnungAction } from "@/modules/einvoice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function ERechnungNeuPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireFirmaSession();
  const sp = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/e-rechnungen"
            className="hover:text-foreground hover:underline"
          >
            ← E-Rechnungen
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          E-Rechnung empfangen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Originaldatei wird revisionssicher archiviert und geparst. Bei
          Parse-Fehler bleibt die Datei trotzdem erhalten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datei hochladen</CardTitle>
          <CardDescription>
            XRechnung als XML (UBL) oder ZUGFeRD/Factur-X als CII-XML.
            PDF nur, wenn ein E-Rechnungs-XML als Anhang steckt (auch
            Flate-komprimiert, etwa factur-x.xml). Ein Scan-PDF ohne Anhang
            ist keine E-Rechnung — dann XML hochladen oder Beleg manuell.
            Max. 15&nbsp;MB. Kein Versand in diesem Schritt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sp.error ? (
            <p
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {sp.error}
            </p>
          ) : null}

          <form
            action={uploadERechnungAction}
            className="flex flex-col gap-4"
            encType="multipart/form-data"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="datei">E-Rechnungsdatei *</Label>
              <input
                id="datei"
                name="datei"
                type="file"
                accept=".xml,.pdf,application/xml,text/xml,application/pdf"
                required
                className="block w-full text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notiz">Notiz (optional)</Label>
              <Textarea
                id="notiz"
                name="notiz"
                rows={2}
                placeholder="Interner Hinweis …"
              />
            </div>
            <Button type="submit">Hochladen und parsen</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
