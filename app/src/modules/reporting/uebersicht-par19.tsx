import { formatMoneyDe } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Par19Ampel, Par19Waechter } from "./par19";

const AMPEL_LABEL: Record<Par19Ampel, string> = {
  entspannt: "entspannt",
  achtung: "Achtung",
  nahe_der_grenze: "nahe der Grenze",
};

const AMPEL_BADGE: Record<Par19Ampel, "success" | "warning" | "danger"> = {
  entspannt: "success",
  achtung: "warning",
  nahe_der_grenze: "danger",
};

const AMPEL_BAR: Record<Par19Ampel, string> = {
  entspannt: "bg-success",
  achtung: "bg-warning",
  nahe_der_grenze: "bg-destructive",
};

export function UebersichtPar19({ waechter }: { waechter: Par19Waechter }) {
  const pct = Math.min(100, Math.max(0, waechter.anteil_vorjahr * 100));
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-base">
            Jahresumsatz § 19
          </CardTitle>
          <CardDescription>
            Kalenderjahr {waechter.kalenderjahr} · Vorjahresgrenze{" "}
            {formatMoneyDe(waechter.grenze_vorjahr, { currency: true })},
            Höchstgrenze laufendes Jahr{" "}
            {formatMoneyDe(waechter.grenze_laufend, { currency: true })}.
          </CardDescription>
        </div>
        <Badge variant={AMPEL_BADGE[waechter.ampel]}>
          {AMPEL_LABEL[waechter.ampel]}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatMoneyDe(waechter.umsatz_brutto, { currency: true })}
          </p>
          <p className="text-xs text-muted-foreground">
            von {formatMoneyDe(waechter.grenze_vorjahr, { currency: true })}{" "}
            Vorjahresgrenze
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Anteil an der Vorjahresgrenze"
        >
          <div
            className={cn("h-full rounded-full", AMPEL_BAR[waechter.ampel])}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {waechter.hinweis}
        </p>
      </CardContent>
    </Card>
  );
}
