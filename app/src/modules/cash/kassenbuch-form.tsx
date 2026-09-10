import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Steuermodus } from "@/lib/pb";
import { KategorieSelect } from "@/modules/categories/kategorie-select";
import type { KategorieSelectItem } from "@/modules/categories";
import { todayBerlin } from "./invariants";

type KontaktOption = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  steuermodus: Steuermodus;
  kontakte: KontaktOption[];
  /** Aktive Kategorien */
  kategorien: KategorieSelectItem[];
  error?: string | null;
  defaultDatum?: string;
  /** Voreingestellte Richtung (z. B. aus Query) */
  defaultRichtung?: "einnahme" | "ausgabe";
  vorgangId: string;
};

export function KassenbuchForm({
  action,
  steuermodus,
  kontakte,
  kategorien,
  error,
  defaultDatum,
  defaultRichtung = "einnahme",
  vorgangId,
}: Props) {
  const showUst = steuermodus === "regelbesteuerung_ist";
  const datum = defaultDatum || todayBerlin();

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="vorgang_id" value={vorgangId} />
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="datum">Datum *</Label>
          <Input
            id="datum"
            name="datum"
            type="date"
            required
            defaultValue={datum}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="richtung">Richtung *</Label>
          <select
            id="richtung"
            name="richtung"
            required
            defaultValue={defaultRichtung}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="einnahme">Bareinnahme</option>
            <option value="ausgabe">Barausgabe</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="text">Text *</Label>
        <Textarea
          id="text"
          name="text"
          required
          rows={2}
          maxLength={500}
          placeholder="z. B. Barverkauf, Porto bar, …"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kategorie">Kategorie</Label>
          <KategorieSelect
            items={kategorien}
            defaultRichtung={defaultRichtung}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kontakt">Kontakt</Label>
          <select
            id="kontakt"
            name="kontakt"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">— optional —</option>
            {kontakte.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {showUst ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="betrag_netto">Netto</Label>
              <Input
                id="betrag_netto"
                name="betrag_netto"
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
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
              <Label htmlFor="betrag_brutto">Brutto (Kasse) *</Label>
              <Input
                id="betrag_brutto"
                name="betrag_brutto"
                required
                inputMode="decimal"
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Kassenwirksam; de-DE Komma oder Punkt.
              </p>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="steuersatz" value="" />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="betrag_brutto">Betrag (€) *</Label>
              <Input
                id="betrag_brutto"
                name="betrag_brutto"
                required
                inputMode="decimal"
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                de-DE: Komma oder Punkt. Unter Kleinunternehmerregelung ohne
                USt-Ausweis.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          maxLength={2000}
          placeholder="optional"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Mit Speichern wird der Eintrag <strong>festgeschrieben</strong>, erhält
        eine Belegnummer und erscheint im Buchungsjournal. Der Kassensaldo darf
        nicht negativ werden. Korrekturen nur über Storno/Gegenbuchung.
      </p>

      <div>
        <Button type="submit">Festschreiben</Button>
      </div>
    </form>
  );
}
