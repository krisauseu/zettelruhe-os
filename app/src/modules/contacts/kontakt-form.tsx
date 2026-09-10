import { STEUERBEHANDLUNGEN } from "./steuerstandard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Kontakt } from "./types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  kontakt?: Kontakt | null;
  submitLabel: string;
  error?: string | null;
};

export function KontaktForm({ action, kontakt, submitLabel, error }: Props) {
  return (
    <form action={action} className="flex flex-col gap-5">
      {kontakt ? <input type="hidden" name="id" value={kontakt.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name / Firma</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={kontakt?.name ?? ""}
          autoComplete="organization"
        />
      </div>

      {kontakt?.kontaktnummer ? (
        <div className="flex flex-col gap-1.5">
          <Label>Kontaktnummer</Label>
          <p className="font-mono text-sm tabular-nums text-foreground">
            {kontakt.kontaktnummer}
          </p>
          <p className="text-xs text-muted-foreground">
            Wird bei Neuanlage vergeben und bleibt unverändert. Prefix unter
            Firma.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Kontaktnummer wird beim Anlegen automatisch vergeben (Prefix unter
          Firma).
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Rollen</legend>
        <p className="text-xs text-muted-foreground">
          Ein Kontakt kann Kund:in und/oder Lieferant:in sein.
        </p>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="ist_kunde"
            value="true"
            defaultChecked={kontakt?.ist_kunde ?? true}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Kund:in
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="ist_lieferant"
            value="true"
            defaultChecked={kontakt?.ist_lieferant ?? false}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Lieferant:in
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ausgaben_steuerstandard">Ausgaben-Steuerstandard · optional</Label>
        <select id="ausgaben_steuerstandard" name="ausgaben_steuerstandard" defaultValue={kontakt?.ausgaben_steuerstandard ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Kein Vorschlag</option>
          {Object.entries(STEUERBEHANDLUNGEN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Nur ein Vorschlag bei neuen Ausgabenbelegen. Die endgültige Auswahl erfolgt am Beleg. Bestehende Entwürfe und Festschreibungen bleiben unverändert. Land und USt-ID allein entscheiden die Behandlung nicht.</p>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-medium text-foreground">
          Adresse
        </legend>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="strasse">Straße</Label>
          <Input
            id="strasse"
            name="strasse"
            defaultValue={kontakt?.strasse ?? ""}
            autoComplete="street-address"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plz">PLZ</Label>
          <Input
            id="plz"
            name="plz"
            defaultValue={kontakt?.plz ?? ""}
            autoComplete="postal-code"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ort">Ort</Label>
          <Input
            id="ort"
            name="ort"
            defaultValue={kontakt?.ort ?? ""}
            autoComplete="address-level2"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="land">Land (ISO-2)</Label>
          <Input
            id="land"
            name="land"
            defaultValue={kontakt?.land || "DE"}
            maxLength={2}
            autoComplete="country"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="ust_id">USt-IdNr. (optional)</Label>
          <Input
            id="ust_id"
            name="ust_id"
            defaultValue={kontakt?.ust_id ?? ""}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Fremde Nummer als Stammdatum. Nach dem Speichern beim BZSt prüfbar
            — kein Dauer-„gültig“, festgeschriebene Belege bleiben unverändert.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="leitweg_id">Leitweg-ID / Käuferreferenz</Label>
          <Input
            id="leitweg_id"
            name="leitweg_id"
            defaultValue={kontakt?.leitweg_id ?? ""}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Für XRechnung Pflicht (Behörde: Leitweg-ID; sonst Käuferreferenz).
            Bei ZUGFeRD-CII optional.
          </p>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-medium text-foreground">
          Kontakt
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={kontakt?.email ?? ""}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefon">Telefon</Label>
          <Input
            id="telefon"
            name="telefon"
            type="tel"
            defaultValue={kontakt?.telefon ?? ""}
            autoComplete="tel"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-medium text-foreground">
          Bankdaten (optional)
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            name="iban"
            defaultValue={kontakt?.iban ?? ""}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bic">BIC</Label>
          <Input
            id="bic"
            name="bic"
            defaultValue={kontakt?.bic ?? ""}
            autoComplete="off"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={3}
          defaultValue={kontakt?.notiz ?? ""}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
