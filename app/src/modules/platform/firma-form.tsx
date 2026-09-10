"use client";

import { useState } from "react";
import type { FirmaRecord } from "@/lib/pb";
import { SKR_LABELS, STEUERMODUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateFirmaAction } from "./firma-actions";
import { DEFAULT_DOKUMENT_AKZENTFARBE } from "@/modules/sales/pdf-layout";

const NK_ROWS = [
  ["angebot", "Angebot"],
  ["rechnung", "Rechnung"],
  ["gutschrift", "Gutschrift"],
  ["beleg", "Beleg"],
  ["kasse", "Kassenbuch"],
  ["kontakt", "Kontakt"],
] as const;

export function FirmaForm({
  firma,
  error,
  readOnly = false,
}: {
  firma: FirmaRecord;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [steuermodus, setSteuermodus] = useState(firma.steuermodus);
  const steuermodusGeaendert = steuermodus !== firma.steuermodus;

  return (
    <form
      action={readOnly ? undefined : updateFirmaAction}
      encType="multipart/form-data"
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="nummernkreise_expected" value={JSON.stringify(firma.nummernkreise)} />
      {readOnly ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Nur die Eigentümer:in der Firma kann Stammdaten, Steuer-Modus und
          Nummernkreise ändern.
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <fieldset disabled={readOnly} className="flex flex-col gap-8 border-0 p-0">
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-foreground">
          Stammdaten
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name der Firma</Label>
          <Input id="name" name="name" required defaultValue={firma.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strasse">Straße und Hausnummer</Label>
          <Input
            id="strasse"
            name="strasse"
            defaultValue={firma.strasse ?? ""}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plz">PLZ</Label>
            <Input id="plz" name="plz" defaultValue={firma.plz ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ort">Ort</Label>
            <Input id="ort" name="ort" defaultValue={firma.ort ?? ""} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="land">Land (ISO)</Label>
            <Input
              id="land"
              name="land"
              maxLength={2}
              defaultValue={firma.land || "DE"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="steuernummer">Steuernummer</Label>
            <Input
              id="steuernummer"
              name="steuernummer"
              defaultValue={firma.steuernummer ?? ""}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ust_id">USt-IdNr. (optional)</Label>
          <Input id="ust_id" name="ust_id" defaultValue={firma.ust_id ?? ""} />
          <p className="text-xs text-muted-foreground">
            Eigene Nummer der Firma. Unter der Kleinunternehmerregelung
            zulässig, ändert USt- und ZM-Übersicht nicht. Das BZSt bestätigt
            damit ausländische Nummern — nicht diese DE-Nummer isoliert.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-Mail (E-Rechnung)</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={firma.email ?? ""}
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Elektronische Adresse der Firma. Für XRechnung Pflicht.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telefon">Telefon (optional)</Label>
            <Input
              id="telefon"
              name="telefon"
              type="tel"
              defaultValue={firma.telefon ?? ""}
              autoComplete="tel"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="webseite">Webseite (optional)</Label>
          <Input
            id="webseite"
            name="webseite"
            type="text"
            inputMode="url"
            defaultValue={firma.webseite ?? ""}
            autoComplete="url"
            maxLength={200}
            placeholder="www.beispiel.de"
          />
          <p className="text-xs text-muted-foreground">
            Erscheint in der Fußzeile von Angebot und Rechnung unter der
            E-Mail.
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-foreground">
          Steuer & Kontenrahmen
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="steuermodus">Steuer-Modus</Label>
          <Select
            id="steuermodus"
            name="steuermodus"
            value={steuermodus}
            onChange={(e) =>
              setSteuermodus(e.target.value as FirmaRecord["steuermodus"])
            }
          >
            <option value="kleinunternehmer">
              {STEUERMODUS_LABELS.kleinunternehmer}
            </option>
            <option value="regelbesteuerung_ist">
              {STEUERMODUS_LABELS.regelbesteuerung_ist}
            </option>
          </Select>
          <p className="text-xs text-muted-foreground">
            Wechsel wirkt auf neue Belege und Rechnungen. Festgeschriebene
            Dokumente bleiben historisch korrekt.
          </p>
        </div>
        {steuermodusGeaendert ? (
          <label className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="steuermodus_bestaetigt"
              value="1"
              required
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              Ich bestätige den Wechsel des Steuer-Modus. Bestehende
              festgeschriebene Belege, Rechnungen und Journalzeilen bleiben
              unverändert.
            </span>
          </label>
        ) : null}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Kontenrahmen
          </p>
          <p className="mt-1 text-sm font-medium">{SKR_LABELS[firma.skr]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Der Kontenrahmen lässt sich nach dem Setup nicht mehr wechseln.
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-foreground">
          Dokumenten-Layout
        </legend>
        <p className="text-xs text-muted-foreground">
          Gilt für neue Angebots- und Rechnungs-PDFs (Vorschau und Original).
          Bereits gesendete bzw. festgeschriebene PDFs bleiben unverändert.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="logo">Logo</Label>
          {firma.logo ? (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/app/firma/logo"
                alt="Logo der Firma"
                className="h-12 max-w-[10rem] object-contain"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="logo_entfernen"
                  value="1"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Logo entfernen
              </label>
            </div>
          ) : null}
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG oder WebP, höchstens 2 MB.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dokument_akzentfarbe">Akzentfarbe</Label>
          <div className="flex items-center gap-3">
            <input
              id="dokument_akzentfarbe"
              name="dokument_akzentfarbe"
              type="color"
              defaultValue={
                firma.dokument_akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE
              }
              className="h-10 w-14 cursor-pointer rounded-md border border-input bg-card p-1"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {firma.dokument_akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dokument_kopftext">Kopftext (optional)</Label>
          <Textarea
            id="dokument_kopftext"
            name="dokument_kopftext"
            rows={3}
            maxLength={500}
            defaultValue={firma.dokument_kopftext ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dokument_fusstext">Fußtext (optional)</Label>
          <Textarea
            id="dokument_fusstext"
            name="dokument_fusstext"
            rows={3}
            maxLength={1000}
            defaultValue={firma.dokument_fusstext ?? ""}
          />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Sichtbarkeit</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="dokument_header_drucken"
              value="1"
              defaultChecked={firma.dokument_header_drucken !== false}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              Firmen-Header und Logo drucken
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Aus, wenn vorgedrucktes Briefpapier Logo und Anschrift schon
                enthält.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="dokument_fuss_drucken"
              value="1"
              defaultChecked={firma.dokument_fuss_drucken !== false}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              Standard-Fußzeile drucken
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Fußtext, Bankverbindung, Telefon, E-Mail, Webseite und
                Steuernummern am unteren Seitenrand.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="dokument_zahlblock"
              value="1"
              defaultChecked={firma.dokument_zahlblock !== false}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              Zahlungsziel und Bankverbindung im Text
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Überweisungshinweis und GiroCode auf Rechnungen, sobald ein
                aktives Bankkonto mit IBAN existiert. Angebote ohne
                Zahlblock.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">
          Nummernkreise
        </legend>
        <p className="text-xs text-muted-foreground">
          Prefix und Stellen editierbar. Die nächste Nummer darf nicht unter die
          bereits vergebene fallen.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Art</th>
                <th className="py-2 pr-3 font-medium">Prefix</th>
                <th className="py-2 pr-3 font-medium">Stellen</th>
                <th className="py-2 font-medium">Nächste Nr.</th>
              </tr>
            </thead>
            <tbody>
              {NK_ROWS.map(([key, label]) => {
                const cfg = firma.nummernkreise[key] ?? {
                  prefix: "",
                  digits: 4,
                  next: 1,
                };
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{label}</td>
                    <td className="py-2 pr-3">
                      <Input
                        name={`nk_${key}_prefix`}
                        defaultValue={cfg.prefix}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        name={`nk_${key}_digits`}
                        type="number"
                        min={1}
                        max={8}
                        defaultValue={cfg.digits}
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        name={`nk_${key}_next`}
                        type="number"
                        min={cfg.next}
                        defaultValue={cfg.next}
                        className="h-8 w-24"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </fieldset>

      {readOnly ? null : (
        <div>
          <Button type="submit">Firmendaten speichern</Button>
        </div>
      )}
      </fieldset>
    </form>
  );
}
