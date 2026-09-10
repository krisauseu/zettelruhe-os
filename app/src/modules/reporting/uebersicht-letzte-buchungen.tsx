import Link from "next/link";
import { formatMoneyDe } from "@/lib/money";
import {
  BUCHUNGSRICHTUNG_LABELS,
  formatDateDe,
  QUELLE_TYP_LABELS,
} from "@/lib/labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LetzteBuchung } from "./uebersicht";

export function UebersichtLetzteBuchungen({
  eintraege,
}: {
  eintraege: LetzteBuchung[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Letzte Buchungen</CardTitle>
        <CardDescription>
          Die neuesten Zeilen im Buchungsjournal.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {eintraege.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Buchungen im Journal.
          </p>
        ) : (
          <ul>
            {eintraege.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={e.href}
                    className="min-w-0 font-medium text-foreground hover:text-primary hover:underline"
                  >
                    <span className="line-clamp-2">{e.buchungstext}</span>
                  </Link>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {formatMoneyDe(e.betrag_brutto, { currency: true })}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateDe(e.buchungsdatum)}
                  {" · "}
                  {QUELLE_TYP_LABELS[e.quelle_typ] ?? e.quelle_typ}
                  {" · "}
                  {BUCHUNGSRICHTUNG_LABELS[e.richtung]}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href="/app/journal"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Zum Buchungsjournal
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
