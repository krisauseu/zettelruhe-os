import Link from "next/link";
import { requireFirmaSession } from "@/lib/session";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe, STEUERMODUS_LABELS } from "@/lib/labels";
import {
  DEFAULT_AUSWERTUNG_PRESET,
  getDashboardKennzahlen,
  normalizeZeitraumPreset,
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

export default async function AuswertungenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();
  const sp = await searchParams;
  const preset = normalizeZeitraumPreset(sp.preset, DEFAULT_AUSWERTUNG_PRESET);
  const zeitraum = zeitraumFromSearchParams(sp, DEFAULT_AUSWERTUNG_PRESET);
  const dash = await getDashboardKennzahlen(session.firmaId, zeitraum);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Auswertungen"
        description={
          <>
            Dashboard light und BWA light aus dem Buchungsjournal. Zeitraum:{" "}
            {formatDateDe(zeitraum.von)} – {formatDateDe(zeitraum.bis)}{" "}
            (Europe/Berlin).
          </>
        }
      >
        <Link
          href={`/app/eur?preset=${encodeURIComponent(preset)}&von=${zeitraum.von}&bis=${zeitraum.bis}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          EÜR
        </Link>
        <Link
          href={`/app/export?preset=${encodeURIComponent(preset)}&von=${zeitraum.von}&bis=${zeitraum.bis}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Export
        </Link>
      </PageHeader>

      <Card variant="muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
          <CardDescription>
            Voreinstellungen Monat / Quartal / Jahr oder benutzerdefiniert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZeitraumFilter zeitraum={zeitraum} preset={preset} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Einnahmen (Brutto)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoneyDe(dash.einnahmen_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {dash.anzahl_buchungen} Journal-Buchungen im Zeitraum
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ausgaben (Brutto)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoneyDe(dash.ausgaben_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Überschuss light (BWA)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoneyDe(dash.ueberschuss_brutto, { currency: true })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Einnahmen − Ausgaben (Brutto)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Offene Posten</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoneyDe(dash.offene_posten_summe, { currency: true })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {dash.offene_posten_anzahl} Rechnung
            {dash.offene_posten_anzahl === 1 ? "" : "en"} mit Restbetrag ·{" "}
            <Link
              href="/app/zahlungen"
              className="text-primary hover:underline"
            >
              zu Zahlungen
            </Link>
          </CardContent>
        </Card>
        {dash.ust_zahllast != null ? (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>USt-Zahllast light</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatMoneyDe(dash.ust_zahllast, { currency: true })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Nur Regelbesteuerung ·{" "}
              <Link
                href={`/app/ust?preset=${encodeURIComponent(preset)}&von=${zeitraum.von}&bis=${zeitraum.bis}`}
                className="text-primary hover:underline"
              >
                USt-Übersicht
              </Link>
              {" · "}
              <Link
                href={`/app/zm?preset=${encodeURIComponent(preset)}&von=${zeitraum.von}&bis=${zeitraum.bis}`}
                className="text-primary hover:underline"
              >
                ZM-Übersicht
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Steuer-Modus</CardDescription>
              <CardTitle className="text-base leading-snug">
                {STEUERMODUS_LABELS[dash.steuermodus]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Keine USt-Zahllast-Anzeige unter Kleinunternehmerregelung.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hinweis zur Datengrundlage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Kennzahlen basieren auf dem festgeschriebenen Buchungsjournal
            (Belege, Rechnungen, Kasse, manuell, Storno). Zahlungen auf
            Rechnungen erzeugen in v1 keinen Journal-Eintrag und fließen hier
            nicht in Einnahmen ein — siehe offene Posten separat.
          </p>
          <p>
            Detaillierte EÜR und Exporte (DATEV light, CSV, Belegarchiv)
            finden Sie unter den entsprechenden Menüpunkten.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
