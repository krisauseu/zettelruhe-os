/** Only the documented tmpfs starter may enable this suite. No existing database. */
import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { createRecord, getRecord, getAdminToken, listRecords, updateRecord, deleteRecord, pbEq, DEFAULT_NUMMERNKREISE } from "./pb";
import { belegFestschreiben, belegProjektion } from "./finanz-transaktion";
import * as rcDomain from "@/modules/expenses/reverse-charge";
import { storniereBuchung } from "@/modules/journal/repository";
import { getBeleg, createBeleg, updateBeleg, festschreibenBeleg } from "@/modules/expenses/repository";
import type { Beleg } from "@/modules/expenses/types";
import type { RcInput, RcSnapshot } from "@/modules/expenses/reverse-charge";
import { createKontakt, updateKontakt } from "@/modules/contacts/repository";
import { parseBelegForm } from "@/modules/expenses/beleg-form-input";
import { uploadERechnung, createBelegFromERechnungSafe } from "@/modules/einvoice/repository";
import {
  exportBelegArchivZip,
  exportDatevCsv,
  exportJournalCsv,
  exportUstvaXml,
  getUstvaSeite,
} from "@/modules/reporting";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const generated = require("../../../pocketbase/pb_hooks/reverse-charge.js");
const isolated = process.env.TP022_BELEG_ISOLATED === "1";
const core = process.env.RC_CORE_TEST === "1";
let firma: string, akteur: string, serial = 0;
const input: RcInput = { version: 1, tatbestand: "eu_dienstleistung", waehrung: "EUR", satz: "19", abzug: "voll", steuermodus: "regelbesteuerung_ist", modus_bestaetigt: true, leistung_von: "2026-01-01", leistung_bis: "2026-01-31", leistungsabschnitt_bestaetigt: true, zahlungsstatus: "bezahlt", zahlungsdatum: "2026-03-05", zahlungsbetrag: "19.33", eine_zahlung: true, vorgang: "supplier/invoice/section", bereits_erklaert: false, nachweis: "Synthetic evidence" };
const values = { belegdatum: "2026-02-03", buchungsdatum: "2026-03-05", richtung: "ausgabe", betrag_netto: "19.33", betrag_ust: "0.00", betrag_brutto: "19.33", steuersatz: "0", status: "entwurf", notiz: "Synthetic RC" };
async function api(path: string, body?: unknown, method = "POST", token?: string) {
  const response = await fetch(`${process.env.PB_URL}${path}`, { method, headers: { Authorization: token ?? await getAdminToken(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function member(f = firma, rolle = "eigentuemer") {
  const user = await createRecord<{ id: string }>("users", { email: `rc-${++serial}@synthetic.invalid`, password: "Synthetic-Test-Password-123", passwordConfirm: "Synthetic-Test-Password-123", role: "nutzer", firma: f });
  await createRecord("mitgliedschaften", { firma: f, user: user.id, rolle });
  return user.id;
}
async function draft(patch: Partial<RcInput> = {}, ordinary: Record<string, unknown> = {}) {
  return createRecord<Beleg>("belege", { firma, ...values, rc: { ...input, ...patch }, ...ordinary });
}
function close(b: Beleg, user = akteur, f = firma) { return api("/internal/zettelruhe/finanz/v1/beleg/festschreiben", { firma: f, akteur: user, id: b.id, expected: belegProjektion({ ...b, datei: b.datei || [], lieferant: b.lieferant || null, kunde: b.kunde || null, kategorie: b.kategorie || "", konto: b.konto || "" }) }); }
async function rows(col: string) { return (await listRecords<{ id: string }>(col, { filter: pbEq("firma", firma), perPage: 100 })).items; }
function projection(j: Record<string, unknown>) {
  const p: Record<string, unknown> = {};
  for (const k of ["firma", "quelle_typ", "quelle_id", "storno_von", "buchungsdatum", "belegdatum", "buchungstext", "richtung", "betrag_netto", "betrag_ust", "betrag_brutto", "steuersatz", "konto", "kontakt", "festgeschrieben_am", "rc_steuerdatum", "rc_vorgang"]) p[k] = j[k] || "";
  p.rc = j.rc; p.laufende_nr = j.laufende_nr; return p;
}
function cancel(j: Record<string, unknown>, art = "erfassungsfehler", nachweis = "Synthetic full correction") {
  return api("/internal/zettelruhe/finanz/v1/beleg/rc-stornieren", { firma, akteur, id: j.id, expected: projection(j), korrektur: { art, datum: "2026-04-02", nachweis } });
}
describe.skipIf(!isolated)("RC actual PocketBase hooks", () => {
  beforeAll(() => { expect(process.env.PB_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/); expect(process.env.PB_SUPERUSER_EMAIL).toBe("tp022@synthetic.invalid"); });
  beforeEach(async () => {
    firma = (await createRecord<{ id: string }>("firmen", { name: `RC synthetic ${++serial}`, steuermodus: "regelbesteuerung_ist", skr: "skr03", nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) })).id;
    akteur = await member();
  });
  afterEach(() => vi.restoreAllMocks());
  it("additive migration preserves pre-migration synthetic 19/7/0 invoices and journals", async () => {
    for (const rate of ["19", "7", "0"]) {
      const b = await getRecord<Beleg>("belege", "rclegacy" + rate.padStart(2, "0") + "00001");
      const j = await getRecord<Record<string, unknown>>("buchungsjournal", "rclegacy" + rate.padStart(2, "0") + "00002");
      expect(b).toMatchObject({ firma: "rcmigration0001", status: "festgeschrieben", betrag_netto: "100.00", betrag_ust: rate + ".00", betrag_brutto: String(100 + Number(rate)) + ".00", rc: null, rc_steuerdatum: "", rc_vorgang: "" });
      expect(j.betrag_brutto).toBe(b.betrag_brutto); expect(j.betrag_ust).toBe(b.betrag_ust); expect(j.rc).toBeNull(); expect(j.quelle_id).toBe(b.id); expect(j.steuersatz).toBe(rate);
    }
  });
  it("public release is enabled in the generated PocketBase hook", () => {
    expect(generated.RC_PUBLIC_ENABLED).toBe(true);
  });
  it("rechecks archived originals instead of trusting legacy EUR/ordinary DTOs", async () => {
    const source = readFileSync(new URL("../modules/einvoice/fixtures/xrechnung-minimal.xml", import.meta.url), "utf8");
    for (const [xml, error] of [
      [source.replaceAll("EUR", "USD"), /USD/],
      [source.replace(/<cbc:DocumentCurrencyCode>EUR<\/cbc:DocumentCurrencyCode>/, ""), /unbekannt/],
      [source.replace("</Invoice>", "<cbc:Note>reverse charge</cbc:Note></Invoice>"), /Reverse-Charge-Hinweis/],
    ] as const) {
      const inbox = await uploadERechnung(firma, new File([xml], "synthetic.xml", { type: "application/xml" }));
      expect(inbox.parse_status).toBe("ok");
      await updateRecord("e_rechnungen_empfang", inbox.id, { geparst_json: JSON.stringify({ ...inbox.geparst, waehrung: "EUR", rc_hinweis: false }) });
      await expect(createBelegFromERechnungSafe(firma, inbox.id)).rejects.toThrow(error);
      expect((await getRecord<{ status: string }>("e_rechnungen_empfang", inbox.id)).status).toBe("neu");
    }
    expect(await rows("belege")).toHaveLength(0);
  });
  it("ordinary 19/7/0 writes remain supported with absent classification", async () => {
    for (const rate of ["19", "7", "0"]) {
      const b = await draft({}, { rc: null, betrag_netto: "100.00", betrag_ust: rate + ".00", betrag_brutto: String(100 + Number(rate)) + ".00", steuersatz: rate });
      const result = await close(b); expect(result.status).toBe(200); expect(result.data.journal.betrag_ust).toBe(rate + ".00"); expect(result.data.journal.rc).toBeNull();
    }
  });
  describe.skipIf(!core)("isolated RC core release", () => {
    it("reports a closed RC receipt by tax date and exports its immutable snapshot", async () => {
      const b = await draft();
      await close(b);

      const january = { von: "2026-01-01", bis: "2026-01-31" };
      const march = { von: "2026-03-01", bis: "2026-03-31" };
      const { ust, ustva } = await getUstvaSeite(firma, january);
      expect(ust.reverse_charge).toMatchObject({
        grundlage_eu: "19.33",
        schuld_eu: "3.67",
        vorsteuer: "3.67",
      });
      expect(ust.zahllast).toBe("0.00");
      expect(ustva.kennzahlen.find((k) => k.kz === "46")?.eintrag).toBe("19");
      expect(ustva.kennzahlen.find((k) => k.kz === "47")?.eintrag).toBe("3.67");
      expect(ustva.kennzahlen.find((k) => k.kz === "67")?.eintrag).toBe("3.67");
      const xml = await exportUstvaXml(firma, january, { erstellungsdatum: "2026-02-01" });
      expect(xml.xml).toContain("<Kz46>19</Kz46>");
      expect(xml.xml).toContain("<Kz47>3.67</Kz47>");
      expect(xml.xml).toContain("<Kz67>3.67</Kz67>");

      const journal = await exportJournalCsv(firma, march);
      expect(journal.body).toContain("rc_snapshot_json");
      expect(journal.body).toContain("Synthetic evidence");
      await expect(exportDatevCsv(firma, march)).rejects.toThrow(/Journal-CSV-Export/);
      const archive = await exportBelegArchivZip(firma, {
        von: "2026-02-01",
        bis: "2026-02-28",
      });
      expect(new TextDecoder().decode(archive.bytes)).toContain("Synthetic evidence");

      await updateRecord("firmen", firma, { steuermodus: "kleinunternehmer" });
      const historical = await getUstvaSeite(firma, january);
      expect(historical.ust.reverse_charge.vorsteuer).toBe("3.67");
      expect(historical.ustva.kennzahlen.find((k) => k.kz === "67")?.eintrag).toBe("3.67");
    });

    it("reports KU-RC debt without opening ordinary input tax", async () => {
      await updateRecord("firmen", firma, { steuermodus: "kleinunternehmer" });
      const b = await draft({
        steuermodus: "kleinunternehmer",
        abzug: "ausgeschlossen",
      });
      await close(b);
      const { ust, ustva } = await getUstvaSeite(firma, {
        von: "2026-01-01",
        bis: "2026-01-31",
      });
      expect(ust.verfuegbar).toBe(true);
      expect(ust.summe_vorsteuer).toBe("0.00");
      expect(ust.reverse_charge.vorsteuer).toBe("0.00");
      expect(ust.zahllast).toBe("3.67");
      expect(ustva.kennzahlen.find((k) => k.kz === "66")?.eintrag).toBe("0.00");
      expect(ustva.kennzahlen.find((k) => k.kz === "67")?.eintrag).toBe("0.00");
    });
    for (const tatbestand of ["eu_dienstleistung", "drittland_dienstleistung"] as const) for (const steuermodus of ["regelbesteuerung_ist", "kleinunternehmer"] as const) for (const abzug of ["voll", "ausgeschlossen"] as const) it(`${tatbestand}/${steuermodus}/${abzug} snapshot and replay`, async () => {
      await updateRecord("firmen", firma, { steuermodus });
      const b = await draft({ tatbestand, steuermodus, abzug });
      const result = await close(b); expect(result.status).toBe(200);
      const snapshot = result.data.journal.rc as RcSnapshot;
      expect(snapshot).toMatchObject({ schuld: "3.67", vorsteuer: steuermodus === "regelbesteuerung_ist" && abzug === "voll" ? "3.67" : "0.00", steuerdatum: tatbestand === "eu_dienstleistung" ? "2026-01-31" : "2026-02-03" });
      expect(result.data.beleg.rc).toEqual(snapshot); expect(result.data.journal.rc_steuerdatum).toBe(snapshot.steuerdatum);
      expect(result.data.journal.betrag_ust).toBe("0.00"); expect(result.data.journal.betrag_brutto).toBe("19.33");
      const replay = await close(b); expect(replay.data.result).toBe("replayed"); expect(replay.data.journal).toEqual(result.data.journal);
      expect((await getBeleg(firma, b.id))?.rc).toEqual(snapshot);
    });
    it.each(["unbezahlt", "teilbezahlt"] as const)("blocks %s without committing", async zahlungsstatus => {
      const b = await draft({ zahlungsstatus }); const before = await getRecord("firmen", firma);
      const result = await close(b); expect(result.status).toBe(400); expect(result.data.data.finanz.message).toContain("separat");
      expect(await rows("buchungsjournal")).toHaveLength(0); expect(await getRecord("firmen", firma)).toEqual(before); expect((await getRecord<Beleg>("belege", b.id)).status).toBe("entwurf");
    });
    it("keeps full advance in the outflow period and refuses a second final invoice for the same service", async () => {
      const a = await draft({ zahlungsdatum: "2026-01-10" }, { buchungsdatum: "2026-01-10" });
      const result = await close(a); expect(result.status).toBe(200); expect(result.data.journal.rc.steuerdatum).toBe("2026-01-10");
      const b = await draft(); const duplicate = await close(b); expect(duplicate.data.data.finanz.code).toBe("RC_DUPLICATE"); expect(await rows("buchungsjournal")).toHaveLength(1);
    });
    it("serializes same-source and distinct-source concurrency", async () => {
      const a = await draft(); const b = await draft();
      const same = await Promise.all([close(a), close(a)]); expect(same.map(r => r.data.result).sort()).toEqual(["committed", "replayed"]);
      expect((await close(b)).data.data.finanz.code).toBe("RC_DUPLICATE"); expect(await rows("buchungsjournal")).toHaveLength(1);
    });
    it("roundtrips RC through the actual Next repositories, including multipart draft and correction", async () => {
      vi.spyOn(rcDomain, "assertRcFreigegeben").mockImplementation(() => {});
      const ordinary = { ...values, richtung: "ausgabe" as const, steuersatz: "0" as const, rc: input };
      const b = await createBeleg(firma, ordinary, { datei: new File(["%PDF-1.4\nsynthetic\n%%EOF"], "synthetic.pdf", { type: "application/pdf" }) });
      expect(b.rc).toEqual(input);
      const saved = await updateBeleg(firma, b.id, { ...ordinary, rc: { ...input, satz: "7" } }, { akteur });
      expect(saved.rc?.satz).toBe("7");
      const result = await festschreibenBeleg(firma, b.id, { akteur });
      expect(result.journal.rc?.schuld).toBe("1.35");
      expect((await festschreibenBeleg(firma, b.id, { akteur })).quittung.result).toBe("replayed");
      const realFetch = globalThis.fetch; let lost = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const response = await realFetch(url, init);
        if (String(url).endsWith("/beleg/rc-stornieren") && !lost) { lost = true; expect(response.ok).toBe(true); throw new Error("Lost correction receipt"); }
        return response;
      });
      const reversal = await storniereBuchung(firma, result.journal.id, { akteur, rc_korrektur: { art: "erfassungsfehler", datum: "2026-04-02", nachweis: "Synthetic capture correction" } });
      expect(reversal.rc?.schuld).toBe("-1.35");
      expect(lost).toBe(true);
      expect(await rows("buchungsjournal")).toHaveLength(2);
    });
    it("closes a saved, fully paid single-payment RC form draft", async () => {
      vi.spyOn(rcDomain, "assertRcFreigegeben").mockImplementation(() => {});
      const form = new FormData();
      Object.entries({
        belegdatum: "2026-09-08",
        buchungsdatum: "2026-09-08",
        richtung: "ausgabe",
        betrag_netto: "42,00",
        betrag_ust: "",
        betrag_brutto: "",
        steuersatz: "0",
        steuerbehandlung: "eu_dienstleistung",
      }).forEach(([key, value]) => form.set(key, value));
      Object.entries({
        ...input,
        zahlungsdatum: "2026-09-08",
        zahlungsbetrag: "42,00",
        vorgang: "supplier/contract/september",
        leistung_von: "2026-09-01",
        leistung_bis: "2026-09-30",
      }).filter(([key]) => !["version", "tatbestand"].includes(key)).forEach(([key, value]) => {
        form.set(`rc_${key}`, typeof value === "boolean" ? (value ? "on" : "false") : String(value));
      });

      const draft = await createBeleg(firma, parseBelegForm(form));
      const saved = await updateBeleg(firma, draft.id, parseBelegForm(form), { akteur });
      expect(saved).toMatchObject({
        betrag_netto: "42.00",
        betrag_ust: "0.00",
        betrag_brutto: "42.00",
        buchungsdatum: "2026-09-08",
        rc: {
          zahlungsstatus: "bezahlt",
          zahlungsbetrag: "42.00",
          eine_zahlung: true,
        },
      });

      await expect(festschreibenBeleg(firma, saved.id, { akteur })).resolves.toMatchObject({
        beleg: { status: "festgeschrieben" },
      });
    });
    it("rejects a stale classification after an explicit removal and an old writer omitting RC", async () => {
      const b = await draft();
      const loaded = (await getBeleg(firma, b.id))!;
      const expected = belegProjektion(loaded);
      const edit = async (projection: Record<string, unknown>, values: Record<string, unknown>) => {
        const body = new FormData(); body.set("payload", JSON.stringify({ firma, akteur, id: b.id, expected: projection, values }));
        return fetch(`${process.env.PB_URL}/internal/zettelruhe/finanz/v1/beleg/entwurf`, { method: "POST", headers: { Authorization: await getAdminToken() }, body });
      };
      const old = { ...expected }; delete old.rc;
      expect((await edit(old, { notiz: "Old writer" })).status).toBe(400);
      expect((await edit(expected, { rc: null })).status).toBe(200);
      expect((await close(b)).data.data.finanz.code).toBe("SOURCE_CHANGED");
      expect(await rows("buchungsjournal")).toHaveLength(0);
    });
    it("prevents concurrent duplicate service closures across distinct receipts", async () => {
      const a = await draft(); const b = await draft();
      const results = await Promise.all([close(a), close(b)]);
      expect(results.map(r => r.status).sort()).toEqual([200, 400]);
      expect(await rows("buchungsjournal")).toHaveLength(1);
    });
    it("contact proposal migration preserves manual override, draft and closed snapshot", async () => {
      vi.spyOn(rcDomain, "assertRcFreigegeben").mockImplementation(() => {});
      const supplier = await createKontakt(firma, { name: "Synthetic contact proposal", ist_lieferant: true, ist_kunde: false, land: "IE", ust_id: "DE123456789", ausgaben_steuerstandard: "eu_dienstleistung" });
      expect(supplier.ausgaben_steuerstandard).toBe("eu_dienstleistung");
      const f = new FormData();
      Object.entries(values).forEach(([k, v]) => f.set(k, v)); f.set("steuerbehandlung", "eu_dienstleistung"); f.set("lieferant", supplier.id);
      Object.entries(input).filter(([k]) => !["version", "tatbestand"].includes(k)).forEach(([k,v]) => f.set("rc_" + k, String(v)));
      const b = await createBeleg(firma, parseBelegForm(f));
      await updateKontakt(firma, supplier.id, { ...supplier, ausgaben_steuerstandard: "drittland_dienstleistung", land: "US" });
      expect((await getBeleg(firma, b.id))?.rc).toEqual(input);
      const closed = await festschreibenBeleg(firma, b.id, { akteur });
      await updateKontakt(firma, supplier.id, { ...supplier, ausgaben_steuerstandard: "bisherig" });
      expect((await getBeleg(firma, b.id))?.rc).toEqual(closed.journal.rc);
      for (const k of [...f.keys()]) if (k.startsWith("rc_")) f.delete(k);
      f.set("steuerbehandlung", "bisherig"); f.set("steuersatz", "19"); f.set("betrag_netto", "100"); f.set("betrag_ust", "19"); f.set("betrag_brutto", "119");
      const ordinary = await createBeleg(firma, parseBelegForm(f));
      expect(ordinary.rc).toBeUndefined();
      expect((await festschreibenBeleg(firma, ordinary.id, { akteur })).journal.betrag_ust).toBe("19.00");
    });
    it("retains the snapshot after supplier changes", async () => {
      const supplier = await createRecord<{ id: string }>("kontakte", { firma, name: "Synthetic Supplier", ist_lieferant: true, land: "IE" });
      const b = await draft({}, { lieferant: supplier.id });
      const first = await close(b); expect(first.status).toBe(200);
      await updateRecord("kontakte", supplier.id, { name: "Changed supplier", land: "US" });
      expect((await close(b)).data.journal.rc).toEqual(first.data.journal.rc);
    });
    it.each([{ eine_zahlung: false }, { zahlungsbetrag: "19.32" }, { bereits_erklaert: true }])("rejects unsupported settlement %j in real hooks", async patch => {
      const b = await draft(patch); expect((await close(b)).status).toBe(400); expect(await rows("buchungsjournal")).toHaveLength(0);
    });
    it("allows a corrected capture only after error reversal, without erasing the old snapshot", async () => {
      const a = await draft(); const first = await close(a);
      expect((await cancel(first.data.journal)).status).toBe(200);
      const b = await draft({ satz: "7" });
      const corrected = await close(b); expect(corrected.status).toBe(200); expect(corrected.data.journal.rc.schuld).toBe("1.35");
      expect((await getRecord<{ rc: RcSnapshot }>("buchungsjournal", first.data.journal.id)).rc.schuld).toBe("3.67");
    });
    it("detects source edit and company mode race; later mode changes preserve snapshot", async () => {
      const a = await draft();
      await updateRecord("firmen", firma, { steuermodus: "kleinunternehmer" });
      expect((await close(a)).data.data.finanz.code).toBe("RC_MODE_CHANGED");
      await updateRecord("firmen", firma, { steuermodus: "regelbesteuerung_ist" });
      const stale = { ...a, rc: { ...input, satz: "7" as const } };
      expect((await close(stale)).data.data.finanz.code).toBe("SOURCE_CHANGED");
      const first = await close(a); await updateRecord("firmen", firma, { steuermodus: "kleinunternehmer" });
      expect((await close(a)).data.journal).toEqual(first.data.journal);
    });
    for (const failure of ["fail-journal-create", "fail-after-journal", "fail-source-save"]) it(`rolls back ${failure}`, async () => {
      const b = await draft({}, { notiz: failure }); const before = await getRecord("firmen", firma);
      expect((await close(b)).status).toBe(400); expect(await rows("buchungsjournal")).toHaveLength(0);
      expect(await getRecord("firmen", firma)).toEqual(before); expect(await getRecord<Beleg>("belege", b.id)).toMatchObject({ rc: input, status: "entwurf", rc_steuerdatum: "" });
    });
    it("retries a lost response without another tax posting", async () => {
      const b = await draft(); const real = globalThis.fetch; let lost = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => { const response = await real(url, init); if (String(url).endsWith('/beleg/festschreiben') && !lost) { lost = true; expect(response.ok).toBe(true); throw new Error("response lost"); } return response; });
      const loaded = (await getBeleg(firma, b.id))!;
      expect((await belegFestschreiben({ firma, akteur, id: b.id, expected: belegProjektion(loaded) })).result).toBe("replayed"); expect(await rows("buchungsjournal")).toHaveLength(1);
    });
    it("blocks direct or partial tax writes and freezes completed snapshots", async () => {
      const forged = await api("/api/collections/belege/records", { firma, ...values, rc: { ...input, schuld: "0.00" } }); expect(forged.status).toBe(400);
      const partial = await api("/api/collections/belege/records", { firma, ...values, rc_steuerdatum: "2026-01-31" }); expect(partial.status).toBe(400);
      const b = await draft(); const result = await close(b); const j = result.data.journal;
      await expect(updateRecord("belege", b.id, { rc: null })).rejects.toThrow();
      await expect(updateRecord("buchungsjournal", j.id, { rc: null })).rejects.toThrow();
      await expect(deleteRecord("buchungsjournal", j.id)).rejects.toThrow();
      const direct = { ...j }; delete direct.id; delete direct.collectionId; delete direct.collectionName;
      expect((await api("/api/collections/buchungsjournal/records", direct)).status).toBe(400);
      expect((await api("/api/collections/buchungsjournal/records", { ...direct, quelle_typ: "storno", storno_von: j.id, quelle_id: j.id, rc: null })).status).toBe(400);
    });
    it("isolates firms, read members and ordinary tokens", async () => {
      const b = await draft(); const reader = await member(firma, "lesen"); expect((await close(b, reader)).status).toBe(400);
      const other = (await createRecord<{ id: string }>("firmen", { name: `Other synthetic ${++serial}`, steuermodus: "regelbesteuerung_ist", skr: "skr03", nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) })).id;
      const otherUser = await member(other); expect((await close(b, otherUser, other)).status).toBe(400);
      const user = await getRecord<{ email: string }>("users", akteur);
      const login = await api("/api/collections/users/auth-with-password", { identity: user.email, password: "Synthetic-Test-Password-123" });
      expect((await api("/internal/zettelruhe/finanz/v1/beleg/festschreiben", {}, "POST", login.data.token)).status).toBe(403);
      expect((await api("/api/collections/belege/records", { firma, ...values, rc: input }, "POST", login.data.token)).status).toBe(403);
    });
    it.each(["erfassungsfehler", "vollstaendige_rueckzahlung"])("atomic correction %s and immutable original", async art => {
      const b = await draft(); const first = await close(b); const j = first.data.journal;
      await updateRecord("firmen", firma, { steuermodus: "kleinunternehmer" });
      const results = await Promise.all([cancel(j, art), cancel(j, art)]);
      expect(results.map(r => r.data.result).sort()).toEqual(["committed", "replayed"]);
      expect(results[0].data.journal.rc).toMatchObject({ schuld: "-3.67", vorsteuer: "-3.67", steuerdatum: art === "erfassungsfehler" ? "2026-01-31" : "2026-04-02", steuermodus: "regelbesteuerung_ist" });
      expect(await getRecord("buchungsjournal", String(j.id))).toEqual(j);
      expect((await cancel(j, art, "Different correction")).status).toBe(400);
      expect(await rows("buchungsjournal")).toHaveLength(2);
    });
    it("refuses replay of a tampered incomplete source snapshot", async () => {
      const b = await draft(); const first = await close(b);
      const corrupt = { ...first.data.beleg.rc, schuld: "0.01" };
      expect((await api(`/internal/rc-test/${b.id}/seed`, { rc: corrupt })).status).toBe(200);
      expect((await close(b)).data.data.finanz.code).toBe("INCONSISTENT_STATE");
      expect((await getRecord<{ rc: RcSnapshot }>("buchungsjournal", first.data.journal.id)).rc.schuld).toBe("3.67");
    });
    it("rolls back a correction after journal insertion", async () => {
      const b = await draft(); const j = (await close(b)).data.journal;
      expect((await cancel(j, "erfassungsfehler", "fail-after-journal")).status).toBe(400);
      expect(await rows("buchungsjournal")).toHaveLength(1); expect((await cancel(j)).status).toBe(200);
    });
  });
});
