import type { ReactNode } from "react";
import Link from "next/link";
import {
  Clock,
  Contact,
  Download,
  FileText,
  Receipt,
  Search,
} from "lucide-react";
import { getSession, requireFirmaSession } from "@/lib/session";
import { getFirmaById } from "@/lib/pb";
import { formatMoneyDe } from "@/lib/money";
import {
  formatDateDe,
  MITGLIEDSCHAFT_ROLLE_LABELS,
  SKR_LABELS,
  STEUERMODUS_LABELS,
} from "@/lib/labels";
import { getUebersichtDashboard } from "@/modules/reporting";
import { UebersichtPar19 } from "@/modules/reporting/uebersicht-par19";
import { UebersichtVerlauf } from "@/modules/reporting/uebersicht-verlauf";
import { UebersichtFaelligkeiten } from "@/modules/reporting/uebersicht-faelligkeiten";
import { UebersichtKategorien } from "@/modules/reporting/uebersicht-kategorien";
import { UebersichtLetzteBuchungen } from "@/modules/reporting/uebersicht-letzte-buchungen";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/app/rechnungen/neu", label: "Rechnung", icon: FileText },
  { href: "/app/belege/neu", label: "Beleg", icon: Receipt },
  { href: "/app/kontakte/neu", label: "Kontakt", icon: Contact },
  { href: "/app/zeiten/neu", label: "Zeit", icon: Clock },
  { href: "/app/suche", label: "Suche", icon: Search },
  { href: "/app/export", label: "Export", icon: Download },
] as const;

export default async function AppHomePage() {
  const session = await getSession();

  let firma: Awaited<ReturnType<typeof getFirmaById>> = null;
  let uebersicht: Awaited<ReturnType<typeof getUebersichtDashboard>> | null =
    null;
  let kannSchreiben = false;
  let rollenLabel = "";
  try {
    const s = await requireFirmaSession();
    firma = await getFirmaById(s.firmaId);
    uebersicht = await getUebersichtDashboard(s.firmaId);
    kannSchreiben = s.kannSchreiben;
    rollenLabel = MITGLIEDSCHAFT_ROLLE_LABELS[s.mitgliedschaftRolle];
  } catch {
    uebersicht = null;
  }
  const dash = uebersicht?.kennzahlen ?? null;

  const isZeroMoney = (v: string) =>
    v === "0" || v === "0.00" || v === "0,00" || Number.parseFloat(v) === 0;

  const quietYear =
    dash != null &&
    isZeroMoney(dash.einnahmen_brutto) &&
    isZeroMoney(dash.ausgaben_brutto) &&
    dash.offene_posten_anzahl === 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Übersicht"
        description={
          dash
            ? `Kennzahlen light · Jahr ${formatDateDe(dash.zeitraum.von)} – ${formatDateDe(dash.zeitraum.bis)}`
            : "Stammdaten und Kennzahlen light."
        }
      >
        <Link
          href="/app/suche"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Suche
        </Link>
        <Link
          href="/app/auswertungen"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Auswertungen
        </Link>
      </PageHeader>

      {firma ? (
        <dl className="grid gap-4 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-card sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Firma
            </dt>
            <dd className="mt-1 font-medium tracking-tight">{firma.name}</dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">
              {rollenLabel
                ? `${session?.name} · ${rollenLabel}`
                : session?.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Steuer-Modus
            </dt>
            <dd className="mt-1 font-medium tracking-tight">
              {STEUERMODUS_LABELS[firma.steuermodus]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Kontenrahmen
            </dt>
            <dd className="mt-1 font-medium tracking-tight">
              {SKR_LABELS[firma.skr]}
            </dd>
          </div>
        </dl>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Willkommen, {session?.name}</CardTitle>
            <CardDescription>
              Es ist noch keine Firma eingerichtet. Bitte schließen Sie das
              Setup ab oder wenden Sie sich an den Support.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Schnellstart
        </h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.filter(
            (l) => kannSchreiben || !l.href.endsWith("/neu"),
          ).map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                )}
              >
                <Icon aria-hidden />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>

      {dash ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Einnahmen (Jahr)"
            value={formatMoneyDe(dash.einnahmen_brutto, { currency: true })}
          />
          <KpiCard
            label="Ausgaben (Jahr)"
            value={formatMoneyDe(dash.ausgaben_brutto, { currency: true })}
          />
          <KpiCard
            label="Offene Posten"
            value={formatMoneyDe(dash.offene_posten_summe, { currency: true })}
          >
            <Link href="/app/zahlungen" className="text-primary hover:underline">
              {dash.offene_posten_anzahl} offen
            </Link>
          </KpiCard>
          {dash.ust_zahllast != null ? (
            <KpiCard
              label="USt-Zahllast light"
              value={formatMoneyDe(dash.ust_zahllast, { currency: true })}
            >
              <Link href="/app/ust" className="text-primary hover:underline">
                USt-Übersicht
              </Link>
              {" · "}
              <Link href="/app/zm" className="text-primary hover:underline">
                ZM-Übersicht
              </Link>
            </KpiCard>
          ) : (
            <KpiCard
              label="Überschuss light"
              value={formatMoneyDe(dash.ueberschuss_brutto, { currency: true })}
            >
              <Link href="/app/eur" className="text-primary hover:underline">
                zur EÜR
              </Link>
            </KpiCard>
          )}
        </div>
      ) : null}

      {uebersicht?.par19 ? (
        <UebersichtPar19 waechter={uebersicht.par19} />
      ) : null}

      {uebersicht ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(0,0.9fr)]">
          <div className="order-2 min-w-0 md:order-1">
            <UebersichtVerlauf
              monate={uebersicht.verlauf}
              kalenderjahr={Number.parseInt(
                dash?.zeitraum.von.slice(0, 4) ?? "0",
                10,
              )}
            />
          </div>
          <div className="order-1 min-w-0 md:order-2">
            <UebersichtFaelligkeiten
              blick={uebersicht.faelligkeiten}
              kannSchreiben={kannSchreiben}
            />
          </div>
        </div>
      ) : null}

      {uebersicht ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <UebersichtKategorien
              monat={uebersicht.ausgaben_kategorien_monat}
              quartal={uebersicht.ausgaben_kategorien_quartal}
            />
          </div>
          <div className="min-w-0">
            <UebersichtLetzteBuchungen
              eintraege={uebersicht.letzte_buchungen}
            />
          </div>
        </div>
      ) : null}

      {quietYear ? (
        <Card variant="muted" className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Noch ruhiges Jahr</CardTitle>
            <CardDescription>
              Keine Journal-Bewegungen und keine offenen Posten in diesem Jahr.
              Starte mit Kontakt, Rechnung oder Beleg — oder importiere einen
              Kontoauszug.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {kannSchreiben ? (
              <>
                <Link
                  href="/app/kontakte/neu"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Kontakt anlegen
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href="/app/rechnungen/neu"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Rechnung anlegen
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href="/app/belege/neu"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Beleg anlegen
                </Link>
              </>
            ) : (
              <span>Keine Bewegungen in diesem Jahr.</span>
            )}
          </CardContent>
        </Card>
      ) : null}

      {dash ? (
        <p className="text-xs text-muted-foreground">
          Kennzahlen basieren auf dem Buchungsjournal nach Zufluss (Einnahmen
          aus Rechnungen mit Zahlungsdatum) bzw. Zahlungen (offene Posten).
        </p>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 pb-4">
        <CardDescription className="text-xs font-medium tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      {children ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
