import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Klassischer Form-POST → /setup/submit (Route-Handler).
 * Gleiches Muster wie Login — zuverlässig hinter Caddy ohne Server-Action-JS.
 */
export function SetupForm({ error }: { error?: string | null }) {
  return (
    <form action="/setup/submit" method="post" className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">
          Eigentümer:in
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Firma</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firmaName">Name der Firma</Label>
          <Input id="firmaName" name="firmaName" required />
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="steuernummer">Steuernummer (optional)</Label>
          <Input id="steuernummer" name="steuernummer" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="steuermodus">Steuer-Modus</Label>
          <Select
            id="steuermodus"
            name="steuermodus"
            required
            defaultValue="kleinunternehmer"
          >
            <option value="kleinunternehmer">
              Kleinunternehmerregelung (§ 19 UStG)
            </option>
            <option value="regelbesteuerung_ist">
              Regelbesteuerung (Ist-Versteuerung)
            </option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skr">Kontenrahmen</Label>
          <Select id="skr" name="skr" required defaultValue="skr03">
            <option value="skr03">SKR03</option>
            <option value="skr04">SKR04</option>
          </Select>
        </div>
      </fieldset>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit">Instanz einrichten</Button>
    </form>
  );
}
