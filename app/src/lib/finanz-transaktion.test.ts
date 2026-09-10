import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  belegFestschreiben,
  kasseStornieren,
  nummernkreisVergeben,
  type BelegQuittung,
  type KasseStornoQuittung,
} from "./finanz-transaktion";
vi.mock("./pb", () => ({ getAdminToken: vi.fn(async () => "synthetic-token") }));
const input = { firma: "firma1", akteur: "akteur1", id: "beleg1", expected: { notiz: "Synthetic" } };
const receipt: BelegQuittung = { result: "replayed", belegId: "beleg1", belegnummer: "B-0001", journalId: "journal1", journalnummer: 1, festgeschriebenAm: "2026-09-05T12:00:00.000Z" };
const stornoInput = {
  firma: "firma1",
  akteur: "akteur1",
  id: "cashoriginal001",
  expected: { text: "Synthetic" },
  values: { text: "Storno Synthetic" },
};
const stornoReceipt: KasseStornoQuittung = {
  result: "replayed",
  originalId: "cashoriginal001",
  eintragId: "cashstorno00001",
  belegnummer: "K-0002",
  journalId: "cashjournal0002",
  journalnummer: 2,
  festgeschriebenAm: "2026-09-06T12:00:00.000Z",
};
beforeEach(() => vi.stubEnv("PB_URL", "http://127.0.0.1:1"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("Finanz transport", () => {
  it("retries an unknown commit with identical source, actor and projection", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(Response.json(receipt));
    expect(await belegFestschreiben(input)).toEqual(receipt);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]?.body).toBe(fetch.mock.calls[1][1]?.body);
  });
  it.each(["SOURCE_CHANGED", "NUMBER_CHANGED", "INVALID_STATE", "INCONSISTENT_STATE", "FORBIDDEN", "NOT_FOUND", "MUTATION_FORBIDDEN"])("does not retry a definite %s", async code => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: { finanz: { code } } }, { status: 400 }));
    await expect(belegFestschreiben(input)).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("stops after two unknown outcomes", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(belegFestschreiben(input)).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("missing hooks fail explicitly without legacy CRUD fallback", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(belegFestschreiben(input)).rejects.toMatchObject({ code: "OPERATION_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("malformed success is unknown, never a fabricated receipt", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ ...receipt, belegId: "other" }));
    await expect(belegFestschreiben(input)).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
  });
  it("retries a Kassenstorno with the byte-identical source projection", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(Response.json(stornoReceipt));
    expect(await kasseStornieren(stornoInput)).toEqual(stornoReceipt);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]?.body).toBe(fetch.mock.calls[1][1]?.body);
  });
  it("rejects a malformed Kassenstorno receipt without a new record id", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ ...stornoReceipt, eintragId: "" }));
    await expect(kasseStornieren(stornoInput)).rejects.toMatchObject({
      code: "COMMIT_UNKNOWN",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("transitional allocators do not retry a lost answer", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("response lost"));
    await expect(nummernkreisVergeben("firma1", "angebot")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
