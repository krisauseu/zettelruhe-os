/**
 * TP-022 characterization tests, NOT proof that the current behavior is safe.
 * Run only via scripts/test-festschreibung-isolated.mjs (PB 0.39.10, empty tmpfs).
 * Real repositories, HTTP, constraints and PDF; only failures/timing are injected.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allocateBelegnummer, allocateRechnungsnummer, createRecord, DEFAULT_NUMMERNKREISE,
  fetchRecordFile, getAdminToken, getFirmaById, listRecords, pbEq, updateRecord,
} from "./pb";
import { createRechnung, festschreibenRechnung } from "@/modules/sales/repository";
import * as pdf from "@/modules/sales/pdf";
import { createBeleg, festschreibenBeleg } from "@/modules/expenses/repository";
import { festschreibenKassenbuchEintrag, getKassenSaldo } from "@/modules/cash/repository";
import { festschreibenBuchung } from "@/modules/journal/repository";

type Row = { id: string; firma: string; [key: string]: unknown };
type Kind = "rechnung" | "beleg" | "kasse";
type Request = { url: URL; method: string; init?: RequestInit };
type Interceptor = (request: Request, forward: () => Promise<Response>) => Promise<Response>;
const realFetch = globalThis.fetch;
const openCashInvariant = it;
const date = "2026-09-05";
const amounts = { betrag_netto: "100.00", betrag_ust: "0.00", betrag_brutto: "100.00", steuersatz: "0" as const };
const cashInput = { datum: date, richtung: "einnahme" as const, text: "TP-022 synthetisch", ...amounts };
const journalInput = { buchungsdatum: date, buchungstext: "TP-022 synthetisch", richtung: "einnahme" as const, quelle_typ: "manuell" as const, ...amounts };
const collections = ["rechnungen", "rechnungspositionen", "belege", "kassenbuch_eintraege", "buchungsjournal"] as const;
const collection = { rechnung: "rechnungen", beleg: "belege", kasse: "kassenbuch_eintraege" };
let firma: string;
let serial = 0;
let cashSerial = 0;
let intercept: Interceptor;
const akteure = new Map<string, string>();

function isRequest(r: Request, method: string, col: string) {
  return r.method === method && r.url.pathname.startsWith(`/api/collections/${col}/records`);
}

function latch() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

// Bounded waits fail visibly if a code change removes the tested boundary.
async function bounded(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("TP-022 barrier timeout")), 4000);
    })]);
  } finally { clearTimeout(timer); }
}

function barrier(match: (r: Request) => boolean): Interceptor {
  const both = latch();
  let count = 0;
  return async (r, forward) => {
    const response = await forward();
    if (match(r) && ++count <= 2) {
      if (count === 2) both.release();
      await bounded(both.promise);
    }
    return response;
  };
}

function failOnce(method: string, col: string, afterCommit = false) {
  let used = false;
  intercept = async (r, forward) => {
    if (!used && isRequest(r, method, col)) {
      used = true;
      if (afterCommit) {
        const response = await forward();
        expect(response.ok).toBe(true);
        await response.arrayBuffer();
        throw new Error("TP-022 response lost after commit");
      }
      return Response.json({ message: "TP-022 injected write failure" }, { status: 503 });
    }
    return forward();
  };
}

function failFinanceRequests(kind: "rechnung" | "beleg", count: number) {
  intercept = async (request, forward) => {
    if (
      count > 0 &&
      request.method === "POST" &&
      request.url.pathname.endsWith(`/${kind}/festschreiben`)
    ) {
      count -= 1;
      return Response.json({ message: "TP-022 injected finance failure" }, { status: 503 });
    }
    return forward();
  };
}

function loseFinanceResponseOnce(kind: "rechnung" | "beleg" | "kasse") {
  let used = false;
  intercept = async (request, forward) => {
    const response = await forward();
    if (
      !used &&
      request.method === "POST" &&
      request.url.pathname.endsWith(`/${kind}/festschreiben`)
    ) {
      used = true;
      expect(response.ok).toBe(true);
      await response.arrayBuffer();
      throw new Error("TP-022 response lost after commit");
    }
    return response;
  };
}

async function newFirma(name?: string) {
  serial += 1;
  const r = await createRecord<Row>("firmen", {
    name: name || `TP-022 synthetisch ${serial}`, steuermodus: "kleinunternehmer", skr: "skr03",
    nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE),
  });
  const user = await createRecord<Row>("users", {
    email: `tp022-historisch-${serial}@synthetic.invalid`,
    password: "Synthetic-Test-Password-123",
    passwordConfirm: "Synthetic-Test-Password-123",
    role: "nutzer",
    firma: r.id,
  });
  await createRecord("mitgliedschaften", {
    firma: r.id,
    user: user.id,
    rolle: "eigentuemer",
  });
  akteure.set(r.id, user.id);
  return r.id;
}

async function rows(col: string, firmaId = firma) {
  const result = await listRecords<Row>(col, { filter: pbEq("firma", firmaId), perPage: 200, sort: "id" });
  expect(result.totalItems).toBe(result.items.length);
  return result.items;
}

async function state(firmaId = firma) {
  const records: Record<string, Row[]> = Object.fromEntries(await Promise.all(collections.map(async (col) => [col, await rows(col, firmaId)])));
  return { firma: await getFirmaById(firmaId), records };
}

async function draft(kind: Kind, firmaId = firma, marker = "") {
  if (kind === "kasse") return `histcash${String(++cashSerial).padStart(7, "0")}`;
  if (kind === "beleg") return (await createBeleg(firmaId, {
    belegdatum: date, richtung: "ausgabe", notiz: marker || "TP-022 synthetisch", ...amounts,
  })).id;
  const kunde = await createRecord<Row>("kontakte", { firma: firmaId, name: "TP-022 Kundin", ist_kunde: true });
  return (await createRechnung(firmaId, {
    kunde: kunde.id, rechnungsdatum: date,
    notiz: marker,
    positionen: [{ bezeichnung: "TP-022 Leistung", menge: "1", einzelpreis: "100", steuersatz: "0" }],
  }, { akteur: akteure.get(firmaId) })).id;
}

function finalize(kind: Kind, id: string, firmaId = firma) {
  if (kind === "rechnung") return festschreibenRechnung(firmaId, id, { akteur: akteure.get(firmaId) });
  if (kind === "beleg") return festschreibenBeleg(firmaId, id, { akteur: akteure.get(firmaId) });
  return festschreibenKassenbuchEintrag(firmaId, cashInput, {
    akteur: akteure.get(firmaId),
    vorgangId: id,
  });
}

function number(row: Row, kind: Kind) {
  return row[kind === "rechnung" ? "rechnungsnummer" : "belegnummer"];
}

describe.skipIf(process.env.TP022_ISOLATED !== "1")("TP-022 isolated PocketBase characterization", () => {
  beforeAll(async () => {
    expect(process.env.PB_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(process.env.PB_SUPERUSER_EMAIL).toBe("tp022@synthetic.invalid");
    await getAdminToken();
  });

  beforeEach(async () => {
    intercept = (_r, forward) => forward();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.origin !== process.env.PB_URL) throw new Error("TP-022 refuses non-test network target");
      return intercept({ url, method: init?.method ?? "GET", init }, () => realFetch(input, init));
    });
    firma = await newFirma();
  });
  afterEach(() => vi.restoreAllMocks());

  for (const kind of ["rechnung", "beleg", "kasse"] as const) {
    it(`${kind}: success has number, matching journal and immutable timestamp`, async () => {
      const id = await draft(kind);
      await finalize(kind, id);
      const s = await state();
      const [main] = s.records[collection[kind]];
      const [journal] = s.records.buchungsjournal;
      expect(s.records[collection[kind]]).toHaveLength(1);
      expect(s.records.buchungsjournal).toHaveLength(1);
      expect(number(main, kind)).toBe({ rechnung: "R-0001", beleg: "B-0001", kasse: "K-0001" }[kind]);
      expect(main.journal_eintrag).toBe(journal.id);
      expect(main.festgeschrieben_am).toBeTruthy();
      expect(journal).toMatchObject({ quelle_typ: kind, quelle_id: main.id, ...amounts,
        steuersatz: kind === "rechnung" ? "" : "0", laufende_nr: 1 });
      expect(s.firma?.nummernkreise[kind].next).toBe(2);
      if (kind === "rechnung") {
        expect(main.status).toBe("offen");
        const file = await fetchRecordFile("rechnungen", main.id, String(main.pdf));
        expect(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
      }
      if (kind === "beleg") expect(main.status).toBe("festgeschrieben");
    });

    it(`${kind}: counter write rejected leaves the complete state unchanged`, async () => {
      firma = await newFirma(`TP022-fail-counter-${kind}`);
      const id = await draft(kind);
      const before = await state();
      await expect(finalize(kind, id)).rejects.toThrow();
      expect(await state()).toEqual(before);
    });

    if (kind !== "kasse") {
      for (const boundary of ["journal", "journal-response", "final"] as const) {
        it(`${kind}: ${boundary} failure preserves its documented commit boundary`, async () => {
          const marker = {
            journal: "fail-journal-create",
            "journal-response": "fail-after-journal",
            final: "fail-source-save",
          }[boundary];
          const id = await draft(kind, firma, marker);
          const before = await state();
          await expect(finalize(kind, id)).rejects.toThrow();
          const s = await state();
          expect(s).toEqual(before);
        });
      }
    }

    it(`${kind}: lost final response persists success; retry behavior`, async () => {
      const id = await draft(kind);
      loseFinanceResponseOnce(kind);
      await expect(finalize(kind, id)).resolves.toBeDefined();
      const s = await state();
      expect(s.records[collection[kind]]).toHaveLength(1);
      expect(s.records.buchungsjournal).toHaveLength(1);
      expect(s.records[collection[kind]][0].journal_eintrag).toBe(s.records.buchungsjournal[0].id);
      await expect(finalize(kind, id)).resolves.toBeDefined();
      expect(await state()).toEqual(s);
    });
  }

  it("rechnung: PDF renderer failure consumes no number and writes no document or journal", async () => {
    const id = await draft("rechnung");
    const before = await state();
    vi.spyOn(pdf, "renderRechnungPdf").mockRejectedValueOnce(new Error("TP-022 PDF failed"));
    await expect(finalize("rechnung", id)).rejects.toThrow("PDF failed");
    const s = await state();
    expect(s.records).toEqual(before.records);
    expect(s.firma?.nummernkreise.rechnung.next).toBe(1);
    await finalize("rechnung", id);
    expect((await rows("rechnungen"))[0].rechnungsnummer).toBe("R-0001");
  });

  it("kasse: initial create failure rolls back number and records", async () => {
    const before = await state();
    await expect(
      festschreibenKassenbuchEintrag(
        firma,
        { ...cashInput, text: "TP-022 fail-cash-create" },
        { akteur: akteure.get(firma), vorgangId: "histcashcreate1" },
      ),
    ).rejects.toThrow();
    const s = await state();
    expect(s.records).toEqual(before.records);
    expect(s.firma?.nummernkreise.kasse.next).toBe(1);
  });

  for (const kind of ["rechnung", "beleg"] as const) {
    it(`${kind}: retry after a failed finance request creates one source journal`, async () => {
      const id = await draft(kind);
      failFinanceRequests(kind, 2);
      await expect(finalize(kind, id)).rejects.toThrow();
      expect((await state()).records.buchungsjournal).toHaveLength(0);
      await finalize(kind, id);
      const s = await state();
      expect(s.records.buchungsjournal).toHaveLength(1);
      expect(s.records.buchungsjournal.map((j) => j.quelle_id)).toEqual([id]);
      expect(s.records.buchungsjournal.map((j) => j.laufende_nr)).toEqual([1]);
      const main = s.records[collection[kind]][0];
      expect(number(main, kind)).toBe(kind === "rechnung" ? "R-0001" : "B-0001");
      expect(s.records.buchungsjournal[0].id).toBe(main.journal_eintrag);
    });

    it(`${kind}: two calls for the same draft resolve to one stable close`, async () => {
      const id = await draft(kind);
      await Promise.all([finalize(kind, id), finalize(kind, id)]);
      const s = await state();
      expect(s.records.buchungsjournal).toHaveLength(1);
      expect(s.records.buchungsjournal.map((j) => j.quelle_id)).toEqual([id]);
      expect(number(s.records[collection[kind]][0], kind)).toBe(kind === "rechnung" ? "R-0001" : "B-0001");
      expect(s.firma?.nummernkreise[kind].next).toBe(2);
    });
  }

  it("allocator: the transitional endpoint rejects direct Beleg-number allocation", async () => {
    const results = await Promise.allSettled([
      allocateBelegnummer(firma),
      allocateBelegnummer(firma),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    const s = await state();
    expect(s.firma?.nummernkreise.beleg.next).toBe(1);
    expect(Object.values(s.records).flat()).toEqual([]);
  });

  it("allocator: Beleg allocation is blocked while the unused Rechnung allocator remains transitional", async () => {
    const results = await Promise.allSettled([
      allocateBelegnummer(firma),
      allocateRechnungsnummer(firma),
    ]);
    expect(results[0].status).toBe("rejected");
    expect(results[1]).toMatchObject({ status: "fulfilled", value: "R-0001" });
    const s = await state();
    expect(s.firma?.nummernkreise.beleg.next).toBe(1);
    expect(s.firma?.nummernkreise.rechnung.next).toBe(2);
    expect(Object.values(s.records).flat()).toEqual([]);
  });

  it("journal: simultaneous max+1 creates are serialized", async () => {
    intercept = barrier((r) => isRequest(r, "GET", "buchungsjournal"));
    const results = await Promise.allSettled([
      festschreibenBuchung(firma, journalInput), festschreibenBuchung(firma, journalInput),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await rows("buchungsjournal")).toHaveLength(2);
    expect((await festschreibenBuchung(firma, journalInput)).laufende_nr).toBe(3);
    expect((await rows("buchungsjournal")).map((j) => j.laufende_nr).sort()).toEqual([1, 2, 3]);
  });

  it("journal: rejected create does not consume max+1", async () => {
    const before = await state();
    failOnce("POST", "buchungsjournal");
    await expect(festschreibenBuchung(firma, journalInput)).rejects.toThrow("TP-022");
    expect(await state()).toEqual(before);
    expect((await festschreibenBuchung(firma, journalInput)).laufende_nr).toBe(1);
  });

  it("different firms: parallel numbers and journals are independently scoped", async () => {
    const other = await newFirma();
    intercept = barrier((r) => isRequest(r, "GET", "buchungsjournal"));
    const allocations = await Promise.allSettled([
      allocateBelegnummer(firma),
      allocateBelegnummer(other),
    ]);
    expect(allocations.every((result) => result.status === "rejected")).toBe(true);
    const journals = await Promise.all([festschreibenBuchung(firma, journalInput), festschreibenBuchung(other, journalInput)]);
    expect(journals.map((j) => j.laufende_nr)).toEqual([1, 1]);
    expect((await rows("buchungsjournal"))[0].firma).toBe(firma);
    expect((await rows("buchungsjournal", other))[0].firma).toBe(other);
  });

  it("allocator: a generic counter reset is blocked after a number was committed", async () => {
    const id = await draft("beleg");
    await finalize("beleg", id);
    await expect(
      updateRecord("firmen", firma, {
        nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE),
      }),
    ).rejects.toThrow();
    expect((await getFirmaById(firma))?.nummernkreise.beleg.next).toBe(2);
  });

  for (const kind of ["rechnung", "beleg", "kasse"] as const) {
    it(`${kind}: two different operations receive distinct document and journal numbers`, async () => {
      const ids = [await draft(kind), await draft(kind)];
      const results = await Promise.allSettled(ids.map((id) => finalize(kind, id)));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
      const s = await state();
      const numbered = s.records[collection[kind]].filter((r) => number(r, kind));
      expect(numbered).toHaveLength(2);
      expect(new Set(numbered.map((row) => number(row, kind))).size).toBe(2);
      expect(s.records.buchungsjournal).toHaveLength(2);
      expect(new Set(s.records.buchungsjournal.map((row) => row.laufende_nr)).size).toBe(2);
      for (const row of numbered) {
        expect(s.records.buchungsjournal.some((journal) => journal.id === row.journal_eintrag)).toBe(true);
      }
    });

    it(`${kind}: two different firms can finalize simultaneously`, async () => {
      const other = await newFirma();
      const ids = [await draft(kind), await draft(kind, other)];
      await Promise.all([finalize(kind, ids[0]), finalize(kind, ids[1], other)]);
      for (const company of [firma, other]) {
        const s = await state(company);
        expect(s.records[collection[kind]]).toHaveLength(1);
        expect(s.records.buchungsjournal).toHaveLength(1);
        expect(s.records[collection[kind]][0].journal_eintrag).toBe(s.records.buchungsjournal[0].id);
        expect(s.records.buchungsjournal[0]).toMatchObject({ firma: company, laufende_nr: 1 });
        expect(s.firma?.nummernkreise[kind].next).toBe(2);
      }
    });
  }

  it("kasse: concurrent withdrawals use the transactional balance", async () => {
    await festschreibenKassenbuchEintrag(firma, { ...cashInput, datum: "2026-09-01" }, { akteur: akteure.get(firma), vorgangId: "histcashsaldo01" });
    const withdrawal = { ...cashInput, richtung: "ausgabe" as const, betrag_netto: "80", betrag_brutto: "80" };
    const results = await Promise.allSettled([
      festschreibenKassenbuchEintrag(firma, withdrawal, { akteur: akteure.get(firma), vorgangId: "histcashsaldo02" }),
      festschreibenKassenbuchEintrag(firma, withdrawal, { akteur: akteure.get(firma), vorgangId: "histcashsaldo03" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await getKassenSaldo(firma)).toBe("20.00");
    const s = await state();
    expect(s.records.kassenbuch_eintraege).toHaveLength(2);
    expect(s.records.buchungsjournal).toHaveLength(2);
    expect(new Set(s.records.kassenbuch_eintraege.map((r) => r.belegnummer)).size).toBe(2);
    expect(s.firma?.nummernkreise.kasse.next).toBe(3);
    for (const main of s.records.kassenbuch_eintraege) {
      expect(s.records.buchungsjournal.find((j) => j.id === main.journal_eintrag)?.quelle_id).toBe(main.id);
    }
  });

  it("allocator: direct Beleg allocation is rejected without consuming a number", async () => {
    await expect(allocateBelegnummer(firma)).rejects.toThrow();
    const s = await state();
    expect(s.firma?.nummernkreise.beleg.next).toBe(1);
    expect(Object.values(s.records).flat()).toEqual([]);
  });

  it("rechnung: real PB file validation failure leaves the complete draft unchanged", async () => {
    const id = await draft("rechnung");
    const before = await state();
    intercept = async (r, forward) => {
      if (r.url.pathname.endsWith("/rechnung/festschreiben") && r.init?.body instanceof FormData) {
        r.init.body.set("pdf", new File(["TP-022 invalid PDF"], "invalid.txt", { type: "text/plain" }));
      }
      return forward();
    };
    await expect(finalize("rechnung", id)).rejects.toThrow();
    const s = await state();
    expect(s.records.rechnungen).toEqual(before.records.rechnungen);
    expect(s.records.rechnungspositionen).toEqual(before.records.rechnungspositionen);
    expect(s.records.buchungsjournal).toHaveLength(0);
    expect(s.firma?.nummernkreise.rechnung.next).toBe(1);
  });

  it("kasse: concurrent journal allocation keeps both cash records linked", async () => {
    const ids = [await draft("kasse"), await draft("kasse")];
    const results = await Promise.allSettled([
      finalize("kasse", ids[0]),
      finalize("kasse", ids[1]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const s = await state();
    expect(s.records.kassenbuch_eintraege).toHaveLength(2);
    expect(s.records.kassenbuch_eintraege.filter((r) => r.journal_eintrag === "")).toHaveLength(0);
    expect(s.records.kassenbuch_eintraege.map((r) => r.belegnummer).sort()).toEqual(["K-0001", "K-0002"]);
    expect(s.records.buchungsjournal).toHaveLength(2);
    expect(s.firma?.nummernkreise.kasse.next).toBe(3);
    expect(await getKassenSaldo(firma)).toBe("200.00");
  });

  it("PB capability: native batch cannot bypass finance record guards", async () => {
    const headers = { Authorization: await getAdminToken(), "Content-Type": "application/json" };
    const settingsUrl = `${process.env.PB_URL}/api/settings`;
    const settingsResponse = await fetch(settingsUrl, { headers });
    expect(settingsResponse.ok).toBe(true);
    const settings = await settingsResponse.json();
    expect(settings.batch.enabled).toBe(false);
    const enable = await fetch(settingsUrl, {
      method: "PATCH", headers, body: JSON.stringify({ batch: { ...settings.batch, enabled: true } }),
    });
    expect(enable.ok).toBe(true);
    try {
      const before = await state();
      const body = { ...journalInput, firma, laufende_nr: 1, festgeschrieben_am: new Date().toISOString() };
      const kreise = structuredClone(DEFAULT_NUMMERNKREISE);
      kreise.beleg.next = 2;
      const requests = [
        { method: "PATCH", url: `/api/collections/firmen/records/${firma}`, body: { nummernkreise: kreise } },
        { method: "POST", url: "/api/collections/buchungsjournal/records", body },
        { method: "POST", url: "/api/collections/buchungsjournal/records", body },
      ];
      const failed = await fetch(`${process.env.PB_URL}/api/batch`, {
        method: "POST", headers, body: JSON.stringify({ requests }),
      });
      expect(failed.status).toBe(400);
      expect(await state()).toEqual(before);
      const guarded = await fetch(`${process.env.PB_URL}/api/batch`, {
        method: "POST", headers, body: JSON.stringify({ requests: requests.slice(0, 2) }),
      });
      expect(guarded.status).toBe(400);
      expect(await state()).toEqual(before);
    } finally {
      const restored = await fetch(settingsUrl, { method: "PATCH", headers, body: JSON.stringify({ batch: settings.batch }) });
      expect(restored.ok).toBe(true);
    }
  });

  it("beleg: failed finalization leaves no active journal", async () => {
    const id = await draft("beleg", firma, "fail-source-save");
    await expect(finalize("beleg", id)).rejects.toThrow();
    expect(await rows("buchungsjournal")).toEqual([]);
  });

  it("beleg: parallel closes return distinct numbers", async () => {
    const ids = [await draft("beleg"), await draft("beleg")];
    await Promise.all(ids.map((id) => finalize("beleg", id)));
    const numbers = (await rows("belege")).map((row) => row.belegnummer);
    expect(new Set(numbers).size).toBe(2);
  });

  openCashInvariant("OPEN C: a failed cash final write must not leave an active journal", async () => {
    await expect(
      festschreibenKassenbuchEintrag(
        firma,
        { ...cashInput, text: "TP-022 fail-cash-link" },
        { akteur: akteure.get(firma), vorgangId: "histcashfail001" },
      ),
    ).rejects.toThrow();
    expect(await rows("buchungsjournal")).toEqual([]);
    expect(await rows("kassenbuch_eintraege")).toEqual([]);
    expect((await getFirmaById(firma))?.nummernkreise.kasse.next).toBe(1);
  });

  openCashInvariant("OPEN C: concurrent withdrawals must not produce a negative cash balance", async () => {
    await festschreibenKassenbuchEintrag(
      firma,
      { ...cashInput, datum: "2026-09-01" },
      { akteur: akteure.get(firma), vorgangId: "histcashbase001" },
    );
    const withdrawal = { ...cashInput, richtung: "ausgabe" as const, betrag_netto: "80", betrag_brutto: "80" };
    const results = await Promise.allSettled([
      festschreibenKassenbuchEintrag(firma, withdrawal, { akteur: akteure.get(firma), vorgangId: "histcashout0001" }),
      festschreibenKassenbuchEintrag(firma, withdrawal, { akteur: akteure.get(firma), vorgangId: "histcashout0002" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(Number(await getKassenSaldo(firma))).toBeGreaterThanOrEqual(0);
  });
});
