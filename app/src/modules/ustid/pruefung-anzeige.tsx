import { formatDateTimeDe } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  istAnfragendeAbgelehnt,
  qualifiziertErgebnisLabel,
} from "./status";
import type { UstIdPruefung } from "./types";

function statusBadge(p: UstIdPruefung) {
  if (p.gueltig_zum_anfragezeitpunkt) {
    return <Badge variant="success">gültig zum Anfragezeitpunkt</Badge>;
  }
  if (istAnfragendeAbgelehnt(p.status)) {
    return <Badge variant="danger">eigene Nummer abgelehnt</Badge>;
  }
  return <Badge variant="warning">nicht gültig zum Anfragezeitpunkt</Badge>;
}

export function PruefungAnzeige({
  pruefung,
  title,
}: {
  pruefung: UstIdPruefung;
  title?: string;
}) {
  const zeit = pruefung.anfrage_zeitpunkt || pruefung.created || "";
  return (
    <div className="space-y-3 text-sm">
      {title ? <p className="font-medium text-foreground">{title}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge(pruefung)}
        <span className="font-mono tabular-nums">{pruefung.status}</span>
      </div>
      <p className="text-foreground">{pruefung.status_meldung}</p>
      <dl className="grid gap-2 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="text-xs">Anfragezeitpunkt</dt>
          <dd>{formatDateTimeDe(zeit)}</dd>
        </div>
        <div>
          <dt className="text-xs">Art</dt>
          <dd>
            {pruefung.art === "qualifiziert"
              ? "qualifizierte Bestätigung"
              : "einfache Bestätigung"}
          </dd>
        </div>
        <div>
          <dt className="text-xs">Anfragende USt-IdNr.</dt>
          <dd className="font-mono tabular-nums">{pruefung.anfragende_ust_id}</dd>
        </div>
        <div>
          <dt className="text-xs">Abgefragte USt-IdNr.</dt>
          <dd className="font-mono tabular-nums">{pruefung.abgefragte_ust_id}</dd>
        </div>
        {pruefung.bzst_id ? (
          <div className="sm:col-span-2">
            <dt className="text-xs">BZSt-Datensatz-ID</dt>
            <dd className="font-mono text-xs">{pruefung.bzst_id}</dd>
          </div>
        ) : null}
        {pruefung.gueltig_ab ? (
          <div>
            <dt className="text-xs">gültig ab (BZSt)</dt>
            <dd>{pruefung.gueltig_ab}</dd>
          </div>
        ) : null}
        {pruefung.gueltig_bis ? (
          <div>
            <dt className="text-xs">gültig bis (BZSt)</dt>
            <dd>{pruefung.gueltig_bis}</dd>
          </div>
        ) : null}
      </dl>
      {pruefung.art === "qualifiziert" ? (
        <ul className="space-y-1 text-muted-foreground">
          {(
            [
              ["Name", pruefung.erg_firmenname, pruefung.anfrage_name],
              ["Straße", pruefung.erg_strasse, pruefung.anfrage_strasse],
              ["PLZ", pruefung.erg_plz, pruefung.anfrage_plz],
              ["Ort", pruefung.erg_ort, pruefung.anfrage_ort],
            ] as const
          ).map(([label, code, sent]) => (
            <li key={label}>
              <span className="font-medium text-foreground">{label}</span>
              {sent ? ` „${sent}“` : ""}
              {code ? ` — ${code}: ${qualifiziertErgebnisLabel(code)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Schnappschuss des BZSt-Datensatzes. Kein Dauer-Stempel, keine Aussage
        zum Leistungszeitpunkt einer Rechnung.
      </p>
    </div>
  );
}

export function KontaktPruefungForm({
  action,
  kontaktId,
  disabled,
}: {
  action: (formData: FormData) => Promise<void>;
  kontaktId: string;
  disabled?: boolean;
}) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kontaktId" value={kontaktId} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="qualifiziert"
          value="true"
          className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          disabled={disabled}
        />
        <span>
          Qualifizierte Bestätigung (Name und Ort der gespeicherten
          Stammdaten mitprüfen; Straße und PLZ optional)
        </span>
      </label>
      <Button type="submit" variant="secondary" size="sm" disabled={disabled}>
        Beim BZSt prüfen
      </Button>
    </form>
  );
}
