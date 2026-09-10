import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseBelegForm } from "./beleg-form-input";
import { validateBelegInput } from "./invariants";
import { calculateRc, RC_PAYMENT_ERROR, type RcInput } from "./reverse-charge";
import { RcFields } from "./rc-fields";
import { RcDetails } from "./rc-details";
import { BelegForm } from "./beleg-form";
import type { Beleg } from "./types";
const rc: RcInput = { version: 1, tatbestand: "eu_dienstleistung", waehrung: "EUR", satz: "19", abzug: "voll", steuermodus: "regelbesteuerung_ist", modus_bestaetigt: true, leistung_von: "2026-01-01", leistung_bis: "2026-01-31", leistungsabschnitt_bestaetigt: true, zahlungsstatus: "bezahlt", zahlungsdatum: "2026-03-05", zahlungsbetrag: "19.33", eine_zahlung: true, vorgang: "supplier/contract/january", bereits_erklaert: false, nachweis: "Synthetische Rechnung und Zahlungsnachweis" };
function form(patch: Partial<RcInput> = {}) {
  const r = { ...rc, ...patch };
  const f = new FormData();
  Object.entries({ steuerbehandlung: r.tatbestand, richtung: "ausgabe", belegdatum: "2026-02-03", buchungsdatum: r.zahlungsdatum, betrag_netto: "19,33", betrag_ust: "0", steuersatz: "0" }).forEach(([k,v]) => f.set(k,v));
  Object.entries(r).filter(([k]) => !["version", "tatbestand"].includes(k)).forEach(([k,v]) => f.set("rc_" + k, String(v)));
  return f;
}
function preview(f: FormData) { const b = validateBelegInput(parseBelegForm(f)); return calculateRc(b.rc, b, b.rc!.steuermodus, "2026-09-08"); }
describe("RC form boundary and shared preview", () => {
  for (const tatbestand of ["eu_dienstleistung", "drittland_dienstleistung"] as const) for (const steuermodus of ["kleinunternehmer", "regelbesteuerung_ist"] as const) it(`${tatbestand} ${steuermodus}`, () => {
    const p = preview(form({ tatbestand, steuermodus }));
    expect(p).toMatchObject({ grundlage: "19.33", schuld: "3.67", vorsteuer: steuermodus === "kleinunternehmer" ? "0.00" : "3.67", steuerdatum: tatbestand === "eu_dienstleistung" ? "2026-01-31" : "2026-02-03" });
    const html = renderToStaticMarkup(createElement(RcDetails, { rc: p }));
    expect(html).toContain("Rechnungsbetrag"); expect(html).toContain("Auswirkung Zahllast"); expect(html).not.toContain("Kennziffern");
  });
  it("excluded deduction retains full debt", () => { expect(preview(form({ abzug: "ausgeschlossen" }))).toMatchObject({ schuld: "3.67", vorsteuer: "0.00" }); });
  it("advance uses outflow, stable reference survives", () => { expect(preview(form({ zahlungsdatum: "2026-01-05" }))).toMatchObject({ steuerdatum: "2026-01-05", zeitregel: "vorauszahlung_abfluss", vorgang: rc.vorgang }); });
  it.each(["unbezahlt", "teilbezahlt"] as const)("%s can remain a draft but never preview as supported", zahlungsstatus => {
    expect(parseBelegForm(form({ zahlungsstatus })).rc?.zahlungsstatus).toBe(zahlungsstatus);
    expect(() => preview(form({ zahlungsstatus }))).toThrow(RC_PAYMENT_ERROR);
  });
  it("rejects invoice VAT and derives the accounting date from a full payment", () => {
    const f = form(); f.set("betrag_ust", "3,67"); expect(() => preview(f)).toThrow(/ohne ausgewiesene Rechnungssteuer|nicht unterstützt/);
    const g = form(); g.set("buchungsdatum", "2026-01-31"); expect(preview(g).zahlungsdatum).toBe("2026-03-05");
  });
  it.each(["rc_schuld", "rc_steuerdatum", "rc_version", "rc"])("rejects forged %s", key => { const f = form(); f.set(key, "1"); expect(() => parseBelegForm(f)).toThrow(); });
  it.each([{ satz: "0" }, { abzug: "teilweise" }, { waehrung: "USD" }, { modus_bestaetigt: "yes" }])("rejects forged contract %j", patch => { const f = form(); Object.entries(patch).forEach(([k,v]) => f.set("rc_" + k,v)); expect(() => parseBelegForm(f)).toThrow(); });
  it("explicit ordinary override clears RC without inferring from supplier", () => {
    const f = form(); [...f.keys()].filter(k => k.startsWith("rc_")).forEach(k => f.delete(k)); f.set("steuerbehandlung", "bisherig"); f.set("lieferant", "foreign-with-de-vat");
    expect(parseBelegForm(f).rc).toBeNull(); expect(parseBelegForm(f).lieferant).toBe("foreign-with-de-vat");
  });
  it.each(["19", "7", "0"])("ordinary %s unchanged", rate => { const f = new FormData(); Object.entries({ richtung: "ausgabe", belegdatum: "2026-02-03", betrag_netto: "100", steuersatz: rate }).forEach(([k,v]) => f.set(k,v)); expect(validateBelegInput(parseBelegForm(f))).toMatchObject({ betrag_ust: rate + ".00", rc: null }); });
  it("derives the payment amount, confirmations, evidence and a stable reference", () => {
    const f = form();
    for (const key of ["rc_zahlungsbetrag", "rc_vorgang", "rc_nachweis"] as const) f.delete(key);
    const parsed = parseBelegForm(f);
    expect(parsed.buchungsdatum).toBe(rc.zahlungsdatum);
    expect(parsed.rc).toMatchObject({ zahlungsbetrag: "19.33", eine_zahlung: true, modus_bestaetigt: true, leistungsabschnitt_bestaetigt: true, nachweis: "Rechnung sowie Leistungs- und Zahlungsdaten sind am Beleg dokumentiert." });
    const first = parsed.rc!.vorgang;
    expect(parseBelegForm(f).rc!.vorgang).toBe(first);
  });
  it("derives the firm's tax mode instead of rendering a confirmation", () => {
    const html = renderToStaticMarkup(createElement(RcFields, { rc, modus: "kleinunternehmer" }));
    expect(html).not.toMatch(/name="rc_modus_bestaetigt"[^>]*checked/);
    expect(html).not.toMatch(/checked[^>]*name="rc_modus_bestaetigt"/);
  });
  it("keeps the default RC form short and moves special details behind disclosure", () => {
    const html = renderToStaticMarkup(createElement(RcFields, { modus: "kleinunternehmer" }));
    expect(html).toContain("Die deutsche Umsatzsteuer wird automatisch berechnet."); expect(html).not.toContain(RC_PAYMENT_ERROR); expect(html).toContain("<details"); expect(html).toContain("Weitere steuerliche Details"); expect(html).not.toContain('name="rc_schuld"');
    expect(renderToStaticMarkup(createElement(RcFields, { rc: { ...rc, zahlungsstatus: "teilbezahlt" }, modus: "regelbesteuerung_ist" }))).toContain(RC_PAYMENT_ERROR);
  });
  it("does not render an error for a fresh RC form", () => {
    const html = renderToStaticMarkup(createElement(BelegForm, { action: async () => {}, steuermodus: "regelbesteuerung_ist", lieferanten: [], kunden: [], kategorien: [], mode: "create" }));
    expect(html).not.toContain("Noch keine gültige Abschlussvorschau"); expect(html).not.toContain("text-destructive");
  });
  it("prefills every saved RC field when an editable draft is rendered again", () => {
    const saved: Beleg = {
      id: "rc-draft", firma: "firma", status: "entwurf", belegdatum: "2026-09-08", buchungsdatum: "2026-09-08",
      richtung: "ausgabe", lieferant: null, kunde: null, betrag_netto: "42.00", betrag_ust: "0.00", betrag_brutto: "42.00",
      steuersatz: "0", kategorie: "", notiz: "", konto: "", datei: [], belegnummer: "", journal_eintrag: null, festgeschrieben_am: "", rc,
    };
    const html = renderToStaticMarkup(createElement(BelegForm, {
      action: async () => {}, steuermodus: "regelbesteuerung_ist", lieferanten: [], kunden: [], kategorien: [], beleg: saved, mode: "edit",
    }));
    for (const key of ["leistung_von", "leistung_bis", "zahlungsdatum", "abzug", "satz", "vorgang"] as const) expect(html).toContain(`name=\"rc_${key}\"`);
    expect(html).toContain(rc.vorgang); expect(html).toContain(rc.nachweis);
    expect(html).toContain('name="rc_modus_bestaetigt" value="true"');
    expect(html).toContain('name="steuerbehandlung"');
    expect(html).toContain('value="eu_dienstleistung" selected');
  });
});
