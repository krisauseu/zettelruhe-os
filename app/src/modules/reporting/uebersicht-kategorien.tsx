"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneyDe, money } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AusgabenKategorienBlick } from "./uebersicht";

type Fenster = "monat" | "quartal";

const FENSTER: { id: Fenster; label: string }[] = [
  { id: "monat", label: "Monat" },
  { id: "quartal", label: "Quartal" },
];

/** Je Slice ein Token — nicht color-mix aus Violett, sonst wirken zwei Segmente gleich. */
const SLICE_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--muted-foreground)",
  "var(--sidebar-primary)",
];

export function UebersichtKategorien({
  monat,
  quartal,
}: {
  monat: AusgabenKategorienBlick;
  quartal: AusgabenKategorienBlick;
}) {
  const [fenster, setFenster] = useState<Fenster>("monat");
  const [aktiv, setAktiv] = useState<string | null>(null);
  const blick = fenster === "monat" ? monat : quartal;
  const leer = blick.zeilen.length === 0 || money(blick.summe_brutto).lte(0);
  const fokus = useMemo(
    () => blick.zeilen.find((z) => z.key === aktiv) ?? null,
    [blick.zeilen, aktiv],
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-base">Ausgaben nach Kategorien</CardTitle>
          <CardDescription>
            Top 5 aus Beleg und Kassenbuch
            {blick.label ? ` · ${blick.label}` : ""}.
          </CardDescription>
        </div>
        <div
          className="flex shrink-0 flex-wrap gap-1"
          role="group"
          aria-label="Zeitraum"
        >
          {FENSTER.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={fenster === f.id}
              onClick={() => {
                setFenster(f.id);
                setAktiv(null);
              }}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: fenster === f.id ? "secondary" : "ghost",
                }),
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {leer ? (
          <p className="text-sm text-muted-foreground">
            Keine Ausgaben aus Beleg oder Kassenbuch in diesem Zeitraum.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <KategorieDonut
              blick={blick}
              aktiv={aktiv}
              onAktiv={setAktiv}
              fokus={fokus}
            />
            <ul className="min-w-0 flex-1 self-stretch">
              {blick.zeilen.map((z, i) => {
                const farbe = SLICE_COLORS[i] ?? SLICE_COLORS[SLICE_COLORS.length - 1];
                const istAktiv = aktiv === z.key;
                return (
                  <li key={z.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setAktiv(z.key)}
                      onMouseLeave={() => setAktiv(null)}
                      onFocus={() => setAktiv(z.key)}
                      onBlur={() => setAktiv(null)}
                      className={cn(
                        "flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-1.5 text-left text-sm",
                        istAktiv && "bg-muted/70",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block size-2 shrink-0 rounded-sm"
                          style={{ background: farbe }}
                          aria-hidden
                        />
                        <span className="truncate">{z.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatMoneyDe(z.summe_brutto, { currency: true })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href="/app/belege"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Belege
          </Link>
          {" · "}
          <Link
            href="/app/kassenbuch"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Kassenbuch
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function KategorieDonut({
  blick,
  aktiv,
  onAktiv,
  fokus,
}: {
  blick: AusgabenKategorienBlick;
  aktiv: string | null;
  onAktiv: (key: string | null) => void;
  fokus: AusgabenKategorienBlick["zeilen"][number] | null;
}) {
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const r = 46;
  const circ = 2 * Math.PI * r;
  const lengths = blick.zeilen.map((z) => Math.max(0, Math.min(circ, z.anteil * circ)));
  const mitte = fokus ?? {
    label: "Summe",
    summe_brutto: blick.summe_brutto,
  };

  return (
    <div className="relative shrink-0">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="size-[148px]"
        role="img"
        aria-label={`Ausgaben nach Kategorien, ${formatMoneyDe(blick.summe_brutto, { currency: true })}`}
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {blick.zeilen.map((z, i) => {
            const len = lengths[i];
            const dashoffset = -lengths.slice(0, i).reduce((sum, length) => sum + length, 0);
            const farbe =
              SLICE_COLORS[i] ?? SLICE_COLORS[SLICE_COLORS.length - 1];
            const dim = aktiv != null && aktiv !== z.key;
            return (
              <circle
                key={z.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={farbe}
                strokeWidth={aktiv === z.key ? 18 : 15}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={dashoffset}
                opacity={dim ? 0.4 : 1}
                tabIndex={0}
                className="outline-none"
                onMouseEnter={() => onAktiv(z.key)}
                onMouseLeave={() => onAktiv(null)}
                onFocus={() => onAktiv(z.key)}
                onBlur={() => onAktiv(null)}
              >
                <title>
                  {`${z.label}: ${formatMoneyDe(z.summe_brutto, { currency: true })}`}
                </title>
              </circle>
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="max-w-[6.5rem] truncate text-[11px] text-muted-foreground">
          {mitte.label}
        </p>
        <p className="text-sm font-semibold tabular-nums tracking-tight">
          {formatMoneyDe(mitte.summe_brutto, { currency: true })}
        </p>
      </div>
      <table className="sr-only">
        <caption>Ausgaben nach Kategorien</caption>
        <thead>
          <tr>
            <th>Kategorie</th>
            <th>Summe</th>
          </tr>
        </thead>
        <tbody>
          {blick.zeilen.map((z) => (
            <tr key={z.key}>
              <td>{z.label}</td>
              <td>{formatMoneyDe(z.summe_brutto, { currency: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
