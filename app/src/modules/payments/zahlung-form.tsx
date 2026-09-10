"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Zahlungsweg } from "./types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  rechnungId: string;
  vorgangId: string;
  /** Vorschlag Restbetrag (de-DE formatiert oder plain) */
  restBetragVorschlag?: string;
  defaultDatum: string;
  error?: string | null;
};

const WEGE: { value: Zahlungsweg | ""; label: string }[] = [
  { value: "", label: "— optional —" },
  { value: "ueberweisung", label: "Überweisung" },
  { value: "bar", label: "Bar" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function ZahlungForm({
  action,
  rechnungId,
  vorgangId,
  restBetragVorschlag = "",
  defaultDatum,
  error,
}: Props) {
  const [betrag, setBetrag] = useState(restBetragVorschlag);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="vorgang" value={vorgangId} />
      <input type="hidden" name="rechnung" value={rechnungId} />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="datum">Zahlungsdatum</Label>
          <Input
            id="datum"
            name="datum"
            type="date"
            required
            defaultValue={defaultDatum}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag">Betrag (€)</Label>
          <Input
            id="betrag"
            name="betrag"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            de-DE: Komma oder Punkt; Teilzahlung möglich.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zahlungsweg">Zahlungsweg</Label>
        <select
          id="zahlungsweg"
          name="zahlungsweg"
          defaultValue="ueberweisung"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          {WEGE.map((w) => (
            <option key={w.value || "empty"} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Zahlungsweg „Bar“ markiert den Eingang. Der Zufluss steht im
          Zahlungsjournal (EÜR, USt, DATEV). Es entsteht kein
          Kassenbuch-Eintrag. Dieselbe Barzahlung nicht zusätzlich als
          Bareinnahme im Kassenbuch erfassen — das würde die Einnahme
          verdoppeln.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          placeholder="optional"
          maxLength={2000}
        />
      </div>

      <div>
        <Button type="submit">Zahlung erfassen</Button>
      </div>
    </form>
  );
}
