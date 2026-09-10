import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayBerlin } from "./invariants";
import type { Abrechnungsstatus, Fahrt } from "./types";

type Option = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  fahrt?: Fahrt | null;
  kunden: Option[];
  projekte: Option[];
  submitLabel: string;
  error?: string | null;
  readOnly?: boolean;
};

const STATUS_OPTIONS: { value: Abrechnungsstatus; label: string }[] = [
  { value: "abrechenbar", label: "Abrechenbar" },
  { value: "nicht_abrechenbar", label: "Nicht abrechenbar" },
  { value: "abgerechnet", label: "Abgerechnet" },
];

export function FahrtForm({
  action,
  fahrt,
  kunden,
  projekte,
  submitLabel,
  error,
  readOnly = false,
}: Props) {
  return (
    <form action={action} className="flex flex-col gap-5">
      {fahrt ? <input type="hidden" name="id" value={fahrt.id} /> : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kunde">Kund:in</Label>
          <Select
            id="kunde"
            name="kunde"
            required
            disabled={readOnly}
            defaultValue={fahrt?.kunde ?? ""}
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
          <Label htmlFor="projekt">Projekt (optional)</Label>
          <Select
            id="projekt"
            name="projekt"
            disabled={readOnly}
            defaultValue={fahrt?.projekt ?? ""}
          >
            <option value="">— keines —</option>
            {projekte.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="datum">Datum</Label>
          <Input
            id="datum"
            name="datum"
            type="date"
            required
            disabled={readOnly}
            defaultValue={fahrt?.datum ?? todayBerlin()}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            name="status"
            disabled={readOnly}
            defaultValue={fahrt?.status ?? "abrechenbar"}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="km">Kilometer</Label>
          <Input
            id="km"
            name="km"
            required
            inputMode="decimal"
            placeholder="z. B. 42,5"
            disabled={readOnly}
            defaultValue={fahrt?.km ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="km_satz">km-Satz (optional, EUR)</Label>
          <Input
            id="km_satz"
            name="km_satz"
            inputMode="decimal"
            placeholder="z. B. 0,30"
            disabled={readOnly}
            defaultValue={fahrt?.km_satz ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="strecke">Strecke / Zweck</Label>
        <Input
          id="strecke"
          name="strecke"
          maxLength={500}
          placeholder="z. B. Berlin → Hamburg, Kundentermin"
          disabled={readOnly}
          defaultValue={fahrt?.strecke ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="steuerlich_relevant"
          value="true"
          disabled={readOnly}
          defaultChecked={fahrt?.steuerlich_relevant ?? false}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        Steuerlich relevant
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="steuer_notiz">Steuer-Notiz (optional)</Label>
        <Textarea
          id="steuer_notiz"
          name="steuer_notiz"
          rows={2}
          maxLength={500}
          disabled={readOnly}
          defaultValue={fahrt?.steuer_notiz ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Light-Hinweis — keine Verpflegungspauschalen oder AfA in v1.
        </p>
      </div>

      {!readOnly ? (
        <div>
          <Button type="submit">{submitLabel}</Button>
        </div>
      ) : null}
    </form>
  );
}
