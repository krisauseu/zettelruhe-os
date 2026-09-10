"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import {
  kategorieSelectItemsMitSchnappschuss,
  kategorienFuerRichtung,
} from "./invariants";
import type { Buchungsrichtung, KategorieSelectItem } from "./types";

type Props = {
  id?: string;
  name?: string;
  items: KategorieSelectItem[];
  defaultValue?: string;
  /** Start-Richtung, muss zum Feld `richtung` im selben Formular passen. */
  defaultRichtung?: Buchungsrichtung;
  richtungFieldName?: string;
};

/** Auswahlliste; leer = keine Kategorie. Filtert nach der Formular-Richtung. */
export function KategorieSelect({
  id = "kategorie",
  name = "kategorie",
  items,
  defaultValue = "",
  defaultRichtung = "ausgabe",
  richtungFieldName = "richtung",
}: Props) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [richtung, setRichtung] = useState<Buchungsrichtung>(defaultRichtung);
  const [kategorie, setKategorie] = useState(defaultValue);

  const itemsMitSchnappschuss = useMemo(
    () =>
      kategorieSelectItemsMitSchnappschuss(
        items,
        defaultValue,
        defaultRichtung,
      ),
    [items, defaultValue, defaultRichtung],
  );

  useEffect(() => {
    const form = selectRef.current?.form;
    if (!form) return;
    const el = form.elements.namedItem(richtungFieldName);
    if (!(el instanceof HTMLSelectElement)) return;
    const onChange = () => {
      const v = el.value;
      if (v !== "einnahme" && v !== "ausgabe") return;
      setRichtung(v);
      setKategorie("");
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [richtungFieldName]);

  const { namen, selected } = kategorienFuerRichtung(
    itemsMitSchnappschuss,
    richtung,
    kategorie,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        ref={selectRef}
        id={id}
        name={name}
        value={selected}
        onChange={(e) => setKategorie(e.target.value)}
      >
        <option value="">— optional —</option>
        {namen.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      {namen.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {richtung === "einnahme"
            ? "Noch keine Kategorien für Einnahmen."
            : "Noch keine Kategorien für Ausgaben."}{" "}
          <Link
            href="/app/kategorien/neu"
            className="text-primary underline-offset-4 hover:underline"
          >
            Anlegen
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Liste unter{" "}
          <Link
            href="/app/kategorien"
            className="text-primary underline-offset-4 hover:underline"
          >
            Kategorien
          </Link>
          .
        </p>
      )}
    </div>
  );
}
