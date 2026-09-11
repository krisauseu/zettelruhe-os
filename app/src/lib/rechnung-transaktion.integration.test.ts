import * as finanzTransaktion from "./finanz-transaktion";
import { createZahlung } from "@/modules/payments/repository";
/** TP-022 Rechnung acceptance against PB 0.39.10 and the production hooks. */
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  DEFAULT_NUMMERNKREISE,
  createRecord,
  deleteRecord,
  fetchRecordFile,
  getAdminToken,
  getFirmaById,
  getRecord,
  listRecords,
  pbEq,
  updateRecord,
} from "./pb";
import {
  createAngebot,
  updateAngebot,
  getAngebotMitPositionen,
  sendenAngebot,
  setAngebotStatus,
  uebernehmenAlsRechnung,
  createRechnung,
  deleteRechnung,
  festschreibenRechnung,
  getRechnungMitPositionen,
  updateRechnung,
} from "@/modules/sales/repository";
import {
  nummernkreiseKonfigurieren,
  rechnungFestschreiben,
} from "./finanz-transaktion";

const isolated = process.env.TP022_RECHNUNG_ISOLATED === "1";
const date = "2026-09-06";
const realFetch = globalThis.fetch;
let firma: string;
let akteur: string;
let kunde: string;
let serial = 0;

async function company(
  name = `TP022 Rechnung ${++serial}`,
  steuermodus = "kleinunternehmer",
) {
  return (
    await createRecord<{ id: string }>("firmen", {
      name,
      steuermodus,
      skr: "skr03",
      nummernkreise: structuredClone(DEFAULT_NUMMERNKREISE),
    })
  ).id;
}

async function member() {
  const user = await createRecord<{ id: string }>("users", {
    email: `tp022-rechnung-${++serial}@synthetic.invalid`,
    password: "Synthetic-Test-Password-123",
    passwordConfirm: "Synthetic-Test-Password-123",
    role: "nutzer",
    firma,
  });
  await createRecord("mitgliedschaften", {
    firma,
    user: user.id,
    rolle: "eigentuemer",
  });
  return user.id;
}

async function addMember(rolle: "eigentuemer" | "bearbeiten" | "lesen") {
  const user = await createRecord<{ id: string }>("users", {
    email: `tp022-rechnung-${++serial}@synthetic.invalid`,
    password: "Synthetic-Test-Password-123",
    passwordConfirm: "Synthetic-Test-Password-123",
    role: "nutzer",
    firma,
  });
  const membership = await createRecord<{ id: string }>("mitgliedschaften", {
    firma,
    user: user.id,
    rolle,
  });
  return { user: user.id, membership: membership.id };
}

const input = (notiz = "Synthetic invoice") => ({
  kunde,
  rechnungsdatum: date,
  notiz,
  positionen: [
    {
      bezeichnung: "Leistung",
      menge: "2",
      einheit: "Std.",
      einzelpreis: "50.00",
      steuersatz: "" as const,
    },
  ],
});

async function rows(collection: string) {
  return (
    await listRecords<{ id: string; [key: string]: unknown }>(collection, {
      filter: pbEq("firma", firma),
      perPage: 500,
      sort: "id",
    })
  ).items;
}

async function state() {
  return {
    firma: await getFirmaById(firma),
    rechnungen: await rows("rechnungen"),
    positionen: await rows("rechnungspositionen"),
    journal: await rows("buchungsjournal"),
  };
}

async function internal(path: string) {
  return realFetch(`${process.env.PB_URL}/internal/${path}`, {
    method: "POST",
    headers: { Authorization: await getAdminToken() },
  });
}

function pdfContainsText(bytes: Buffer, text: string): boolean {
  const payloads = [bytes.toString("latin1")];
  const streamStart = Buffer.from("stream\n");
  const streamEnd = Buffer.from("\nendstream");
  let offset = 0;
  while ((offset = bytes.indexOf(streamStart, offset)) >= 0) {
    const start = offset + streamStart.length;
    const end = bytes.indexOf(streamEnd, start);
    if (end < 0) break;
    try {
      payloads.push(inflateSync(bytes.subarray(start, end)).toString("latin1"));
    } catch {
      // Nicht jeder PDF-Stream ist mit Flate komprimiert.
    }
    offset = end + streamEnd.length;
  }
  const asciiHex = Buffer.from(text, "latin1").toString("hex");
  const utf16Hex = Buffer.from(
    Array.from(text).flatMap((char) => [0, char.charCodeAt(0)]),
  ).toString("hex");
  return payloads.some((payload) => {
    const compact = payload.replace(/\s+/g, "").toLowerCase();
    return (
      payload.includes(text) ||
      compact.includes(asciiHex) ||
      compact.includes(utf16Hex)
    );
  });
}

describe.skipIf(!isolated)("TP-022 Rechnung acceptance", () => {
  beforeAll(async () => {
    expect(process.env.PB_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  beforeEach(async () => {
    firma = await company();
    akteur = await member();
    kunde = (
      await createRecord<{ id: string }>("kontakte", {
        firma,
        name: "Kundin Beispiel",
        ist_kunde: true,
        land: "DE",
      })
    ).id;
  });
  afterEach(() => vi.restoreAllMocks());

  it("creates, replaces and deletes a complete draft atomically", async () => {
    const created = await createRechnung(firma, input(), { akteur });
    expect(created.positionen).toHaveLength(1);
    const updated = await updateRechnung(firma, created.id, {
      ...input("Updated"),
      positionen: [input().positionen[0], { ...input().positionen[0], bezeichnung: "Zweite" }],
    }, { akteur });
    expect(updated.notiz).toBe("Updated");
    expect(updated.positionen.map((p) => p.bezeichnung)).toEqual(["Leistung", "Zweite"]);
    await deleteRechnung(firma, created.id, { akteur });
    expect(await getRechnungMitPositionen(firma, created.id)).toBeNull();
    expect(await rows("rechnungspositionen")).toHaveLength(0);
  });

  it("speichert, ändert und leert Positionsdetails; sperrt sie nach Festschreibung", async () => {
    const description = "example.test\nSeptember 2026";
    const values = { ...input(), positionen: [{ ...input().positionen[0], description }] };
    const draft = await createRechnung(firma, values, { akteur });
    expect((await getRechnungMitPositionen(firma, draft.id))!.positionen[0].description).toBe(description);
    const cleared = await updateRechnung(firma, draft.id, input(), { akteur });
    expect(cleared.positionen[0].description).toBe("");
    await updateRechnung(firma, draft.id, values, { akteur });
    const closed = await festschreibenRechnung(firma, draft.id, { akteur });
    expect(closed.rechnung.positionen[0].description).toBe(description);
    await expect(updateRecord("rechnungspositionen", closed.rechnung.positionen[0].id, { description: "changed" })).rejects.toThrow();
  });

  it("erhält Angebotsdetails beim Speichern, Senden und Übernehmen als Rechnung", async () => {
    const values = { kunde, angebotsdatum: date, positionen: [{ ...input().positionen[0], description: "example.test\nSeptember 2026" }] };
    const draft = await createAngebot(firma, values);
    expect((await getAngebotMitPositionen(firma, draft.id))!.positionen[0].description).toBe(values.positionen[0].description);
    const cleared = await updateAngebot(firma, draft.id, { ...values, positionen: input().positionen });
    expect(cleared.positionen[0].description).toBe("");
    await updateAngebot(firma, draft.id, values);
    const sent = await sendenAngebot(firma, draft.id);
    expect(sent.positionen[0].description).toBe(values.positionen[0].description);
    await setAngebotStatus(firma, draft.id, "angenommen");
    vi.spyOn(finanzTransaktion, "finanzAkteur").mockResolvedValue(akteur);
    const converted = await uebernehmenAlsRechnung(firma, draft.id);
    expect(converted.rechnung.positionen[0].description).toBe(values.positionen[0].description);
  });

  it("commits number, original PDF, journal and invoice together; replay is stable", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    const first = await festschreibenRechnung(firma, draft.id, { akteur });
    const replay = await festschreibenRechnung(firma, draft.id, { akteur });
    expect(first.quittung.result).toBe("committed");
    expect(replay.quittung).toEqual({ ...first.quittung, result: "replayed" });
    expect(first.rechnung.rechnungsnummer).toBe("R-0001");
    expect(first.rechnung.status).toBe("offen");
    expect(first.rechnung.pdf).toBe(first.quittung.pdfDateiname);
    expect(first.rechnung.journal_eintrag).toBe(first.journal.id);
    expect(first.rechnung.festgeschrieben_am).toBe(first.journal.festgeschrieben_am);
    expect(await rows("buchungsjournal")).toHaveLength(1);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(2);
  });

  it("rejects stale draft writes and generic Superuser mutations after close", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    await festschreibenRechnung(firma, draft.id, { akteur });
    await expect(updateRechnung(firma, draft.id, input("late"), { akteur })).rejects.toThrow();
    await expect(deleteRechnung(firma, draft.id, { akteur })).rejects.toThrow();
    await expect(updateRecord("rechnungen", draft.id, { notiz: "bypass" })).rejects.toThrow();
    const pos = (await rows("rechnungspositionen"))[0];
    await expect(updateRecord("rechnungspositionen", pos.id, { bezeichnung: "bypass" })).rejects.toThrow();
    await expect(updateRecord("buchungsjournal", String((await getRecord<{ journal_eintrag: string }>("rechnungen", draft.id)).journal_eintrag), { betrag_brutto: "1.00" })).rejects.toThrow();
  });

  it("allows exactly one winner when draft replacement races the close", async () => {
    const draft = await createRechnung(firma, input("before race"), { akteur });
    let arrivals = 0;
    let release!: () => void;
    const bothPrepared = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (
        String(url).endsWith("/rechnung/festschreiben") ||
        String(url).endsWith("/rechnung/entwurf")
      ) {
        arrivals += 1;
        if (arrivals === 2) release();
        await bothPrepared;
      }
      return realFetch(url, init);
    });
    const results = await Promise.allSettled([
      festschreibenRechnung(firma, draft.id, { akteur }),
      updateRechnung(firma, draft.id, input("after race"), { akteur }),
    ]);
    vi.restoreAllMocks();
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const current = (await getRechnungMitPositionen(firma, draft.id))!;
    if (current.status === "entwurf") {
      expect(current.notiz).toBe("after race");
      expect(await rows("buchungsjournal")).toHaveLength(0);
    } else {
      expect(current.status).toBe("offen");
      expect(current.notiz).toBe("before race");
      expect(await rows("buchungsjournal")).toHaveLength(1);
    }
  });

  it("rejects an outdated source projection without consuming number or journal", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    await expect(
      rechnungFestschreiben({
        firma,
        akteur,
        id: draft.id,
        nummer: "R-0001",
        expected: { invalid: true },
        journal: {},
        pdfBytes: new TextEncoder().encode("%PDF-1.4\n%%EOF"),
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
    expect(await rows("buchungsjournal")).toHaveLength(0);
  });

  it.each([
    "fail-counter-rechnung",
    "fail-journal-create",
    "fail-after-journal",
    "fail-source-save",
    "fail-pdf-save",
  ])("rolls every database write back at %s", async (marker) => {
    if (marker === "fail-counter-rechnung") {
      firma = await company("TP022-fail-counter-rechnung-acceptance");
      akteur = await member();
      kunde = (
        await createRecord<{ id: string }>("kontakte", {
          firma,
          name: "Kundin Fehlergrenze",
          ist_kunde: true,
        })
      ).id;
    }
    const draft = await createRechnung(firma, input(marker), { akteur });
    const before = await state();
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(await state()).toEqual(before);
  });

  it("replays after a lost success response with identical PDF and one counter increment", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    let lost = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const response = await realFetch(url, init);
      if (
        String(url).endsWith("/rechnung/festschreiben") &&
        response.ok &&
        !lost
      ) {
        lost = true;
        await response.arrayBuffer();
        throw new Error("lost response");
      }
      return response;
    });
    const result = await festschreibenRechnung(firma, draft.id, { akteur });
    vi.restoreAllMocks();
    expect(result.quittung.result).toBe("replayed");
    expect(await rows("buchungsjournal")).toHaveLength(1);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(2);
  });

  it("serializes two closes of the same invoice into one commit and one replay", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    const results = await Promise.all([
      festschreibenRechnung(firma, draft.id, { akteur }),
      festschreibenRechnung(firma, draft.id, { akteur }),
    ]);
    expect(results.map((r) => r.quittung.result).sort()).toEqual([
      "committed",
      "replayed",
    ]);
    expect(new Set(results.map((r) => r.quittung.journalId)).size).toBe(1);
    expect(await rows("buchungsjournal")).toHaveLength(1);
  });

  it("rerenders after a number conflict between two different invoices", async () => {
    const a = await createRechnung(firma, input("A"), { akteur });
    const b = await createRechnung(firma, input("B"), { akteur });
    const results = await Promise.all([
      festschreibenRechnung(firma, a.id, { akteur }),
      festschreibenRechnung(firma, b.id, { akteur }),
    ]);
    expect(results.map((r) => r.rechnung.rechnungsnummer).sort()).toEqual([
      "R-0001",
      "R-0002",
    ]);
    expect(new Set(results.map((r) => r.quittung.pdfDateiname)).size).toBe(2);
    expect(await rows("buchungsjournal")).toHaveLength(2);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(3);
  });

  it("stops after three number conflicts without committing an invoice", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    let conflicts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/rechnung/festschreiben")) {
        const current = (await getFirmaById(firma))!.nummernkreise.rechnung;
        conflicts += 1;
        await nummernkreiseKonfigurieren(firma, akteur, {
          rechnung: {
            expected: current,
            value: { ...current, prefix: `K${conflicts}-` },
          },
        });
      }
      return realFetch(url, init);
    });
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: "NUMBER_CHANGED" });
    vi.restoreAllMocks();
    expect(conflicts).toBe(3);
    expect(await rows("buchungsjournal")).toHaveLength(0);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
    expect((await getRecord<{ status: string }>("rechnungen", draft.id)).status).toBe(
      "entwurf",
    );
  });

  it("skips an occupied number when the stored counter points backwards", async () => {
    const first = await createRechnung(firma, input("first"), { akteur });
    await festschreibenRechnung(firma, first.id, { akteur });
    expect((await internal(`tp022/rechnung/${first.id}/tamper/counter-back`)).ok).toBe(
      true,
    );
    const second = await createRechnung(firma, input("second"), { akteur });
    const done = await festschreibenRechnung(firma, second.id, { akteur });
    expect(done.rechnung.rechnungsnummer).toBe("R-0002");
    expect(done.journal.laufende_nr).toBe(2);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(3);
  });

  it("closes invoices for two firms concurrently without sharing counters or journals", async () => {
    const first = {
      firma,
      akteur,
      draft: await createRechnung(firma, input("first firm"), { akteur }),
    };
    firma = await company("TP022 second concurrent firm");
    akteur = await member();
    kunde = (
      await createRecord<{ id: string }>("kontakte", {
        firma,
        name: "Kundin zweite Firma",
        ist_kunde: true,
      })
    ).id;
    const second = {
      firma,
      akteur,
      draft: await createRechnung(firma, input("second firm"), { akteur }),
    };
    const results = await Promise.all([
      festschreibenRechnung(first.firma, first.draft.id, {
        akteur: first.akteur,
      }),
      festschreibenRechnung(second.firma, second.draft.id, {
        akteur: second.akteur,
      }),
    ]);
    expect(results.map((result) => result.rechnung.rechnungsnummer)).toEqual([
      "R-0001",
      "R-0001",
    ]);
    expect(results.map((result) => result.journal.laufende_nr)).toEqual([1, 1]);
    expect((await getFirmaById(first.firma))!.nummernkreise.rechnung.next).toBe(2);
    expect((await getFirmaById(second.firma))!.nummernkreise.rechnung.next).toBe(2);
  });

  it("downloads the immutable original byte-for-byte and keeps anonymous access closed", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    const done = await festschreibenRechnung(firma, draft.id, { akteur });
    const response = await fetchRecordFile(
      "rechnungen",
      draft.id,
      done.rechnung.pdf,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfContainsText(bytes, done.rechnung.rechnungsnummer)).toBe(true);
    const hash = createHash("sha256").update(bytes).digest("hex");
    await festschreibenRechnung(firma, draft.id, { akteur });
    const replayBytes = Buffer.from(
      await (
        await fetchRecordFile("rechnungen", draft.id, done.rechnung.pdf)
      ).arrayBuffer(),
    );
    expect(createHash("sha256").update(replayBytes).digest("hex")).toBe(hash);
    const anonymous = await realFetch(
      `${process.env.PB_URL}/api/files/rechnungen/${draft.id}/${done.rechnung.pdf}`,
    );
    expect(anonymous.ok).toBe(false);
  });

  it("does not reset a later paid status during replay", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    await festschreibenRechnung(firma, draft.id, { akteur });
    await createZahlung(firma, { rechnung: draft.id, datum: date, betrag: draft.betrag_brutto }, { akteur });
    const replay = await festschreibenRechnung(firma, draft.id, { akteur });
    expect(replay.quittung.result).toBe("replayed");
    expect(replay.rechnung.status).toBe("bezahlt");
  });

  it.each(["head", "position"])(
    "rejects a %s change made after PDF preparation",
    async (mode) => {
      const draft = await createRechnung(firma, input(), { akteur });
      let changed = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        if (
          String(url).endsWith("/rechnung/festschreiben") &&
          !changed
        ) {
          changed = true;
          expect(
            (
              await internal(
                `tp022/rechnung/${draft.id}/tamper/${mode}`,
              )
            ).ok,
          ).toBe(true);
        }
        return realFetch(url, init);
      });
      await expect(
        festschreibenRechnung(firma, draft.id, { akteur }),
      ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
      vi.restoreAllMocks();
      expect(await rows("buchungsjournal")).toHaveLength(0);
      expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
    },
  );

  it.each([
    "position-delete",
    "position-add",
    "position-sort",
    "position-sum",
    "head-sum",
    "position-firma",
    "position-rechnung",
  ])("rejects a prepared PDF after source mutation %s", async (mode) => {
    const draft = await createRechnung(firma, input(mode), { akteur });
    if (mode === "position-firma") await company("TP022 foreign position");
    if (mode === "position-rechnung") {
      await createRechnung(firma, input("sibling"), { akteur });
    }
    let changed = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/rechnung/festschreiben") && !changed) {
        changed = true;
        expect((await internal(`tp022/rechnung/${draft.id}/tamper/${mode}`)).ok).toBe(
          true,
        );
      }
      return realFetch(url, init);
    });
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    vi.restoreAllMocks();
    expect(await rows("buchungsjournal")).toHaveLength(0);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
  });

  it("fails before commit when a configured logo cannot be loaded", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    expect((await internal(`tp022/rechnung/${draft.id}/tamper/logo`)).ok).toBe(
      true,
    );
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toThrow(/Datei nicht ladbar/);
    expect(await rows("buchungsjournal")).toHaveLength(0);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
  });

  it("leaves the draft untouched when the PDF renderer fails", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    vi.spyOn(Blob.prototype, "arrayBuffer").mockRejectedValueOnce(
      new Error("render failed"),
    );
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toThrow("render failed");
    vi.restoreAllMocks();
    expect(await rows("buchungsjournal")).toHaveLength(0);
    expect((await getFirmaById(firma))!.nummernkreise.rechnung.next).toBe(1);
    expect((await getRecord<{ status: string }>("rechnungen", draft.id)).status).toBe(
      "entwurf",
    );
  });

  it("fails before commit when the bank-account read fails", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).includes("/collections/bankkonten/records?")) {
        throw new Error("bank read failed");
      }
      return realFetch(url, init);
    });
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toThrow("bank read failed");
    vi.restoreAllMocks();
    expect(await rows("buchungsjournal")).toHaveLength(0);
  });

  it("rolls a late-position create and replacement failure back completely", async () => {
    await expect(
      createRechnung(
        firma,
        {
          ...input(),
          positionen: [
            input().positionen[0],
            { ...input().positionen[0], bezeichnung: "fail-position-create" },
          ],
        },
        { akteur },
      ),
    ).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(await rows("rechnungen")).toHaveLength(0);
    expect(await rows("rechnungspositionen")).toHaveLength(0);

    const draft = await createRechnung(firma, input(), { akteur });
    const before = await state();
    await expect(
      updateRechnung(
        firma,
        draft.id,
        {
          ...input("replacement"),
          positionen: [
            input().positionen[0],
            { ...input().positionen[0], bezeichnung: "fail-position-create" },
          ],
        },
        { akteur },
      ),
    ).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(await state()).toEqual(before);
  });

  it("rolls a delete failure back including all positions", async () => {
    const draft = await createRechnung(firma, input("fail-delete"), { akteur });
    const before = await state();
    await expect(deleteRechnung(firma, draft.id, { akteur })).rejects.toMatchObject(
      { code: "COMMIT_UNKNOWN" },
    );
    expect(await state()).toEqual(before);
  });

  it("loads and closes more than 200 positions without truncation", async () => {
    const positionen = Array.from({ length: 205 }, (_, index) => ({
      ...input().positionen[0],
      bezeichnung: `Position ${index + 1}`,
      menge: "1",
      einzelpreis: "1.00",
    }));
    const draft = await createRechnung(
      firma,
      { ...input(), positionen },
      { akteur },
    );
    expect((await getRechnungMitPositionen(firma, draft.id))!.positionen).toHaveLength(
      205,
    );
    const done = await festschreibenRechnung(firma, draft.id, { akteur });
    expect(done.rechnung.positionen).toHaveLength(205);
    expect(done.rechnung.betrag_brutto).toBe("205.00");
  });

  it("keeps tax variants and mixed-rate journal semantics", async () => {
    firma = await company(`TP022 Steuer ${++serial}`, "regelbesteuerung_ist");
    akteur = await member();
    kunde = (
      await createRecord<{ id: string }>("kontakte", {
        firma,
        name: "Kundin Steuer",
        ist_kunde: true,
      })
    ).id;
    const single = await createRechnung(
      firma,
      {
        ...input(),
        positionen: [{ ...input().positionen[0], steuersatz: "19" as const }],
      },
      { akteur },
    );
    expect((await festschreibenRechnung(firma, single.id, { akteur })).journal.steuersatz).toBe(
      "19",
    );
    const seven = await createRechnung(
      firma,
      {
        ...input(),
        positionen: [{ ...input().positionen[0], steuersatz: "7" as const }],
      },
      { akteur },
    );
    expect((await festschreibenRechnung(firma, seven.id, { akteur })).journal.steuersatz).toBe(
      "7",
    );
    const mixed = await createRechnung(
      firma,
      {
        ...input(),
        positionen: [
          { ...input().positionen[0], steuersatz: "19" as const },
          { ...input().positionen[0], bezeichnung: "7 Prozent", steuersatz: "7" as const },
        ],
      },
      { akteur },
    );
    expect((await festschreibenRechnung(firma, mixed.id, { akteur })).journal.steuersatz).toBe(
      "",
    );
  });

  it("uses the invoice tax-mode snapshot after the company setting changes", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    await updateRecord("firmen", firma, { steuermodus: "regelbesteuerung_ist" });
    const done = await festschreibenRechnung(firma, draft.id, { akteur });
    expect(done.rechnung.steuermodus).toBe("kleinunternehmer");
    expect(done.rechnung.betrag_ust).toBe("0.00");
    expect(done.journal.steuersatz).toBe("");
  });

  it("rejects foreign customers, read roles and revoked memberships", async () => {
    const other = await company();
    const foreign = await createRecord<{ id: string }>("kontakte", {
      firma: other,
      name: "Fremde Kundin",
      ist_kunde: true,
    });
    await expect(
      createRechnung(firma, { ...input(), kunde: foreign.id }, { akteur }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const reader = await addMember("lesen");
    await expect(
      createRechnung(firma, input(), { akteur: reader.user }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const draft = await createRechnung(firma, input(), { akteur });
    const membership = (await rows("mitgliedschaften")).find(
      (row) => row.user === akteur,
    );
    await deleteRecord("mitgliedschaften", membership!.id);
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await rows("buchungsjournal")).toHaveLength(0);
  });

  it.each([
    { label: "missing bytes", type: "application/pdf", bytes: null, code: "INVALID_STATE" },
    { label: "wrong MIME type", type: "text/plain", bytes: "%PDF-1.4\n%%EOF", code: "INVALID_STATE" },
    { label: "invalid bytes", type: "application/pdf", bytes: "not a PDF", code: "COMMIT_UNKNOWN" },
    { label: "oversized file", type: "application/pdf", bytes: new Uint8Array(15 * 1024 * 1024 + 1), code: "INVALID_STATE" },
  ])("rolls back when PocketBase rejects PDF upload: $label", async (bad) => {
    const draft = await createRechnung(firma, input(), { akteur });
    const before = await state();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).endsWith("/rechnung/festschreiben")) {
        const sent = init?.body as FormData;
        const body = new FormData();
        body.set("payload", String(sent.get("payload")));
        if (bad.bytes !== null) {
          body.set("pdf", new File([bad.bytes], "bad.pdf", { type: bad.type }));
        }
        return realFetch(url, { ...init, body });
      }
      return realFetch(url, init);
    });
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: bad.code });
    expect(await state()).toEqual(before);
  });

  it("rejects incomplete legacy and damaged replay states without a second journal", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    expect(
      (await internal(`tp022/rechnung/${draft.id}/tamper/number-only`)).ok,
    ).toBe(true);
    await expect(
      festschreibenRechnung(firma, draft.id, { akteur }),
    ).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
    expect(await rows("buchungsjournal")).toHaveLength(0);

    const healthy = await createRechnung(firma, input("healthy"), { akteur });
    await festschreibenRechnung(firma, healthy.id, { akteur });
    expect(
      (await internal(`tp022/rechnung/${healthy.id}/tamper/journal-amount`)).ok,
    ).toBe(true);
    await expect(
      festschreibenRechnung(firma, healthy.id, { akteur }),
    ).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
    expect(await rows("buchungsjournal")).toHaveLength(1);
  });

  it("blocks direct invoice originals, positions, journals and relation deletes", async () => {
    const draft = await createRechnung(firma, input(), { akteur });
    const done = await festschreibenRechnung(firma, draft.id, { akteur });
    await expect(
      createRecord("rechnungspositionen", {
        firma,
        rechnung: draft.id,
        sortierung: 2,
        bezeichnung: "bypass",
        menge: "1",
        einzelpreis: "1.00",
        betrag_netto: "1.00",
        betrag_ust: "0.00",
        betrag_brutto: "1.00",
      }),
    ).rejects.toThrow();
    await expect(
      createRecord("buchungsjournal", {
        firma,
        laufende_nr: 99,
        buchungsdatum: date,
        belegdatum: date,
        buchungstext: "bypass",
        richtung: "einnahme",
        betrag_netto: "1.00",
        betrag_ust: "0.00",
        betrag_brutto: "1.00",
        quelle_typ: "rechnung",
        quelle_id: draft.id,
        festgeschrieben_am: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    await expect(deleteRecord("kontakte", kunde)).rejects.toThrow();
    await expect(deleteRecord("firmen", firma)).rejects.toThrow();
    expect((await getRechnungMitPositionen(firma, draft.id))!.pdf).toBe(
      done.rechnung.pdf,
    );
    expect(await rows("buchungsjournal")).toHaveLength(1);
  });

  it("detects customer, company, layout, logo and bank changes during preparation", async () => {
    for (const mode of ["kunde", "firma", "layout", "bank", "logo"] as const) {
      const draft = await createRechnung(firma, input(mode), { akteur });
      let changed = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        if (String(url).endsWith("/rechnung/festschreiben") && !changed) {
          changed = true;
          if (mode === "kunde") {
            await updateRecord("kontakte", kunde, { ort: "Neu" });
          } else if (mode === "firma") {
            await updateRecord("firmen", firma, { ort: "Neu" });
          } else if (mode === "layout") {
            await updateRecord("firmen", firma, {
              dokument_kopftext: "Geändert nach PDF-Erzeugung",
            });
          } else if (mode === "logo") {
            expect(
              (await internal(`tp022/rechnung/${draft.id}/tamper/logo`)).ok,
            ).toBe(true);
          } else {
            await createRecord("bankkonten", {
              firma,
              name: "A Bank",
              iban: "DE89370400440532013000",
              aktiv: true,
            });
          }
        }
        return realFetch(url, init);
      });
      await expect(
        festschreibenRechnung(firma, draft.id, { akteur }),
      ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
      vi.restoreAllMocks();
      if (mode === "kunde") await updateRecord("kontakte", kunde, { ort: "" });
      if (mode === "firma") await updateRecord("firmen", firma, { ort: "" });
      if (mode === "layout") {
        await updateRecord("firmen", firma, { dokument_kopftext: "" });
      }
    }
    expect(await rows("buchungsjournal")).toHaveLength(0);
  });
});
