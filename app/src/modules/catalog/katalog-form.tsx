import type { Steuermodus } from "@/lib/pb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KatalogPosition } from "./types";
import { einheitOptionen } from "./einheiten";

type Props = {
  action: (formData: FormData) => Promise<void>;
  position?: KatalogPosition | null;
  steuermodus: Steuermodus;
  submitLabel: string;
  error?: string | null;
};

export function KatalogForm({
  action,
  position,
  steuermodus,
  submitLabel,
  error,
}: Props) {
  const showUst = steuermodus === "regelbesteuerung_ist";

  return (
    <form action={action} className="flex flex-col gap-5">
      {position ? <input type="hidden" name="id" value={position.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bezeichnung">Bezeichnung</Label>
        <Input
          id="bezeichnung"
          name="bezeichnung"
          required
          defaultValue={position?.bezeichnung ?? ""}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="einheit">Einheit</Label>
          <Select
            id="einheit"
            name="einheit"
            required
            defaultValue={position?.einheit || "Stück"}
          >
            {einheitOptionen(position?.einheit).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preis">Preis (EUR)</Label>
          <Input
            id="preis"
            name="preis"
            required
            inputMode="decimal"
            defaultValue={
              position?.preis ? position.preis.replace(".", ",") : ""
            }
            placeholder="0,00"
          />
          <p className="text-xs text-muted-foreground">
            Dezimal mit Komma oder Punkt; intern cent-genau (kein Float).
          </p>
        </div>
      </div>

      {showUst ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="steuersatz">Steuersatz</Label>
          <Select
            id="steuersatz"
            name="steuersatz"
            defaultValue={position?.steuersatz || "19"}
          >
            <option value="19">19 %</option>
            <option value="7">7 %</option>
            <option value="0">0 %</option>
          </Select>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Steuer-Modus: Kleinunternehmerregelung — kein USt-Ausweis; Steuersatz
          wird nicht erfasst.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          defaultValue={position?.notiz ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="aktiv"
          value="true"
          defaultChecked={position?.aktiv ?? true}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        Aktiv (in Auswahllisten sichtbar)
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
