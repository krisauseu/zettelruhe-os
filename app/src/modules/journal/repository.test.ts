import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listRecords: vi.fn() }));
vi.mock("@/lib/pb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pb")>()),
  listRecords: mocks.listRecords,
}));

import {
  deleteJournalEintrag,
  listRcJournal,
  updateJournalEintrag,
} from "./repository";
import { IMMUTABLE_ERROR } from "./invariants";

describe("repository Immutability-Guard", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updateJournalEintrag wirft immer", async () => {
    await expect(updateJournalEintrag()).rejects.toThrow(IMMUTABLE_ERROR);
  });

  it("deleteJournalEintrag wirft immer", async () => {
    await expect(deleteJournalEintrag()).rejects.toThrow(IMMUTABLE_ERROR);
  });
});

describe("RC-Steuerperiodenfilter", () => {
  it("bindet Firma und gespeichertes Steuerdatum unabhängig vom Buchungsdatum", async () => {
    mocks.listRecords.mockResolvedValue({
      items: [],
      page: 2,
      perPage: 200,
      totalItems: 0,
      totalPages: 0,
    });

    await listRcJournal(
      "firma-sicher",
      { von: "2026-01-01", bis: "2026-03-31" },
      2,
      200,
    );

    const [, options] = mocks.listRecords.mock.calls[0];
    expect(options.filter).toContain('firma="firma-sicher"');
    expect(options.filter).toContain('rc_steuerdatum >= "2026-01-01"');
    expect(options.filter).toContain('rc_steuerdatum <= "2026-03-31"');
    expect(options.filter).not.toContain("buchungsdatum");
    expect(options.sort).toBe("-rc_steuerdatum,-laufende_nr");
  });
});
