"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import {
  PARTNER_ANLEGEN_HREF,
  partnerSelectFuerRichtung,
} from "./invariants";
import type { BelegPartnerOption, Buchungsrichtung } from "./types";

type Props = {
  lieferanten: BelegPartnerOption[];
  kunden: BelegPartnerOption[];
  defaultRichtung?: Buchungsrichtung;
  defaultLieferant?: string;
  defaultKunde?: string;
  richtungFieldName?: string;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Geschäftspartner je Buchungsrichtung: Ausgabe → Lieferant:in, Einnahme → Kund:in. */
export function BelegPartnerSelect({
  lieferanten,
  kunden,
  defaultRichtung = "ausgabe",
  defaultLieferant = "",
  defaultKunde = "",
  richtungFieldName = "richtung",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [richtung, setRichtung] = useState<Buchungsrichtung>(defaultRichtung);
  const [partner, setPartner] = useState(
    defaultRichtung === "einnahme" ? defaultKunde : defaultLieferant,
  );

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const el = form.elements.namedItem(richtungFieldName);
    if (!(el instanceof HTMLSelectElement)) return;
    const onChange = () => {
      const v = el.value;
      if (v !== "einnahme" && v !== "ausgabe") return;
      setRichtung(v);
      setPartner("");
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [richtungFieldName]);

  const { label, fieldName, items, selected, emptyHint } =
    partnerSelectFuerRichtung(lieferanten, kunden, richtung, partner);
  const otherField = fieldName === "lieferant" ? "kunde" : "lieferant";

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <Label htmlFor={fieldName}>{label}</Label>
      <select
        key={fieldName}
        id={fieldName}
        name={fieldName}
        value={selected}
        onChange={(e) => setPartner(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">— optional —</option>
        {items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input type="hidden" name={otherField} value="" />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {emptyHint}{" "}
          <Link
            href={PARTNER_ANLEGEN_HREF}
            className="text-primary underline-offset-4 hover:underline"
          >
            Anlegen
          </Link>
        </p>
      ) : null}
    </div>
  );
}
