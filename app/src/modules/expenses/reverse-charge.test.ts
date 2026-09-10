import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateBuchungInput } from "@/modules/journal/invariants";
import { assertRcFreigegeben, calculateRc, correctRc, rcToday, validateRcInput, type RcInput } from "./reverse-charge";
const input: RcInput = { version: 1, tatbestand: "eu_dienstleistung", waehrung: "EUR", satz: "19", abzug: "voll", steuermodus: "regelbesteuerung_ist", modus_bestaetigt: true, leistung_von: "2026-01-01", leistung_bis: "2026-01-31", leistungsabschnitt_bestaetigt: true, zahlungsstatus: "bezahlt", zahlungsdatum: "2026-03-05", zahlungsbetrag: "19.33", eine_zahlung: true, vorgang: "Lieferant/Rechnung/Leistungsabschnitt", bereits_erklaert: false, nachweis: "Rechnung und Kontoauszug geprüft" };
const beleg = { richtung: "ausgabe", belegdatum: "2026-02-03", buchungsdatum: "2026-03-05", betrag_netto: "19.33", betrag_ust: "0.00", betrag_brutto: "19.33", steuersatz: "0" };
const today = "2026-09-07";
describe("RC v1", () => {
  it("keeps the generated PocketBase core and Decimal licence byte-identical", () => {
    execFileSync(process.execPath, [fileURLToPath(new URL("../../../../scripts/build-rc-hook.mjs", import.meta.url)), "--check"]);
  });
  for (const tatbestand of ["eu_dienstleistung", "drittland_dienstleistung"] as const) {
    for (const steuermodus of ["regelbesteuerung_ist", "kleinunternehmer"] as const) {
      for (const abzug of ["voll", "ausgeschlossen"] as const) it(`${tatbestand}/${steuermodus}/${abzug}`, () => {
        const before = { ...beleg };
        const result = calculateRc({ ...input, tatbestand, steuermodus, abzug }, beleg, steuermodus, today);
        expect(result.schuld).toBe("3.67");
        expect(result.vorsteuer).toBe(steuermodus === "regelbesteuerung_ist" && abzug === "voll" ? "3.67" : "0.00");
        expect(result.steuerdatum).toBe(tatbestand === "eu_dienstleistung" ? "2026-01-31" : "2026-02-03");
        expect(beleg).toEqual(before);
      });
    }
  }
  it.each([["0.02", "0.00"], ["0.03", "0.01"], ["0.50", "0.10"], ["19.33", "3.67"]])("rounds %s once on the receipt base", (base, tax) => {
    expect(calculateRc({ ...input, zahlungsbetrag: base }, { ...beleg, betrag_netto: base, betrag_brutto: base }, input.steuermodus, today).schuld).toBe(tax);
  });
  it("supports 7% separately from the invoice's 0%", () => expect(calculateRc({ ...input, satz: "7" }, beleg, input.steuermodus, today).schuld).toBe("1.35"));
  it("bounds the third-country period by the end of the following month", () => expect(calculateRc({ ...input, tatbestand: "drittland_dienstleistung" }, { ...beleg, belegdatum: "2026-03-01" }, input.steuermodus, today).steuerdatum).toBe("2026-02-28"));
  it("uses full advance outflow, irrespective of later performance/invoice", () => {
    const result = calculateRc({ ...input, zahlungsdatum: "2026-01-10" }, { ...beleg, buchungsdatum: "2026-01-10" }, input.steuermodus, today);
    expect(result).toMatchObject({ steuerdatum: "2026-01-10", zeitregel: "vorauszahlung_abfluss", schuld: "3.67", vorsteuer: "3.67" });
  });
  it.each(["unbezahlt", "teilbezahlt"])("retains %s draft but blocks closing", zahlungsstatus => {
    const raw = { ...input, zahlungsstatus };
    expect(validateRcInput(raw)).toEqual(raw);
    expect(() => calculateRc(raw, beleg, input.steuermodus, today)).toThrow("separat");
  });
  it.each([{ eine_zahlung: false }, { zahlungsbetrag: "19.32" }, { bereits_erklaert: true }, { modus_bestaetigt: false }, { waehrung: "USD" }, { abzug: "teilweise" }, { schuld: "0.01" }, { leistung_bis: "2026-02-30" }])("rejects unsupported/forged input %j", patch => expect(() => calculateRc({ ...input, ...patch }, beleg, input.steuermodus, today)).toThrow());
  it("rejects a changed company mode without changing the draft", () => {
    expect(() => calculateRc(input, beleg, "kleinunternehmer", today)).toThrow("Steuer-Modus");
    expect(input.steuermodus).toBe("regelbesteuerung_ist");
  });
  it("refuses RC in the old manual journal path instead of dropping classification", () => {
    expect(() => validateBuchungInput({ ...beleg, buchungstext: "RC", richtung: "ausgabe", rc: input } as Parameters<typeof validateBuchungInput>[0])).toThrow("atomare RC");
  });
  it("rejects long continuous services and ambiguous third-country pre-invoices", () => {
    expect(() => calculateRc({ ...input, leistung_von: "2025-01-01", leistung_bis: "2026-01-02" }, beleg, input.steuermodus, today)).toThrow("Jahr");
    expect(() => calculateRc({ ...input, tatbestand: "drittland_dienstleistung" }, { ...beleg, belegdatum: "2026-01-01" }, input.steuermodus, today)).toThrow("Vorausrechnung");
  });
  it("rejects future settlements, inconsistent normal amounts and invoice VAT", () => {
    expect(() => calculateRc({ ...input, zahlungsdatum: "2027-01-01" }, { ...beleg, buchungsdatum: "2027-01-01" }, input.steuermodus, today)).toThrow();
    expect(() => calculateRc(input, { ...beleg, betrag_ust: "0.01" }, input.steuermodus, today)).toThrow();
    expect(() => calculateRc(input, { ...beleg, betrag_netto: "19.32" }, input.steuermodus, today)).toThrow();
  });
  it("keeps absence distinct from 0% and permits public release", () => {
    expect(validateRcInput(undefined)).toBeNull();
    expect(() => validateRcInput({})).toThrow();
    expect(() => assertRcFreigegeben()).not.toThrow();
  });
  it("distinguishes capture error from subsequent full refund", () => {
    const original = calculateRc(input, beleg, input.steuermodus, today);
    const data = { original: "journalid", datum: "2026-04-02", nachweis: "Vollständige Rückabwicklung nachgewiesen" };
    expect(correctRc(original, { ...data, art: "erfassungsfehler" }, today)).toMatchObject({ grundlage: "-19.33", schuld: "-3.67", vorsteuer: "-3.67", steuerdatum: "2026-01-31" });
    expect(correctRc(original, { ...data, art: "vollstaendige_rueckzahlung" }, today)).toMatchObject({ steuerdatum: "2026-04-02", schuld: "-3.67" });
    expect(original.schuld).toBe("3.67");
    expect(() => correctRc(original, { ...data, art: "vollstaendige_rueckzahlung", datum: "2026-02-01" }, today)).toThrow();
  });
  it.each([["2026-03-29T00:30:00Z", "2026-03-29"], ["2026-03-29T22:30:00Z", "2026-03-30"], ["2026-10-25T22:30:00Z", "2026-10-25"], ["2026-12-31T23:30:00Z", "2027-01-01"]])("Berlin day %s", (now, day) => expect(rcToday(now)).toBe(day));
});
