"use client";

import { useMemo, useState } from "react";
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
import type { VerlaufMonat } from "./uebersicht";

type Fenster = "6" | "jahr" | "12";

const FENSTER: { id: Fenster; label: string }[] = [
  { id: "6", label: "6 Monate" },
  { id: "jahr", label: "Jahr" },
  { id: "12", label: "12 Monate" },
];

function sichtbareMonate(
  monate: VerlaufMonat[],
  fenster: Fenster,
  kalenderjahr: number,
): VerlaufMonat[] {
  if (fenster === "6") return monate.slice(-6);
  if (fenster === "12") return monate;
  return monate.filter((m) => m.jahr === kalenderjahr);
}

function chartDomain(monate: VerlaufMonat[]): { min: number; max: number } {
  let max = 0;
  let min = 0;
  for (const m of monate) {
    const ein = money(m.einnahmen_brutto).toNumber();
    const aus = money(m.ausgaben_brutto).toNumber();
    const ueb = money(m.ueberschuss_brutto).toNumber();
    max = Math.max(max, ein, aus, ueb);
    min = Math.min(min, ein, aus, ueb);
  }
  if (max <= 0 && min >= 0) max = 1;
  return { min, max };
}

export function UebersichtVerlauf({
  monate,
  kalenderjahr,
}: {
  monate: VerlaufMonat[];
  kalenderjahr: number;
}) {
  const [fenster, setFenster] = useState<Fenster>("jahr");
  const sichtbar = useMemo(
    () => sichtbareMonate(monate, fenster, kalenderjahr),
    [monate, fenster, kalenderjahr],
  );
  const still = sichtbar.every(
    (m) =>
      money(m.einnahmen_brutto).isZero() && money(m.ausgaben_brutto).isZero(),
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-base">
            Einnahmen und Ausgaben
          </CardTitle>
          <CardDescription>
            Zufluss je Monat. Balken: Einnahmen und Ausgaben; Linie: Überschuss.
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
              onClick={() => setFenster(f.id)}
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
        {still ? (
          <p className="text-sm text-muted-foreground">
            Keine Bewegungen in diesem Zeitraum.
          </p>
        ) : (
          <VerlaufChart monate={sichtbar} />
        )}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm bg-primary" />
            Einnahmen
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm bg-muted-foreground/55" />
            Ausgaben
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-px w-3 bg-success" />
            Überschuss
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function VerlaufChart({ monate }: { monate: VerlaufMonat[] }) {
  const W = 640;
  const H = 200;
  const padL = 4;
  const padR = 4;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(monate.length, 1);
  const slot = plotW / n;
  const barW = Math.min(16, slot * 0.28);
  const { min, max } = chartDomain(monate);
  const span = max - min || 1;
  const y = (v: number) => padT + plotH * (1 - (v - min) / span);
  const zeroY = y(0);

  const line = monate
    .map((m, i) => {
      const cx = padL + slot * i + slot / 2;
      const cy = y(money(m.ueberschuss_brutto).toNumber());
      return `${i === 0 ? "M" : "L"} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Einnahmen, Ausgaben und Überschuss je Monat"
      >
        <line
          x1={padL}
          x2={W - padR}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border)"
          strokeWidth="1"
        />
        {monate.map((m, i) => {
          const cx = padL + slot * i + slot / 2;
          const ein = money(m.einnahmen_brutto).toNumber();
          const aus = money(m.ausgaben_brutto).toNumber();
          const einBar = {
            y: y(Math.max(ein, 0)),
            h: Math.abs(y(ein) - zeroY),
          };
          const ausBar = {
            y: y(Math.max(aus, 0)),
            h: Math.abs(y(aus) - zeroY),
          };
          return (
            <g key={m.key}>
              <title>
                {`${m.label_lang}: Einnahmen ${formatMoneyDe(m.einnahmen_brutto, { currency: true })}, Ausgaben ${formatMoneyDe(m.ausgaben_brutto, { currency: true })}, Überschuss ${formatMoneyDe(m.ueberschuss_brutto, { currency: true })}`}
              </title>
              <rect
                x={cx - barW - 1}
                y={einBar.y}
                width={barW}
                height={einBar.h}
                rx="2"
                fill="var(--primary)"
              />
              <rect
                x={cx + 1}
                y={ausBar.y}
                width={barW}
                height={ausBar.h}
                rx="2"
                fill="var(--muted-foreground)"
                opacity="0.45"
              />
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="11"
              >
                {m.label_kurz.replace(/\.$/, "")}
              </text>
            </g>
          );
        })}
        <path
          d={line}
          fill="none"
          stroke="var(--success)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <table className="sr-only">
        <caption>Monatswerte</caption>
        <thead>
          <tr>
            <th>Monat</th>
            <th>Einnahmen</th>
            <th>Ausgaben</th>
            <th>Überschuss</th>
          </tr>
        </thead>
        <tbody>
          {monate.map((m) => (
            <tr key={m.key}>
              <td>{m.label_lang}</td>
              <td>{formatMoneyDe(m.einnahmen_brutto, { currency: true })}</td>
              <td>{formatMoneyDe(m.ausgaben_brutto, { currency: true })}</td>
              <td>{formatMoneyDe(m.ueberschuss_brutto, { currency: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
