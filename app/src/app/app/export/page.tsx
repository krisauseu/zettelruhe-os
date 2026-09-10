import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatDateDe } from "@/lib/labels";
import {
  DATEV_FORMAT_ID,
  zeitraumFromSearchParams,
} from "@/modules/reporting";
import { ZeitraumFilter } from "@/modules/reporting/zeitraum-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  preset?: string;
  von?: string;
  bis?: string;
}>;

function qs(preset: string, von: string, bis: string): string {
  const p = new URLSearchParams({
    preset,
    von,
    bis,
  });
  return p.toString();
}

export default async function ExportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireFirmaSession();
  const sp = await searchParams;
  const preset = (sp.preset ?? "monat").trim() || "monat";
  const zeitraum = zeitraumFromSearchParams(sp);
  const q = qs(preset, zeitraum.von, zeitraum.bis);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Export"
        description={
          <>
            DATEV light, Journal-CSV und Belegarchiv für Steuerkanzlei und
            Prüfung · {formatDateDe(zeitraum.von)} –{" "}
            {formatDateDe(zeitraum.bis)}
          </>
        }
      />

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Gilt für alle Downloads auf dieser Seite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DATEV-Export light</CardTitle>
          <CardDescription>
            CSV/EXTF-ähnlich für die Steuerkanzlei. Format:{" "}
            <code className="text-xs">{DATEV_FORMAT_ID}</code> — kein
            DATEV-Zertifizierungs-Claim. Enthält der Zeitraum Reverse Charge,
            lehnt der Export vollständig ab, weil keine verifizierte RC-Zuordnung
            vorliegt. Dann den Journal-CSV verwenden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/app/export/datev?${q}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            DATEV-CSV herunterladen
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buchungsjournal (CSV)</CardTitle>
          <CardDescription>
            Alle Journal-Zeilen im Zeitraum (Semikolon, UTF-8 mit BOM, Beträge
            de-DE). RC-Steuerdatum, Kennziffernwerte und der vollständige
            Steuerschnappschuss sind enthalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/app/export/journal-csv?${q}`}
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            Journal-CSV herunterladen
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Belegarchiv (ZIP)</CardTitle>
          <CardDescription>
            Festgeschriebene Belege im Zeitraum: Metadaten-CSV + Dateien.
            RC-Steuerdaten stehen in den Metadaten; Originaldateien bleiben
            unverändert. Entwürfe sind nicht enthalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/app/export/belegarchiv?${q}`}
            className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          >
            Belegarchiv-ZIP herunterladen
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">UStVA / ELSTER-XML light</CardTitle>
          <CardDescription>
            Kennzahlen zum Selbst-Eintragen in Mein Elster und optionaler
            XML-Download. Für 2026 und bei RC auch im begrenzten
            Kleinunternehmer-Workflow; kein Versand. Liegt bei der{" "}
            <Link href={`/app/ust?${q}`} className="text-primary hover:underline">
              USt-Übersicht
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zusammenfassende Meldung</CardTitle>
          <CardDescription>
            Kandidaten aus 0-USt-Einnahmen und Kontakt-Land zum Selbst-Eintragen
            in Mein Elster. Kein Versand, keine Art, keine geprüfte USt-IdNr.
            Liegt bei der{" "}
            <Link href={`/app/zm?${q}`} className="text-primary hover:underline">
              ZM-Übersicht
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weitere Exporte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/kontakte/export"
            className="text-primary hover:underline"
          >
            Kontakte-CSV
          </Link>
          <Link
            href="/app/katalog/export"
            className="text-primary hover:underline"
          >
            Katalog-CSV
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GoBD light</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Exporte nutzen nur festgeschriebene Daten. Verfahrensdokumentation:
            siehe{" "}
            <code className="text-xs">docs/verfahrensdokumentation.md</code> im
            Repository. Keine GoBD-Zertifizierung.
          </p>
          <p className="mt-2">
            DATEV und EÜR nutzen das Journal nach Zufluss: Zahlungen auf
            Rechnungen, Belege, Kassenbuch, manuelle Buchungen. Die
            Forderungsbuchung zur Rechnungs-Festschreibung bleibt im Journal,
            nicht in DATEV/EÜR.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
