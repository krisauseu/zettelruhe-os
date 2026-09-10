"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RC_PAYMENT_ERROR, type RcInput, type RcModus } from "./reverse-charge";
export function RcFields({ rc, modus }: { rc?: RcInput | null; modus: RcModus }) {
  const [zahlungsstatus, setZahlungsstatus] = useState(rc?.zahlungsstatus ?? "unbezahlt");
  const paid = zahlungsstatus === "bezahlt";
  const unsupportedPayment = zahlungsstatus === "teilbezahlt";
  const standardAbzug = modus === "kleinunternehmer" ? "ausgeschlossen" : "voll";
  return <fieldset className="space-y-4 rounded-md border p-4">
    <legend className="px-1 font-medium">Reverse Charge</legend>
    <p className="text-sm">Die deutsche Umsatzsteuer wird automatisch berechnet. Auf der Rechnung darf keine deutsche Umsatzsteuer ausgewiesen sein.</p>
    <input type="hidden" name="rc_waehrung" value="EUR" />
    <input type="hidden" name="rc_steuermodus" value={modus} />
    <input type="hidden" name="rc_modus_bestaetigt" value="true" />
    <input type="hidden" name="rc_leistungsabschnitt_bestaetigt" value="true" />
    <input type="hidden" name="rc_eine_zahlung" value={paid ? "true" : "false"} />
    <input type="hidden" name="rc_nachweis" value={rc?.nachweis || "Rechnung sowie Leistungs- und Zahlungsdaten sind am Beleg dokumentiert."} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5"><Label htmlFor="rc_leistung_von">Leistung von *</Label><Input id="rc_leistung_von" name="rc_leistung_von" type="date" required defaultValue={rc?.leistung_von ?? ""} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="rc_leistung_bis">Leistung bis *</Label><Input id="rc_leistung_bis" name="rc_leistung_bis" type="date" required defaultValue={rc?.leistung_bis ?? ""} /></div>
    </div>
    <div className="space-y-2"><Label htmlFor="rc_zahlungsstatus">Bezahlt? *</Label><select className="h-9 w-full rounded-md border bg-background px-3" id="rc_zahlungsstatus" name="rc_zahlungsstatus" value={zahlungsstatus} onChange={event => setZahlungsstatus(event.target.value as RcInput["zahlungsstatus"])}><option value="unbezahlt">Noch nicht vollständig bezahlt</option><option value="bezahlt">Vollständig bezahlt</option><option value="teilbezahlt">Teilzahlung oder mehrere Zahlungen</option></select>
      {paid && <div className="flex flex-col gap-1.5"><Label htmlFor="rc_zahlungsdatum">Bezahlt am *</Label><Input id="rc_zahlungsdatum" name="rc_zahlungsdatum" type="date" required defaultValue={rc?.zahlungsdatum ?? ""} /><p className="text-xs text-muted-foreground">Der Rechnungsbetrag und das Buchungsdatum werden automatisch übernommen.</p></div>}
      {!paid && <input type="hidden" name="rc_zahlungsdatum" value="" />}
      {unsupportedPayment && <p className="rounded-md border border-amber-500 px-3 py-2 text-sm">{RC_PAYMENT_ERROR} Der Beleg kann als Entwurf gespeichert, aber noch nicht festgeschrieben werden.</p>}
      {!paid && !unsupportedPayment && <p className="text-xs text-muted-foreground">Sie können den Beleg als Entwurf speichern und nach der vollständigen Zahlung festschreiben.</p>}
    </div>
    <div className="flex flex-col gap-1.5"><Label htmlFor="rc_abzug">Vorsteuer *</Label><select className="h-9 w-full rounded-md border bg-background px-3" id="rc_abzug" name="rc_abzug" defaultValue={rc?.abzug ?? standardAbzug}>{modus === "regelbesteuerung_ist" && <option value="voll">Vollständig abziehbar</option>}<option value="ausgeschlossen">Nicht abziehbar</option></select></div>
    <details className="rounded-md border px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">Weitere steuerliche Details</summary><div className="mt-3 space-y-3">
      <div className="flex flex-col gap-1.5"><Label htmlFor="rc_satz">Deutscher RC-Steuersatz</Label><select className="h-9 w-full rounded-md border bg-background px-3" id="rc_satz" name="rc_satz" defaultValue={rc?.satz ?? "19"}><option value="19">19 %</option><option value="7">7 %</option></select></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="rc_vorgang">Eigene Referenz für zusammengehörige Voraus- und Schlussrechnungen</Label><Input id="rc_vorgang" name="rc_vorgang" maxLength={160} defaultValue={rc?.vorgang ?? ""} /><p className="text-xs text-muted-foreground">Leer lassen für die automatisch gespeicherte Belegreferenz.</p></div>
      <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="rc_bereits_erklaert" defaultChecked={rc?.bereits_erklaert === true} />Dieser Vorgang wurde bereits separat erklärt.</label>
      <div className="flex flex-col gap-1.5"><Label htmlFor="rc_nachweis_ergaenzung">Zusätzlicher Hinweis zum Nachweis</Label><Textarea id="rc_nachweis_ergaenzung" name="rc_nachweis_ergaenzung" maxLength={2000} defaultValue={rc?.nachweis?.startsWith("Rechnung sowie") ? "" : rc?.nachweis ?? ""} placeholder="optional" /></div>
    </div></details>
  </fieldset>;
}
