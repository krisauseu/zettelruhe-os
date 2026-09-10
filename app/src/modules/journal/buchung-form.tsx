import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Steuermodus } from "@/lib/pb";
import { todayBerlin } from "./invariants";

type Props = {
  action: (formData: FormData) => Promise<void>;
  steuermodus: Steuermodus;
  error?: string | null;
  defaultBuchungsdatum?: string;
};

export function BuchungForm({
  action,
  steuermodus,
  error,
  defaultBuchungsdatum,
}: Props) {
  const showUst = steuermodus === "regelbesteuerung_ist";
  const datum = defaultBuchungsdatum || todayBerlin();

  return (
    <form action={action} className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buchungsdatum">Buchungsdatum *</Label>
          <Input
            id="buchungsdatum"
            name="buchungsdatum"
            type="date"
            required
            defaultValue={datum}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="belegdatum">Belegdatum</Label>
          <Input id="belegdatum" name="belegdatum" type="date" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="buchungstext">Buchungstext *</Label>
        <Textarea
          id="buchungstext"
          name="buchungstext"
          required
          rows={2}
          maxLength={500}
          placeholder="z. B. Büromaterial Amazon"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="richtung">Richtung *</Label>
          <select
            id="richtung"
            name="richtung"
            required
            defaultValue="ausgabe"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="ausgabe">Ausgabe</option>
            <option value="einnahme">Einnahme</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="konto">Konto (SKR)</Label>
          <Input
            id="konto"
            name="konto"
            placeholder="optional"
            maxLength={20}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_netto">Netto *</Label>
          <Input
            id="betrag_netto"
            name="betrag_netto"
            required
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>
        {showUst ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="steuersatz">USt-Satz</Label>
              <select
                id="steuersatz"
                name="steuersatz"
                defaultValue="19"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="19">19 %</option>
                <option value="7">7 %</option>
                <option value="0">0 %</option>
                <option value="">—</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="betrag_ust">USt (optional)</Label>
              <Input
                id="betrag_ust"
                name="betrag_ust"
                inputMode="decimal"
                placeholder="auto"
              />
            </div>
          </>
        ) : (
          <input type="hidden" name="steuersatz" value="" />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_brutto">Brutto (optional)</Label>
          <Input
            id="betrag_brutto"
            name="betrag_brutto"
            inputMode="decimal"
            placeholder="auto"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Mit Speichern wird die Buchung <strong>festgeschrieben</strong> und
        kann nicht mehr still geändert oder gelöscht werden. Korrekturen nur
        über Storno/Gegenbuchung.
      </p>

      <div>
        <Button type="submit">Festschreiben</Button>
      </div>
    </form>
  );
}
