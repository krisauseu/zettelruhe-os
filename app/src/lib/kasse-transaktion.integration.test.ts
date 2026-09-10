/**
 * TP-022 Kassen-Akzeptanz gegen PocketBase 0.39.10 und die Produktionshooks.
 * Ausschliesslich ueber scripts/test-festschreibung-isolated.mjs ausfuehren.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRecord,
  deleteRecord,
  DEFAULT_NUMMERNKREISE,
  getAdminToken,
  getFirmaById,
  listRecords,
  pbEq,
  updateRecord,
} from "./pb";
import { FinanzFehler } from "./finanz-transaktion";
import {
  festschreibenKassenbuchEintrag,
  getKassenSaldo,
  storniereKassenbuchEintrag,
} from "@/modules/cash/repository";

type Row = { id: string; firma: string; [key: string]: unknown };

const isolated = process.env.TP022_KASSE_ISOLATED === "1";
const input = {
  datum: "2026-09-06",
  richtung: "einnahme" as const,
  betrag_netto: "100.00",
  betrag_ust: "0.00",
  betrag_brutto: "100.00",
  steuersatz: "0" as const,
  text: "TP-022 Kasse",
};

let firma: string;
let akteur: string;
let mitgliedschaft: string;
let serial = 0;
const realFetch = globalThis.fetch;

async function company(name?: string) {
  serial += 1;
  const created = await createRecord<Row>("firmen", {
    name: name ?? `TP022 Kasse ${serial}`,
    steuermodus: "kleinunternehmer",
    skr: "skr03",
    nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE),
  });
  firma = created.id;
  const user = await createRecord<Row>("users", {
    email: `tp022-kasse-${serial}@synthetic.invalid`,
    password: "Synthetic-Test-Password-123",
    passwordConfirm: "Synthetic-Test-Password-123",
    role: "nutzer",
    firma,
  });
  akteur = user.id;
  mitgliedschaft = (
    await createRecord<Row>("mitgliedschaften", {
    firma,
    user: akteur,
    rolle: "eigentuemer",
    })
  ).id;
  return { firma, akteur, mitgliedschaft };
}

async function rows(collection: string, firmaId = firma) {
  return (
    await listRecords<Row>(collection, {
      filter: pbEq("firma", firmaId),
      perPage: 200,
      sort: "id",
    })
  ).items;
}

async function state(firmaId = firma) {
  return {
    kasse: await rows("kassenbuch_eintraege", firmaId),
    journal: await rows("buchungsjournal", firmaId),
    counter: (await getFirmaById(firmaId))!.nummernkreise.kasse.next,
  };
}

async function internal(path: string, body?: unknown) {
  return realFetch(`${process.env.PB_URL}/internal/${path}`, {
    method: "POST",
    headers: {
      Authorization: await getAdminToken(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe.skipIf(!isolated)("TP-022 Kasse acceptance", () => {
  beforeAll(() => {
    expect(process.env.PB_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(process.env.PB_SUPERUSER_EMAIL).toBe("tp022@synthetic.invalid");
  });

  beforeEach(() => company());
  afterEach(() => vi.restoreAllMocks());

  it("commits Kassenrecord, Journal, Rueckverweis, Nummer und Zaehler gemeinsam; identischer Replay bleibt stabil", async () => {
    const vorgangId = "cashclose000001";
    const first = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId,
    });
    const afterFirst = await state();

    const second = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId,
    });

    expect(first.quittung).toMatchObject({
      result: "committed",
      eintragId: vorgangId,
      belegnummer: "K-0001",
      journalnummer: 1,
    });
    expect(second.quittung).toEqual({
      ...first.quittung,
      result: "replayed",
    });
    expect(second.eintrag).toEqual(first.eintrag);
    expect(second.journal).toEqual(first.journal);
    expect(await state()).toEqual(afterFirst);
    expect(afterFirst.kasse).toHaveLength(1);
    expect(afterFirst.journal).toHaveLength(1);
    expect(afterFirst.kasse[0].journal_eintrag).toBe(afterFirst.journal[0].id);
    expect(afterFirst.journal[0]).toMatchObject({
      quelle_typ: "kasse",
      quelle_id: vorgangId,
      laufende_nr: 1,
    });
    expect(afterFirst.counter).toBe(2);
  });

  for (const boundary of [
    "counter",
    "cash-create",
    "cash-after-create",
    "journal-create",
    "journal-after-create",
    "cash-link",
  ] as const) {
    it(`rolls back the complete close when ${boundary} fails`, async () => {
      if (boundary === "counter") {
        await company("TP022-fail-counter-kasse-acceptance");
      }
      const marker = {
        counter: input.text,
        "cash-create": "TP-022 fail-cash-create",
        "cash-after-create": "TP-022 fail-cash-after-create",
        "journal-create": "TP-022 fail-journal-create",
        "journal-after-create": "TP-022 fail-after-journal",
        "cash-link": "TP-022 fail-cash-link",
      }[boundary];
      const before = await state();
      await expect(
        festschreibenKassenbuchEintrag(
          firma,
          {
            ...input,
            text: marker,
          },
          { akteur, vorgangId: `cashfail${boundary.replaceAll("-", "").padEnd(7, "0")}`.slice(0, 15) },
        ),
      ).rejects.toBeInstanceOf(FinanzFehler);
      expect(await state()).toEqual(before);
    });
  }

  it("retries an unknown commit outcome with the same source and projection", async () => {
    let lost = false;
    const bodies: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
      if (
        String(request).endsWith("/kasse/festschreiben") &&
        init?.method === "POST"
      ) {
        bodies.push(String(init.body));
      }
      const response = await realFetch(request, init);
      if (
        !lost &&
        String(request).endsWith("/kasse/festschreiben") &&
        init?.method === "POST"
      ) {
        lost = true;
        expect(response.ok).toBe(true);
        await response.arrayBuffer();
        throw new Error("TP-022 response lost after commit");
      }
      return response;
    });
    const result = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashunknown0001",
    });
    expect(result.quittung.result).toBe("replayed");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(await state()).toMatchObject({ counter: 2 });
    expect((await rows("kassenbuch_eintraege"))).toHaveLength(1);
    expect((await rows("buchungsjournal"))).toHaveLength(1);
  });

  it("serializes two closes of the same source into one commit and one replay", async () => {
    const results = await Promise.all([
      festschreibenKassenbuchEintrag(firma, input, {
        akteur,
        vorgangId: "cashparallel001",
      }),
      festschreibenKassenbuchEintrag(firma, input, {
        akteur,
        vorgangId: "cashparallel001",
      }),
    ]);
    expect(results.map((result) => result.quittung.result).sort()).toEqual([
      "committed",
      "replayed",
    ]);
    expect(await state()).toMatchObject({ counter: 2 });
    expect(await rows("kassenbuch_eintraege")).toHaveLength(1);
    expect(await rows("buchungsjournal")).toHaveLength(1);
  });

  it("rejects one of two concurrent withdrawals before the balance becomes negative", async () => {
    await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashdeposit0001",
    });
    const withdrawal = {
      ...input,
      richtung: "ausgabe" as const,
      betrag_netto: "80.00",
      betrag_brutto: "80.00",
    };
    const results = await Promise.allSettled([
      festschreibenKassenbuchEintrag(firma, withdrawal, {
        akteur,
        vorgangId: "cashwithdraw001",
      }),
      festschreibenKassenbuchEintrag(firma, withdrawal, {
        akteur,
        vorgangId: "cashwithdraw002",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({ code: "NEGATIVE_BALANCE" }),
    });
    expect(await getKassenSaldo(firma)).toBe("20.00");
    expect(await state()).toMatchObject({ counter: 3 });
  });

  it("commits Kassenstorno and Journal-Gegenbuchung together; repeated Storno is a replay", async () => {
    const original = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashstornoorig1",
    });
    const first = await storniereKassenbuchEintrag(firma, original.eintrag.id, {
      akteur,
      datum: "2026-09-06",
    });
    const afterFirst = await state();
    const second = await storniereKassenbuchEintrag(firma, original.eintrag.id, {
      akteur,
      datum: "2026-09-06",
    });

    expect(first.quittung).toMatchObject({
      result: "committed",
      originalId: original.eintrag.id,
      belegnummer: "K-0002",
      journalnummer: 2,
    });
    expect(second.quittung).toEqual({
      ...first.quittung,
      result: "replayed",
    });
    expect(await state()).toEqual(afterFirst);
    expect(afterFirst.kasse).toHaveLength(2);
    expect(afterFirst.journal).toHaveLength(2);
    const storno = afterFirst.kasse.find((row) => row.storno_von === original.eintrag.id)!;
    const journal = afterFirst.journal.find((row) => row.id === storno.journal_eintrag)!;
    expect(storno).toMatchObject({ richtung: "ausgabe", betrag_brutto: "100.00" });
    expect(journal).toMatchObject({
      quelle_typ: "storno",
      quelle_id: original.journal.id,
      storno_von: original.journal.id,
      richtung: "ausgabe",
      betrag_brutto: "100.00",
    });
    expect(await getKassenSaldo(firma)).toBe("0.00");
  });

  it("retries an unknown Storno commit with the same original and projection", async () => {
    const original = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "storunknownorig",
    });
    let lost = false;
    const bodies: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
      if (
        String(request).includes("/kasse/stornieren") &&
        init?.method === "POST"
      ) {
        bodies.push(String(init.body));
      }
      const response = await realFetch(request, init);
      if (
        !lost &&
        String(request).includes("/kasse/stornieren") &&
        init?.method === "POST"
      ) {
        lost = true;
        expect(response.ok).toBe(true);
        await response.arrayBuffer();
        throw new Error("TP-022 Storno response lost after commit");
      }
      return response;
    });
    const result = await storniereKassenbuchEintrag(firma, original.eintrag.id, {
      akteur,
      datum: "2026-09-06",
    });
    expect(lost).toBe(true);
    expect(result.quittung.result).toBe("replayed");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(await rows("kassenbuch_eintraege")).toHaveLength(2);
    expect(await rows("buchungsjournal")).toHaveLength(2);
    expect((await getFirmaById(firma))!.nummernkreise.kasse.next).toBe(3);
  });

  it("serializes concurrent Stornos of the same original", async () => {
    const original = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "storparallelorg",
    });
    const results = await Promise.all([
      storniereKassenbuchEintrag(firma, original.eintrag.id, {
        akteur,
        datum: "2026-09-06",
      }),
      storniereKassenbuchEintrag(firma, original.eintrag.id, {
        akteur,
        datum: "2026-09-06",
      }),
    ]);
    expect(results.map((result) => result.quittung.result).sort()).toEqual([
      "committed",
      "replayed",
    ]);
    expect(await rows("kassenbuch_eintraege")).toHaveLength(2);
    expect(await rows("buchungsjournal")).toHaveLength(2);
  });

  for (const boundary of [
    "counter",
    "cash-create",
    "cash-after-create",
    "journal-create",
    "journal-after-create",
    "cash-link",
  ] as const) {
    it(`rolls back the complete Storno when ${boundary} fails`, async () => {
      const originalIds = {
        counter: "stororigcnt0001",
        "cash-create": "stororigccr0001",
        "cash-after-create": "stororigcaf0001",
        "journal-create": "stororigjcr0001",
        "journal-after-create": "stororigjaf0001",
        "cash-link": "stororigclk0001",
      } as const;
      const original = await festschreibenKassenbuchEintrag(firma, input, {
        akteur,
        vorgangId: originalIds[boundary],
      });
      const marker = {
        counter: input.text,
        "cash-create": "TP-022 fail-cash-create",
        "cash-after-create": "TP-022 fail-cash-after-create",
        "journal-create": "TP-022 fail-journal-create",
        "journal-after-create": "TP-022 fail-after-journal",
        "cash-link": "TP-022 fail-cash-link",
      }[boundary];
      if (boundary === "counter") {
        const tamper = await internal(
          `tp022/kasse/${original.eintrag.id}/tamper/fail-storno-counter`,
        );
        expect(tamper.ok).toBe(true);
      }
      const before = await state();
      await expect(
        storniereKassenbuchEintrag(firma, original.eintrag.id, {
          akteur,
          datum: "2026-09-06",
          text: marker,
        }),
      ).rejects.toBeInstanceOf(FinanzFehler);
      expect(await state()).toEqual(before);
    });
  }

  it("runs different firms independently when they close in parallel", async () => {
    const first = { firma, akteur };
    const second = await company();
    await Promise.all([
      festschreibenKassenbuchEintrag(first.firma, input, {
        akteur: first.akteur,
        vorgangId: "cashcompany0001",
      }),
      festschreibenKassenbuchEintrag(second.firma, input, {
        akteur: second.akteur,
        vorgangId: "cashcompany0002",
      }),
    ]);
    for (const companyState of [first, second]) {
      expect(await state(companyState.firma)).toMatchObject({ counter: 2 });
      expect(await rows("kassenbuch_eintraege", companyState.firma)).toHaveLength(1);
      expect(await rows("buchungsjournal", companyState.firma)).toHaveLength(1);
    }
  });

  it("rejects a changed projection on replay without modifying the committed source", async () => {
    await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashstale000001",
    });
    const before = await state();
    await expect(
      festschreibenKassenbuchEintrag(
        firma,
        { ...input, text: "veraltete Projektion" },
        { akteur, vorgangId: "cashstale000001" },
      ),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(await state()).toEqual(before);
  });

  it("rejects a stale original projection during Storno", async () => {
    const original = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashstlstor0001",
    });
    let changed = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
      if (
        !changed &&
        String(request).endsWith("/kasse/stornieren") &&
        init?.method === "POST"
      ) {
        changed = true;
        const response = await internal(
          `tp022/kasse/${original.eintrag.id}/tamper/source-text`,
        );
        expect(response.ok).toBe(true);
      }
      return realFetch(request, init);
    });
    await expect(
      storniereKassenbuchEintrag(firma, original.eintrag.id, {
        akteur,
        datum: "2026-09-06",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(await rows("kassenbuch_eintraege")).toHaveLength(1);
    expect(await rows("buchungsjournal")).toHaveLength(1);
    expect((await getFirmaById(firma))!.nummernkreise.kasse.next).toBe(2);
  });

  it("refuses Storno when the Kassenrecord points at a foreign Journal", async () => {
    const own = { firma, akteur };
    const original = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashwronglink01",
    });
    const other = await company();
    await festschreibenKassenbuchEintrag(other.firma, input, {
      akteur: other.akteur,
      vorgangId: "cashwronglink02",
    });
    firma = own.firma;
    akteur = own.akteur;
    const tamper = await internal(
      `tp022/kasse/${original.eintrag.id}/tamper/journal-link`,
    );
    expect(tamper.ok).toBe(true);
    const before = await state();
    await expect(
      storniereKassenbuchEintrag(firma, original.eintrag.id, {
        akteur,
        datum: "2026-09-06",
      }),
    ).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
    expect(await state()).toEqual(before);
  });

  it("skips occupied Kassenbelegnummern when the counter is behind", async () => {
    await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashnumber00001",
    });
    const tamper = await internal("tp022/kasse/cashnumber00001/tamper/counter-back");
    expect(tamper.ok).toBe(true);
    const second = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashnumber00002",
    });
    expect(second.eintrag.belegnummer).toBe("K-0002");
    expect((await getFirmaById(firma))!.nummernkreise.kasse.next).toBe(3);
  });

  it("rechecks membership and rejects a withdrawn write role inside the transaction", async () => {
    await updateRecord("mitgliedschaften", mitgliedschaft, { rolle: "lesen" });
    const before = await state();
    await expect(
      festschreibenKassenbuchEintrag(firma, input, {
        akteur,
        vorgangId: "cashread0000001",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await state()).toEqual(before);
  });

  it("rejects a contact from another firm inside the transaction", async () => {
    const own = { firma, akteur };
    const other = await company();
    const kontakt = await createRecord<Row>("kontakte", {
      firma: other.firma,
      name: "Fremdkontakt",
      ist_kunde: true,
    });
    firma = own.firma;
    akteur = own.akteur;
    const before = await state();
    await expect(
      festschreibenKassenbuchEintrag(
        firma,
        { ...input, kontakt: kontakt.id },
        { akteur, vorgangId: "cashforeign0001" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await state()).toEqual(before);
  });

  it("blocks generic Superuser writes to protected Kassen- and Journalrecords", async () => {
    const committed = await festschreibenKassenbuchEintrag(firma, input, {
      akteur,
      vorgangId: "cashguarded0001",
    });
    const before = await state();
    await expect(
      createRecord("kassenbuch_eintraege", {
        firma,
        ...input,
        belegnummer: "K-DIREKT",
        festgeschrieben_am: new Date().toISOString(),
      }),
    ).rejects.toThrow("MUTATION_FORBIDDEN");
    await expect(
      updateRecord("kassenbuch_eintraege", committed.eintrag.id, { text: "Direkt" }),
    ).rejects.toThrow("MUTATION_FORBIDDEN");
    await expect(deleteRecord("kassenbuch_eintraege", committed.eintrag.id)).rejects.toThrow(
      "MUTATION_FORBIDDEN",
    );
    await expect(
      createRecord("buchungsjournal", {
        firma,
        laufende_nr: 2,
        quelle_typ: "kasse",
        quelle_id: committed.eintrag.id,
        buchungsdatum: input.datum,
        belegdatum: input.datum,
        buchungstext: "Direkt",
        richtung: "einnahme",
        betrag_netto: "1.00",
        betrag_ust: "0.00",
        betrag_brutto: "1.00",
        steuersatz: "0",
        festgeschrieben_am: new Date().toISOString(),
      }),
    ).rejects.toThrow("MUTATION_FORBIDDEN");
    await expect(
      createRecord("buchungsjournal", {
        firma,
        laufende_nr: 2,
        quelle_typ: "storno",
        quelle_id: committed.journal.id,
        storno_von: committed.journal.id,
        buchungsdatum: input.datum,
        belegdatum: input.datum,
        buchungstext: "Direkt",
        richtung: "ausgabe",
        betrag_netto: "100.00",
        betrag_ust: "0.00",
        betrag_brutto: "100.00",
        steuersatz: "0",
        festgeschrieben_am: new Date().toISOString(),
      }),
    ).rejects.toThrow("MUTATION_FORBIDDEN");
    await expect(
      updateRecord("buchungsjournal", committed.journal.id, { buchungstext: "Direkt" }),
    ).rejects.toThrow("MUTATION_FORBIDDEN");
    await expect(deleteRecord("buchungsjournal", committed.journal.id)).rejects.toThrow(
      "MUTATION_FORBIDDEN",
    );
    expect(await state()).toEqual(before);
  });
});
