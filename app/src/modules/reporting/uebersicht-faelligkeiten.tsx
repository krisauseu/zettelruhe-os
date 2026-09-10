import Link from "next/link";
import { formatMoneyDe } from "@/lib/money";
import { formatDateDe } from "@/lib/labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { daysBetweenYmd } from "./periods";
import type { FaelligkeitEintrag, FaelligkeitenBlick } from "./uebersicht";

const ANZEIGE_UEBERFAELLIG = 8;
const ANZEIGE_BALD = 6;

function verzugText(tage: number): string {
  if (tage <= 0) return "überfällig";
  if (tage === 1) return "1 Tag Verzug";
  return `${tage} Tage Verzug`;
}

function baldText(faelligAm: string, heute: string): string {
  if (faelligAm === heute) return "fällig heute";
  const days = daysBetweenYmd(heute, faelligAm);
  if (days === 1) return "fällig morgen";
  return `fällig ${formatDateDe(faelligAm)}`;
}

function PostenZeile({
  e,
  heute,
  kannSchreiben,
}: {
  e: FaelligkeitEintrag;
  heute: string;
  kannSchreiben: boolean;
}) {
  const href = `/app/rechnungen/${e.rechnungId}`;
  const meta =
    e.lage === "ueberfaellig"
      ? verzugText(e.tage_verzug)
      : baldText(e.faellig_am, heute);
  return (
    <li className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={href}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {e.rechnungsnummer || "Rechnung"}
          </Link>
          {e.kundeName ? (
            <p className="truncate text-xs text-muted-foreground">
              {e.kundeName}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-medium tabular-nums">
          {formatMoneyDe(e.offen, { currency: true })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span
          className={cn(
            e.lage === "ueberfaellig" && "text-destructive",
          )}
        >
          {meta}
        </span>
        {kannSchreiben ? (
          <Link
            href={`${href}#zahlung`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Zahlung erfassen
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function UebersichtFaelligkeiten({
  blick,
  kannSchreiben,
}: {
  blick: FaelligkeitenBlick;
  kannSchreiben: boolean;
}) {
  const ueber = blick.ueberfaellig.slice(0, ANZEIGE_UEBERFAELLIG);
  const bald = blick.bald.slice(0, ANZEIGE_BALD);
  const weitere =
    blick.ueberfaellig.length -
    ueber.length +
    (blick.bald.length - bald.length);
  const leer = ueber.length === 0 && bald.length === 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Fälligkeiten</CardTitle>
        <CardDescription>
          Überfällige Rechnungen und die nächsten {blick.horizon_tage} Tage.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {leer ? (
          <p className="text-sm text-muted-foreground">
            Keine überfälligen Rechnungen und nichts in den nächsten{" "}
            {blick.horizon_tage} Tagen.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {ueber.length > 0 ? (
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Überfällig ({blick.ueberfaellig.length})
                </h3>
                <ul>
                  {ueber.map((e) => (
                    <PostenZeile
                      key={e.rechnungId}
                      e={e}
                      heute={blick.heute}
                      kannSchreiben={kannSchreiben}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
            {bald.length > 0 ? (
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nächste {blick.horizon_tage} Tage ({blick.bald.length})
                </h3>
                <ul>
                  {bald.map((e) => (
                    <PostenZeile
                      key={e.rechnungId}
                      e={e}
                      heute={blick.heute}
                      kannSchreiben={kannSchreiben}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href="/app/zahlungen"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Alle offenen Posten
          </Link>
          {weitere > 0 ? ` · ${weitere} weitere` : null}
        </p>
      </CardContent>
    </Card>
  );
}
