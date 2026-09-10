import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function FirmaAnlegenForm({ error }: { error?: string | null }) {
  return (
    <form
      action="/app/firma/neu/submit"
      method="post"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name der Firma</Label>
        <Input id="name" name="name" required autoComplete="organization" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="strasse">Straße und Hausnummer</Label>
        <Input id="strasse" name="strasse" autoComplete="street-address" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plz">PLZ</Label>
          <Input id="plz" name="plz" autoComplete="postal-code" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="ort">Ort</Label>
          <Input id="ort" name="ort" autoComplete="address-level2" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="land">Land (ISO)</Label>
          <Input id="land" name="land" maxLength={2} defaultValue="DE" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="steuernummer">Steuernummer (optional)</Label>
          <Input id="steuernummer" name="steuernummer" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ust_id">USt-IdNr. (optional)</Label>
        <Input id="ust_id" name="ust_id" />
        <p className="text-xs text-muted-foreground">
          Eigene DE-Nummer der Firma. Später an der Firma änderbar.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="steuermodus">Steuer-Modus</Label>
        <Select
          id="steuermodus"
          name="steuermodus"
          required
          defaultValue="regelbesteuerung_ist"
        >
          <option value="kleinunternehmer">
            Kleinunternehmerregelung (§ 19 UStG)
          </option>
          <option value="regelbesteuerung_ist">
            Regelbesteuerung (Ist-Versteuerung)
          </option>
        </Select>
        <p className="text-xs text-muted-foreground">
          Gilt nur für diese Firma. Die andere Firma behält ihren Steuer-Modus.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skr">Kontenrahmen</Label>
        <Select id="skr" name="skr" required defaultValue="skr03">
          <option value="skr03">SKR03</option>
          <option value="skr04">SKR04</option>
        </Select>
        <p className="text-xs text-muted-foreground">
          Nach dem Anlegen nicht mehr wechselbar.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit">Firma anlegen und wechseln</Button>
    </form>
  );
}
