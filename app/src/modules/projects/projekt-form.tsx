import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Projekt } from "./types";

type Option = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  projekt?: Projekt | null;
  kunden: Option[];
  submitLabel: string;
  error?: string | null;
};

export function ProjektForm({
  action,
  projekt,
  kunden,
  submitLabel,
  error,
}: Props) {
  return (
    <form action={action} className="flex flex-col gap-5">
      {projekt ? <input type="hidden" name="id" value={projekt.id} /> : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kunde">Kund:in</Label>
        <Select
          id="kunde"
          name="kunde"
          required
          defaultValue={projekt?.kunde ?? ""}
        >
          <option value="" disabled>
            — wählen —
          </option>
          {kunden.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={projekt?.name ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={3}
          maxLength={2000}
          defaultValue={projekt?.notiz ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="aktiv"
          value="true"
          defaultChecked={projekt?.aktiv ?? true}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        Aktiv
      </label>

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
