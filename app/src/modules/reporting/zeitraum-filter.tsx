/**
 * Zeitraum-Filter light (GET-Form) für Auswertungen.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Zeitraum } from "./types";

type Props = {
  zeitraum: Zeitraum;
  preset: string;
  /** Zusätzliche hidden fields (z. B. für Export-Action-Kontext) */
  action?: string;
  method?: "get" | "post";
};

export function ZeitraumFilter({
  zeitraum,
  preset,
  action,
  method = "get",
}: Props) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      method={method}
      action={action}
    >
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="preset" className="text-xs text-muted-foreground">
          Zeitraum
        </Label>
        <select
          id="preset"
          name="preset"
          defaultValue={preset}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="monat">Monat</option>
          <option value="quartal">Quartal</option>
          <option value="jahr">Jahr</option>
          <option value="custom">Benutzerdefiniert</option>
        </select>
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="von" className="text-xs text-muted-foreground">
          Von
        </Label>
        <Input
          id="von"
          name="von"
          type="date"
          defaultValue={zeitraum.von}
        />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="bis" className="text-xs text-muted-foreground">
          Bis
        </Label>
        <Input
          id="bis"
          name="bis"
          type="date"
          defaultValue={zeitraum.bis}
        />
      </div>
      <Button type="submit" size="sm" variant="secondary">
        Anwenden
      </Button>
    </form>
  );
}
