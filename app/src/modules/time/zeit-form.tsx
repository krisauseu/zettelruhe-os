import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { splitDauerMinuten, todayBerlin } from "./invariants";
import type { Abrechnungsstatus, Zeiteintrag } from "./types";

type Option = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  eintrag?: Zeiteintrag | null;
  kunden: Option[];
  projekte: Option[];
  submitLabel: string;
  error?: string | null;
  /** Read-only wenn abgerechnet mit Rechnung */
  readOnly?: boolean;
};

const STATUS_OPTIONS: { value: Abrechnungsstatus; label: string }[] = [
  { value: "abrechenbar", label: "Abrechenbar" },
  { value: "nicht_abrechenbar", label: "Nicht abrechenbar" },
  { value: "abgerechnet", label: "Abgerechnet" },
];

export function ZeitForm({
  action,
  eintrag,
  kunden,
  projekte,
  submitLabel,
  error,
  readOnly = false,
}: Props) {
  const dauer = eintrag
    ? splitDauerMinuten(eintrag.dauer_minuten)
    : { stunden: 1, minuten: 0 };

  return (
    <form action={action} className="flex flex-col gap-5">
      {eintrag ? <input type="hidden" name="id" value={eintrag.id} /> : null}

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
            defaultValue={eintrag?.kunde ?? ""}
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
            defaultValue={eintrag?.projekt ?? ""}
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
            defaultValue={eintrag?.datum ?? todayBerlin()}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            name="status"
            disabled={readOnly}
            defaultValue={eintrag?.status ?? "abrechenbar"}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Dauer
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stunden" className="text-xs text-muted-foreground">
            Stunden
          </Label>
          <Input
            id="stunden"
            name="stunden"
            type="number"
            min={0}
            step={1}
            disabled={readOnly}
            defaultValue={dauer.stunden}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minuten" className="text-xs text-muted-foreground">
            Minuten (15-Min-Raster)
          </Label>
          <Select
            id="minuten"
            name="minuten"
            disabled={readOnly}
            defaultValue={String(dauer.minuten)}
          >
            {Array.from(
              new Set([0, 15, 30, 45, dauer.minuten].filter((m) => m >= 0 && m < 60)),
            )
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="dezimal_stunden"
            className="text-xs text-muted-foreground"
          >
            oder Dezimalstunden
          </Label>
          <Input
            id="dezimal_stunden"
            name="dezimal_stunden"
            placeholder="z. B. 1,5"
            disabled={readOnly}
            // Leer lassen wenn Stunden/Minuten genutzt — sonst würden beide greifen
            defaultValue=""
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Stunden und Minuten haben Vorrang (Minuten in 15er-Schritten).
          Alternativ Dezimalstunden in 0,25-Schritten (z. B. 1,25 = 1:15 h).
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="beschreibung">Beschreibung</Label>
        <Textarea
          id="beschreibung"
          name="beschreibung"
          rows={3}
          maxLength={2000}
          disabled={readOnly}
          defaultValue={eintrag?.beschreibung ?? ""}
        />
      </div>

      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="stundensatz">Stundensatz (optional, EUR)</Label>
        <Input
          id="stundensatz"
          name="stundensatz"
          inputMode="decimal"
          placeholder="z. B. 85,00"
          disabled={readOnly}
          defaultValue={eintrag?.stundensatz ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Für die Übernahme in Rechnungspositionen.
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
