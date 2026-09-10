import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Bankkonto } from "./types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  bankkonto?: Bankkonto | null;
  submitLabel?: string;
};

export function BankkontoForm({
  action,
  bankkonto,
  submitLabel = "Speichern",
}: Props) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {bankkonto ? (
        <input type="hidden" name="id" value={bankkonto.id} />
      ) : null}
      <input type="hidden" name="aktiv_present" value="1" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={bankkonto?.name ?? ""}
          placeholder="z. B. Geschäftskonto"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kontoinhaber">Kontoinhaber</Label>
        <Input
          id="kontoinhaber"
          name="kontoinhaber"
          maxLength={120}
          defaultValue={bankkonto?.kontoinhaber ?? ""}
          placeholder="optional, erscheint in den Bankdaten auf dem PDF"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            name="iban"
            maxLength={34}
            defaultValue={bankkonto?.iban ?? ""}
            placeholder="DE89…"
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bic">BIC</Label>
          <Input
            id="bic"
            name="bic"
            maxLength={11}
            defaultValue={bankkonto?.bic ?? ""}
            placeholder="optional"
            autoComplete="off"
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="aktiv"
          name="aktiv"
          type="checkbox"
          value="on"
          defaultChecked={bankkonto ? bankkonto.aktiv : true}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="aktiv" className="font-normal">
          Aktiv (Import erlaubt)
        </Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={3}
          maxLength={2000}
          defaultValue={bankkonto?.notiz ?? ""}
        />
      </div>

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
