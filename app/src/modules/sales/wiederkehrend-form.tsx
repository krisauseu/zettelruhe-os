"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { einheitOptionen } from "@/modules/catalog/einheiten";
import type { Steuermodus } from "@/lib/pb";
import type {
  WiederkehrendeRechnungMitPositionen,
  WiederkehrRhythmus,
} from "./wiederkehrend-types";
import { todayBerlin } from "./wiederkehrend-invariants";

export type KundeOption = { id: string; name: string };
export type KatalogOption = {
  id: string;
  bezeichnung: string;
  einheit: string;
  preis: string;
  steuersatz: string;
};

type PositionRow = {
  key: string;
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  steuersatz: string;
  katalog_position: string;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  steuermodus: Steuermodus;
  kunden: KundeOption[];
  katalog: KatalogOption[];
  error?: string | null;
  vorlage?: WiederkehrendeRechnungMitPositionen | null;
  mode: "create" | "edit";
};

function emptyRow(): PositionRow {
  return {
    key: `n-${Math.random().toString(36).slice(2, 9)}`,
    bezeichnung: "",
    menge: "1",
    einheit: "Stück",
    einzelpreis: "",
    steuersatz: "19",
    katalog_position: "",
  };
}

export function WiederkehrendForm({
  action,
  steuermodus,
  kunden,
  katalog,
  error,
  vorlage,
  mode,
}: Props) {
  const showUst = steuermodus === "regelbesteuerung_ist";
  const [rhythmus, setRhythmus] = useState<WiederkehrRhythmus>(
    vorlage?.rhythmus ?? "monatlich",
  );

  const [rows, setRows] = useState<PositionRow[]>(() => {
    if (vorlage?.positionen?.length) {
      return vorlage.positionen.map((p) => ({
        key: p.id,
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        steuersatz: p.steuersatz || "19",
        katalog_position: p.katalog_position || "",
      }));
    }
    return [emptyRow()];
  });

  function addRow() {
    setRows((r) => [...r, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.key !== key)));
  }

  function updateRow(key: string, patch: Partial<PositionRow>) {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  function applyKatalog(key: string, katalogId: string) {
    const item = katalog.find((k) => k.id === katalogId);
    if (!item) {
      updateRow(key, { katalog_position: "" });
      return;
    }
    updateRow(key, {
      katalog_position: item.id,
      bezeichnung: item.bezeichnung,
      einheit: item.einheit,
      einzelpreis: item.preis,
      steuersatz: item.steuersatz || "19",
    });
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {vorlage ? <input type="hidden" name="id" value={vorlage.id} /> : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="bezeichnung">Bezeichnung *</Label>
          <Input
            id="bezeichnung"
            name="bezeichnung"
            required
            maxLength={200}
            defaultValue={vorlage?.bezeichnung ?? ""}
            placeholder="z. B. Hosting monatlich"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="kunde">Kund:in *</Label>
          <select
            id="kunde"
            name="kunde"
            defaultValue={vorlage?.kunde ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">— bitte wählen —</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Für die Erzeugung eines Rechnungs-Entwurfs erforderlich.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="naechstes_datum">Nächstes Datum *</Label>
          <Input
            id="naechstes_datum"
            name="naechstes_datum"
            type="date"
            required
            defaultValue={vorlage?.naechstes_datum || todayBerlin()}
          />
          <p className="text-xs text-muted-foreground">
            Nächstes Ausstellungsdatum (Europe/Berlin).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rhythmus">Rhythmus *</Label>
          <select
            id="rhythmus"
            name="rhythmus"
            value={rhythmus}
            onChange={(e) =>
              setRhythmus(e.target.value as WiederkehrRhythmus)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="monatlich">Monatlich</option>
            <option value="quartalsweise">Quartalsweise</option>
            <option value="jaehrlich">Jährlich</option>
            <option value="tage">Alle X Tage</option>
          </select>
        </div>

        {rhythmus === "tage" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intervall_tage">Intervall (Tage) *</Label>
            <Input
              id="intervall_tage"
              name="intervall_tage"
              type="number"
              min={1}
              max={3650}
              required
              defaultValue={
                vorlage?.intervall_tage && vorlage.intervall_tage > 0
                  ? vorlage.intervall_tage
                  : 30
              }
            />
          </div>
        ) : (
          <input type="hidden" name="intervall_tage" value="" />
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zahlungsziel_tage">Zahlungsziel (Tage)</Label>
          <Input
            id="zahlungsziel_tage"
            name="zahlungsziel_tage"
            type="number"
            min={0}
            max={365}
            defaultValue={
              vorlage?.zahlungsziel_tage !== undefined
                ? vorlage.zahlungsziel_tage
                : 14
            }
          />
          <p className="text-xs text-muted-foreground">
            Fälligkeit = Rechnungsdatum + Zahlungsziel (Standard 14).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aktiv">Status</Label>
          <select
            id="aktiv"
            name="aktiv"
            defaultValue={vorlage?.aktiv === false ? "0" : "1"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="1">Aktiv</option>
            <option value="0">Pausiert</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notiz">Notiz (auf erzeugte Rechnungen)</Label>
        <Textarea
          id="notiz"
          name="notiz"
          rows={2}
          defaultValue={vorlage?.notiz || ""}
          maxLength={2000}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Positionen *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            Position hinzufügen
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className="rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Position {idx + 1}
                </span>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(row.key)}
                  >
                    Entfernen
                  </Button>
                ) : null}
              </div>

              {katalog.length > 0 ? (
                <div className="mb-3 flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Aus Katalog
                  </Label>
                  <select
                    value={row.katalog_position}
                    onChange={(e) => applyKatalog(row.key, e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">— freier Text —</option>
                    {katalog.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.bezeichnung}
                        {k.preis ? ` (${k.preis} €)` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="hidden"
                    name="position_katalog"
                    value={row.katalog_position}
                  />
                </div>
              ) : (
                <input type="hidden" name="position_katalog" value="" />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Bezeichnung *</Label>
                  <Input
                    name="position_bezeichnung"
                    required
                    value={row.bezeichnung}
                    onChange={(e) =>
                      updateRow(row.key, { bezeichnung: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Menge *</Label>
                  <Input
                    name="position_menge"
                    required
                    value={row.menge}
                    onChange={(e) =>
                      updateRow(row.key, { menge: e.target.value })
                    }
                    inputMode="decimal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Einheit</Label>
                  <Select
                    name="position_einheit"
                    value={row.einheit || "Stück"}
                    onChange={(e) =>
                      updateRow(row.key, { einheit: e.target.value })
                    }
                  >
                    {einheitOptionen(row.einheit).map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Einzelpreis netto *</Label>
                  <Input
                    name="position_einzelpreis"
                    required
                    value={row.einzelpreis}
                    onChange={(e) =>
                      updateRow(row.key, { einzelpreis: e.target.value })
                    }
                    inputMode="decimal"
                  />
                </div>
                {showUst ? (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Steuersatz</Label>
                    <select
                      name="position_steuersatz"
                      value={row.steuersatz}
                      onChange={(e) =>
                        updateRow(row.key, { steuersatz: e.target.value })
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    >
                      <option value="19">19 %</option>
                      <option value="7">7 %</option>
                      <option value="0">0 %</option>
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="position_steuersatz" value="" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          {mode === "create" ? "Vorlage anlegen" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
