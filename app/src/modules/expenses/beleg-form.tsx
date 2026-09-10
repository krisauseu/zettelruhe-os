"use client";

import { useState } from "react";
import { STEUERBEHANDLUNGEN, type Steuerbehandlung } from "@/modules/contacts/steuerstandard";
import { RcFields } from "./rc-fields";
import { RcDetails } from "./rc-details";
import { calculateRc, RC_PUBLIC_ENABLED, type RcSnapshot } from "./reverse-charge";
import { parseBelegForm } from "./beleg-form-input";
import { validateBelegInput } from "./invariants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Steuermodus } from "@/lib/pb";
import { KategorieSelect } from "@/modules/categories/kategorie-select";
import type { KategorieSelectItem } from "@/modules/categories";
import { BelegDateiInput } from "./beleg-datei-input";
import { BelegPartnerSelect } from "./beleg-partner-select";
import type { Beleg, BelegPartnerOption } from "./types";
import { todayBerlin } from "./invariants";

export type { BelegPartnerOption };

type Props = {
  action: (formData: FormData) => Promise<void>;
  steuermodus: Steuermodus;
  lieferanten: BelegPartnerOption[];
  kunden: BelegPartnerOption[];
  /** Aktive Kategorien (+ ggf. aktueller Schnappschuss) */
  kategorien: KategorieSelectItem[];
  error?: string | null;
  beleg?: Beleg | null;
  /** true = Entwurf speichern; false = neu anlegen */
  mode: "create" | "edit";
};

export function BelegForm({
  action,
  steuermodus,
  lieferanten,
  kunden,
  kategorien,
  error,
  beleg,
  mode,
}: Props) {
  const [behandlung, setBehandlung] = useState<Steuerbehandlung>(beleg?.rc?.tatbestand ?? "bisherig");
  const [partnerId, setPartnerId] = useState(beleg?.lieferant ?? "");
  const [herkunft, setHerkunft] = useState(mode === "edit" ? "Gespeicherte Auswahl am Beleg. Kontaktänderungen ändern sie nicht." : "Manuelle Auswahl am Beleg.");
  const [preview, setPreview] = useState<RcSnapshot | string | null>(null);
  const partner = lieferanten.find(k => k.id === partnerId);
  const isRc = behandlung !== "bisherig";
  function changed(form: HTMLFormElement) {
    const data = new FormData(form);
    setPartnerId(String(data.get("lieferant") ?? ""));
    const previewReady = ["betrag_netto", "rc_leistung_von", "rc_leistung_bis"].every(key => String(data.get(key) ?? "").trim()) && data.get("rc_zahlungsstatus") === "bezahlt" && String(data.get("rc_zahlungsdatum") ?? "").trim();
    if (!previewReady) { setPreview(null); return; }
    try {
      const normalized = validateBelegInput(parseBelegForm(data));
      setPreview(normalized.rc ? calculateRc(normalized.rc, normalized, steuermodus, todayBerlin()) : null);
    } catch (e) { setPreview(e instanceof Error ? e.message : "Angaben prüfen."); }
  }
  const showUst = isRc || steuermodus === "regelbesteuerung_ist";
  const datum = beleg?.belegdatum || todayBerlin();
  const buchungsdatum = beleg?.buchungsdatum || "";

  return (
    <form action={action} onChange={e => changed(e.currentTarget)} className="flex flex-col gap-4" encType="multipart/form-data">
      {beleg ? <input type="hidden" name="id" value={beleg.id} /> : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="belegdatum">Belegdatum / Rechnungsausstellung *</Label>
          <Input
            id="belegdatum"
            name="belegdatum"
            type="date"
            required
            defaultValue={datum}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="buchungsdatum">Buchungsdatum</Label>
          <Input
            id="buchungsdatum"
            name="buchungsdatum"
            type="date"
            defaultValue={buchungsdatum}
          />
          <p className="text-xs text-muted-foreground">
            Bei bisheriger Behandlung: leer = Belegdatum. Bei RC: Abflussdatum ausdrücklich eintragen; kein steuerliches Periodenfeld.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="richtung">Richtung *</Label>
          <select
            id="richtung"
            name="richtung"
            required
            defaultValue={beleg?.richtung ?? "ausgabe"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="ausgabe">Ausgabe</option>
            <option value="einnahme">Einnahme</option>
          </select>
        </div>
        <BelegPartnerSelect
          lieferanten={lieferanten}
          kunden={kunden}
          defaultRichtung={beleg?.richtung ?? "ausgabe"}
          defaultLieferant={beleg?.lieferant ?? ""}
          defaultKunde={beleg?.kunde ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kategorie">Kategorie</Label>
          <KategorieSelect
            items={kategorien}
            defaultValue={beleg?.kategorie ?? ""}
            defaultRichtung={beleg?.richtung ?? "ausgabe"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="konto">Konto (SKR)</Label>
          <Input
            id="konto"
            name="konto"
            maxLength={20}
            placeholder="optional"
            defaultValue={beleg?.konto ?? ""}
          />
        </div>
      </div>

      <section className="space-y-2">
        <Label htmlFor="steuerbehandlung">Steuerbehandlung</Label>
        <select id="steuerbehandlung" name="steuerbehandlung" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={behandlung} onChange={e => { setBehandlung(e.target.value as Steuerbehandlung); setHerkunft("Manuell am Beleg gewählt. Ein Lieferantenstandard überschreibt diese Auswahl nicht."); setPreview(null); }}>
          {Object.entries(STEUERBEHANDLUNGEN).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">{herkunft}</p>
        {partner && <p className="text-xs text-muted-foreground">Lieferant: {partner.name} · Land {partner.land || "unbekannt"} · USt-ID {partner.ust_id || "nicht angegeben"}. Diese Angaben allein beweisen keine Steuerbehandlung.</p>}
        {mode === "create" && partner?.ausgaben_steuerstandard && <div className="rounded-md border p-3 text-sm">
          <p>Vorschlag aus dem Lieferantenstandard von {partner.name}: {STEUERBEHANDLUNGEN[partner.ausgaben_steuerstandard]}.</p>
          <Button type="button" variant="secondary" onClick={() => { setBehandlung(partner.ausgaben_steuerstandard as Steuerbehandlung); setHerkunft(`Vorschlag von ${partner.name} übernommen. Bitte am konkreten Beleg prüfen; die Auswahl bleibt übersteuerbar.`); setPreview(null); }}>Vorschlag übernehmen</Button>
        </div>}
        {isRc && !RC_PUBLIC_ENABLED && <p className="text-sm font-medium">Reverse Charge ist bis zur vollständigen Abnahme noch nicht freigegeben. RC-Belege können hier noch nicht gespeichert oder festgeschrieben werden.</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_netto">Netto *</Label>
          <Input
            id="betrag_netto"
            name="betrag_netto"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={beleg?.betrag_netto ?? ""}
          />
        </div>
        {showUst ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="steuersatz">Rechnungs-USt-Satz</Label>
              <select
                id="steuersatz"
                name="steuersatz"
                defaultValue={beleg?.steuersatz || (isRc ? "0" : "19")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="19">19 %</option>
                <option value="7">7 %</option>
                <option value="0">0 %</option>
                <option value="">—</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="betrag_ust">Ausgewiesene Rechnungs-USt</Label>
              <Input
                id="betrag_ust"
                name="betrag_ust"
                inputMode="decimal"
                placeholder="auto"
                defaultValue={beleg?.betrag_ust && beleg.betrag_ust !== "0.00" ? beleg.betrag_ust : ""}
              />
            </div>
          </>
        ) : (
          <input type="hidden" name="steuersatz" value="" />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="betrag_brutto">Brutto (optional)</Label>
          <Input
            id="betrag_brutto"
            name="betrag_brutto"
            inputMode="decimal"
            placeholder="auto"
            defaultValue={beleg?.betrag_brutto ?? ""}
          />
        </div>
      </div>

      {isRc && <>
        <RcFields rc={beleg?.rc} modus={steuermodus} />
        <div aria-live="polite">
          {typeof preview === "string" ? <p className="text-sm text-destructive">Bitte prüfen: {preview}</p> : preview ? <RcDetails rc={preview} /> : <p className="text-sm text-muted-foreground">Die Steuerübersicht erscheint, sobald alle Angaben für die Festschreibung vorliegen.</p>}
        </div>
      </>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bezeichnung">Bezeichnung</Label>
        <Textarea
          id="bezeichnung"
          name="bezeichnung"
          rows={2}
          maxLength={2000}
          placeholder="z. B. Rasensamen und Dünger, Auftrag Müller"
          defaultValue={beleg?.notiz ?? ""}
        />
      </div>

      <BelegDateiInput
        mode={mode}
        belegId={beleg?.id}
        currentNames={beleg?.datei ?? []}
      />

      <p className="text-xs text-muted-foreground">
        {mode === "create"
          ? "Wird als Entwurf gespeichert. Festschreibung erfolgt auf der Detailseite und schreibt ins Buchungsjournal."
          : "Nur Entwürfe sind editierbar. Nach der Festschreibung sind Metadaten und Datei unveränderbar."}
      </p>

      <div>
        <Button type="submit">
          {mode === "create" ? "Entwurf anlegen" : "Entwurf speichern"}
        </Button>
      </div>
    </form>
  );
}
