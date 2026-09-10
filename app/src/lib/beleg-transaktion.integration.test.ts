/** TP-022 acceptance against actual production hooks, PB 0.39.10 and disposable tmpfs. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecord, getRecord, getAdminToken, listRecords, pbEq, DEFAULT_NUMMERNKREISE, getFirmaById, updateRecord, deleteRecord, updateRecordMultipart, fetchRecordFile, allocateAngebotsnummer, allocateRechnungsnummer, allocateKontaktnummer } from "./pb";
import { createBeleg, festschreibenBeleg, getBeleg, updateBeleg, addBelegDateien, deleteBeleg, removeBelegDatei } from "@/modules/expenses/repository";
import { belegFestschreiben, belegProjektion, belegEntwurfSchreiben, nummernkreiseKonfigurieren } from "./finanz-transaktion";
import { festschreibenBuchung, storniereBuchung } from "@/modules/journal/repository";
import type { Beleg } from "@/modules/expenses/types";
const isolated = process.env.TP022_BELEG_ISOLATED === "1";
const date = "2026-09-05";
const input = { belegdatum: date, richtung: "ausgabe" as const, betrag_netto: "100.00", betrag_ust: "0.00", betrag_brutto: "100.00", steuersatz: "0" as const, notiz: "Synthetic receipt" };
const realFetch = globalThis.fetch;
let firma: string;
let akteur: string;
let serial = 0;
async function rows(col: string, f = firma) {
  return (await listRecords<{ id: string; [key: string]: unknown }>(col, { filter: pbEq("firma", f), perPage: 200, sort: "id" })).items;
}
async function state() { return { firma: await getFirmaById(firma), belege: await rows("belege"), journal: await rows("buchungsjournal") }; }
async function company(name = "TP022 synthetic") {
  return (await createRecord<{ id: string }>("firmen", { name: `${name} ${++serial}`, steuermodus: "kleinunternehmer", skr: "skr03", nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) })).id;
}
async function member(f = firma, rolle = "eigentuemer") {
  const user = await createRecord<{ id: string }>("users", { email: `tp022-${++serial}@synthetic.invalid`, password: "Synthetic-Test-Password-123", passwordConfirm: "Synthetic-Test-Password-123", role: "nutzer", firma: f });
  await createRecord("mitgliedschaften", { firma: f, user: user.id, rolle });
  return user.id;
}
async function draft(notiz = input.notiz, datei?: File) { return createBeleg(firma, { ...input, notiz }, { datei }); }
function close(b: Beleg) { return festschreibenBeleg(firma, b.id, { akteur }); }
function args(b: Beleg) { return { firma, akteur, id: b.id, expected: belegProjektion(b) }; }
async function internal(path: string, method = "POST", body?: unknown, token?: string) {
  return realFetch(`${process.env.PB_URL}/internal/${path}`, { method, headers: { Authorization: token ?? await getAdminToken(), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
function pdf() { return new File(["%PDF-1.4\nsynthetic\n%%EOF"], "synthetic.pdf", { type: "application/pdf" }); }

describe.skipIf(!isolated)("TP-022 Beleg acceptance", () => {
  beforeAll(async () => {
    expect(process.env.PB_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(process.env.PB_SUPERUSER_EMAIL).toBe("tp022@synthetic.invalid");
    expect((await internal("tp022/audit", "GET")).status).toBe(200);
  });
  beforeEach(async () => {
    firma = await company(); akteur = await member(); });
  afterEach(() => vi.restoreAllMocks());

  it("commits number, matching journal and receipt together; replay returns identical receipt", async () => {
    const b = await draft();
    const first = await close(b);
    const next = await close(b);
    expect(first.quittung.result).toBe("committed");
    expect(next.quittung).toEqual({ ...first.quittung, result: "replayed" });
    expect(first.beleg.status).toBe("festgeschrieben");
    expect(first.beleg.belegnummer).toBe("B-0001");
    expect(first.journal.id).toBe(first.beleg.journal_eintrag);
    expect(first.journal.festgeschrieben_am).toBe(first.beleg.festgeschrieben_am);
    expect(await rows("buchungsjournal")).toHaveLength(1);
    expect((await getFirmaById(firma))!.nummernkreise.beleg.next).toBe(2);
  });
  for (const failure of ["fail-counter", "fail-journal-create", "fail-after-journal", "fail-source-save"]) {
    it(`${failure}: every DB write rolls back, including retry`, async () => {
      const b = await draft(failure);
      // The counter failure is activated at creation, since its update hook itself rolls back name changes.
      if (failure === "fail-counter") {
        firma = (await createRecord<{ id: string }>("firmen", { name: "TP022-fail-counter", steuermodus: "kleinunternehmer", skr: "skr03", nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE) })).id;
        akteur = await member();
      }
      const target = failure === "fail-counter" ? await draft() : b;
      const before = await state();
      const injections: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const r = await realFetch(url, init);
        if (String(url).endsWith('/beleg/festschreiben')) {
          const payload = await r.clone().json();
          if (payload.data?.injection?.code === 'TEST_FAILURE') {
            injections.push(payload.data.injection.message.replace(/\.$/, ""));
          }
        }
        return r;
      });
      await expect(close(target)).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
      expect(await state()).toEqual(before);
      const marker = { 'fail-counter': 'INJECT_AFTER_COUNTER', 'fail-journal-create': 'INJECT_JOURNAL_CREATE', 'fail-after-journal': 'INJECT_AFTER_JOURNAL', 'fail-source-save': 'INJECT_SOURCE_SAVE' }[failure];
      expect(injections).toEqual([marker, marker]);
    });
  }
  it("lost successful response replays the exact same source, one journal and one counter increment", async () => {
    const b = await draft(); let lost = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const response = await realFetch(url, init);
      if (String(url).endsWith("/beleg/festschreiben") && !lost) { lost = true; expect(response.ok).toBe(true); await response.text(); throw new Error("lost response"); }
      return response;
    });
    const result = await close(b);
    expect(result.quittung.result).toBe("replayed");
    expect(await rows("buchungsjournal")).toHaveLength(1);
    expect((await getFirmaById(firma))!.nummernkreise.beleg.next).toBe(2);
  });
  it("two parallel closes of the same source produce one commit and one replay", async () => {
    const b = await draft();
    const result = await Promise.all([close(b), close(b)]);
    expect(result.map(r => r.quittung.result).sort()).toEqual(["committed", "replayed"]);
    expect(result[0].quittung.journalId).toBe(result[1].quittung.journalId);
    expect(await rows("buchungsjournal")).toHaveLength(1);
  });
  it("different sources and concurrent legacy number allocators preserve all counters", async () => {
    const a = await draft(); const b = await draft();
    const [x, y, offer, invoice, contact] = await Promise.all([close(a), close(b), allocateAngebotsnummer(firma), allocateRechnungsnummer(firma), allocateKontaktnummer(firma)]);
    expect([x.beleg.belegnummer, y.beleg.belegnummer].sort()).toEqual(["B-0001", "B-0002"]);
    expect([offer, invoice, contact]).toEqual(["A-0001", "R-0001", "KT-0001"]);
    const nk = (await getFirmaById(firma))!.nummernkreise;
    expect([nk.beleg.next, nk.angebot.next, nk.rechnung.next, nk.kontakt.next, nk.kasse.next]).toEqual([3, 2, 2, 2, 1]);
  });
  it("skips occupied numbers and preserves unrelated/custom JSON keys", async () => {
    firma = (await createRecord<{ id: string }>("firmen", { name: `Custom ${++serial}`, steuermodus: "kleinunternehmer", skr: "skr03", nummernkreise: { ...DEFAULT_NUMMERNKREISE, custom: { untouched: true } } })).id;
    akteur = await member();
    const occupied = await draft();
    expect((await internal(`tp022/legacy/${occupied.id}/occupied-number`)).ok).toBe(true);
    const b = await draft();
    expect((await close(b)).beleg.belegnummer).toBe("B-0002");
    const raw = await getRecord<{ nummernkreise: Record<string, unknown> }>("firmen", firma);
    expect(raw.nummernkreise.custom).toEqual({ untouched: true });
    expect(raw.nummernkreise.rechnung).toEqual(DEFAULT_NUMMERNKREISE.rechnung);
  });
  it("concurrent settings of separate circles preserve each other's changes", async () => {
    const b = await draft();
    await Promise.all([
      nummernkreiseKonfigurieren(firma, akteur, { angebot: { expected: DEFAULT_NUMMERNKREISE.angebot, value: { prefix: "ANG-", digits: 5, next: 10 } } }),
      nummernkreiseKonfigurieren(firma, akteur, { kontakt: { expected: DEFAULT_NUMMERNKREISE.kontakt, value: { prefix: "KON-", digits: 6, next: 20 } } }),
      close(b),
    ]);
    const nk = (await getFirmaById(firma))!.nummernkreise;
    expect([nk.angebot.next, nk.kontakt.next, nk.beleg.next]).toEqual([10, 20, 2]);
    await expect(nummernkreiseKonfigurieren(firma, akteur, { beleg: { expected: DEFAULT_NUMMERNKREISE.beleg, value: { prefix: "NEW-", digits: 4, next: 10 } } })).rejects.toMatchObject({ code: "NUMBER_CHANGED" });
  });
  it("general company CRUD rejects full JSON replacement and preserves counters for ordinary edits", async () => {
    const b = await draft(); await close(b);
    await expect(updateRecord("firmen", firma, { nummernkreise: DEFAULT_NUMMERNKREISE })).rejects.toThrow();
    await Promise.all([updateRecord("firmen", firma, { ort: "Synthetic" }), close(await draft())]);
    expect((await getFirmaById(firma))!.nummernkreise.beleg.next).toBe(3);
  });
  it("changed projection is rejected without consuming a number", async () => {
    const b = await draft();
    await updateBeleg(firma, b.id, { ...input, notiz: "Updated" }, { akteur });
    await expect(belegFestschreiben(args(b))).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(await rows("buchungsjournal")).toHaveLength(0);
    expect((await getFirmaById(firma))!.nummernkreise.beleg.next).toBe(1);
  });
  it.each(["update", "delete", "file"] as const)("stale %s after finalization is rejected at PB boundary", async operation => {
    const b = await draft(); const before = args(b);
    await close(b); const closed = await state();
    await expect(belegEntwurfSchreiben({ ...before, ...(operation === "delete" ? { operation: "delete" as const } : operation === "update" ? { values: { notiz: "late" } } : {}) }, operation === "file" ? [pdf()] : [])).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
    expect(await state()).toEqual(closed);
  });
  it.each(["update", "delete", "file"] as const)("parallel %s versus finalization cannot leave a mixed state", async operation => {
    const b = await draft(); const snapshot = args(b);
    const mutations = { update: () => belegEntwurfSchreiben({ ...snapshot, values: { notiz: "changed" } }), delete: () => belegEntwurfSchreiben({ ...snapshot, operation: "delete" }), file: () => belegEntwurfSchreiben(snapshot, [pdf()]) };
    const results = await Promise.allSettled([belegFestschreiben(snapshot), mutations[operation]()]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const s = await state();
    if (s.journal.length) { expect(s.belege[0].status).toBe("festgeschrieben"); expect(s.belege[0].notiz).toBe(input.notiz); expect(s.belege[0].datei).toEqual([]); }
    else { expect(s.firma!.nummernkreise.beleg.next).toBe(1); }
  });
  it("metadata and uploads save together; invalid upload rolls back metadata", async () => {
    const b = await draft();
    const invalid = new File(["invalid content"], "invalid.pdf", { type: "application/pdf" });
    await expect(updateBeleg(firma, b.id, { ...input, notiz: "must roll back" }, { akteur, dateien: [invalid] })).rejects.toThrow();
    expect((await getBeleg(firma, b.id))!.notiz).toBe(input.notiz);
    const saved = await updateBeleg(firma, b.id, { ...input, notiz: "with file" }, { akteur, dateien: [pdf()] });
    expect(saved.datei).toHaveLength(1);
    expect(saved.notiz).toBe("with file");
    await removeBelegDatei(firma, b.id, saved.datei[0], { akteur });
    expect((await getBeleg(firma, b.id))!.datei).toHaveLength(0);
  });
  for (const mode of ["orphan", "linked", "number-only"]) {
    it(`legacy ${mode} is a consistency error, without repairs`, async () => {
      const b = await draft(); expect((await internal(`tp022/legacy/${b.id}/${mode}`)).ok).toBe(true);
      const before = await state();
      await expect(belegFestschreiben(args(b))).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
      expect(await state()).toEqual(before);
    });
  }
  it("synthetic read-only audit finds duplicate originals and would block a unique migration", async () => {
    const b = await draft(); await internal(`tp022/legacy/${b.id}/orphan`); await internal(`tp022/legacy/${b.id}/duplicate`);
    const before = await state();
    const result = await internal("tp022/audit", "GET");
    expect(await result.json()).toContainEqual({ firma, quelle_typ: "beleg", quelle_id: b.id, anzahl: 2 });
    expect(await state()).toEqual(before);
    await expect(belegFestschreiben(args(b))).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
  });
  it("wrong company, read role, deleted actor and revoked membership cannot commit", async () => {
    const b = await draft(); const other = await company();
    await expect(belegFestschreiben({ ...args(b), firma: other })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const reader = await member(firma, "lesen");
    await expect(belegFestschreiben({ ...args(b), akteur: reader })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const memberships = await rows("mitgliedschaften");
    await deleteRecord("mitgliedschaften", memberships.find(m => m.user === akteur)!.id);
    await expect(belegFestschreiben(args(b))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteRecord("users", akteur);
    await expect(belegFestschreiben(args(b))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await rows("buchungsjournal")).toHaveLength(0);
  });
  it("partner still belongs to company and category direction is checked at commit", async () => {
    const contact = await createRecord<{ id: string }>("kontakte", { firma, name: "Supplier" });
    const b = await createBeleg(firma, { ...input, lieferant: contact.id, kategorie: "Service" });
    await updateRecord("kontakte", contact.id, { firma: await company() });
    await expect(close(b)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateRecord("kontakte", contact.id, { firma });
    await createRecord("kategorien", { firma, name: "Service", richtung: "einnahme" });
    await expect(close(b)).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  });
  it("direct unauthenticated and ordinary-user calls cannot access the internal route", async () => {
    const b = await draft();
    const response = await internal("zettelruhe/finanz/v1/beleg/festschreiben", "POST", args(b), "");
    expect([401, 403]).toContain(response.status);
    const login = await realFetch(`${process.env.PB_URL}/api/collections/users/auth-with-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity: (await getRecord<{ email: string }>("users", akteur)).email, password: "Synthetic-Test-Password-123" }) });
    const token = (await login.json()).token;
    expect(token).toBeTruthy();
    expect([401, 403]).toContain((await internal("zettelruhe/finanz/v1/beleg/festschreiben", "POST", args(b), token)).status);
  });
  it("file protection and immutable fields survive direct generic writes and relation cascades", async () => {
    const contact = await createRecord<{ id: string }>("kontakte", { firma, name: "Supplier" });
    const b = await createBeleg(firma, { ...input, lieferant: contact.id }, { datei: pdf() });
    const done = await close(b); const before = await state();
    const file = b.datei[0];
    const anonymous = await realFetch(`${process.env.PB_URL}/api/files/belege/${b.id}/${file}`);
    expect(anonymous.ok).toBe(false);
    expect(await fetchRecordFile("belege", b.id, file)).toBeTruthy();
    await expect(updateRecord("belege", b.id, { notiz: "changed", skipGuard: true })).rejects.toThrow();
    await expect(updateRecordMultipart("belege", b.id, { datei: "" })).rejects.toThrow();
    await expect(deleteRecord("belege", b.id)).rejects.toThrow();
    await expect(deleteRecord("kontakte", contact.id)).rejects.toThrow();
    await expect(deleteRecord("firmen", firma)).rejects.toThrow();
    await expect(deleteRecord("buchungsjournal", done.journal.id)).rejects.toThrow();
    await expect(updateRecord("buchungsjournal", done.journal.id, { betrag_brutto: "5.00" })).rejects.toThrow();
    expect(await state()).toEqual(before);
  });
  it("draft repository paths remain usable and reject closed mutations", async () => {
    const b = await draft(); await addBelegDateien(firma, b.id, [pdf()], { akteur });
    await close((await getBeleg(firma, b.id))!);
    await expect(updateBeleg(firma, b.id, input, { akteur })).rejects.toThrow();
    await expect(addBelegDateien(firma, b.id, [pdf()], { akteur })).rejects.toThrow();
    await expect(deleteBeleg(firma, b.id, { akteur })).rejects.toThrow();
    const deletable = await draft(); await deleteBeleg(firma, deletable.id, { akteur });
    expect(await getBeleg(firma, deletable.id)).toBeNull();
  });
  it("parallel ordinary journals retain separate rows and unique running numbers", async () => {
    const j = { ...input, buchungsdatum: date, buchungstext: "Synthetic ordinary entry", richtung: "einnahme" as const, quelle_typ: "manuell" as const, quelle_id: "" };
    const [a, b] = await Promise.all([festschreibenBuchung(firma, j), festschreibenBuchung(firma, j), close(await draft())]);
    expect(a.laufende_nr).not.toBe(b.laufende_nr);
    await storniereBuchung(firma, a.id);
    expect(await rows("buchungsjournal")).toHaveLength(4);
  });
});
