import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Kategorie } from "./types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  kategorie?: Kategorie | null;
  submitLabel: string;
  error?: string | null;
};

export function KategorieForm({
  action,
  kategorie,
  submitLabel,
  error,
}: Props) {
  const aktiv = kategorie ? kategorie.aktiv : true;

  return (
    <form action={action} className="flex flex-col gap-5">
      {kategorie ? <input type="hidden" name="id" value={kategorie.id} /> : null}

      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={kategorie?.name ?? ""}
          placeholder="z. B. Büromaterial"
        />
        <p className="text-xs text-muted-foreground">
          Umbenennen ändert die Auswahlliste, nicht bereits gespeicherte Belege
          oder Kassenbuch-Zeilen.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="richtung">Richtung *</Label>
        <Select
          id="richtung"
          name="richtung"
          required
          defaultValue={kategorie?.richtung ?? "ausgabe"}
        >
          <option value="ausgabe">Ausgabe</option>
          <option value="einnahme">Einnahme</option>
        </Select>
        <p className="text-xs text-muted-foreground">
          Legt fest, ob die Kategorie bei Einnahmen oder Ausgaben angeboten
          wird.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          maxLength={2000}
          defaultValue={kategorie?.notiz ?? ""}
          placeholder="optional"
        />
      </div>

      <input type="hidden" name="aktiv_present" value="1" />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="aktiv"
          defaultChecked={aktiv}
          className="size-4 rounded border-input"
        />
        Aktiv (in Auswahllisten sichtbar)
      </label>

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
