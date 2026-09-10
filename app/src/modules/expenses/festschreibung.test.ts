import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pb from "@/lib/pb";
import * as finanz from "@/lib/finanz-transaktion";
import { deleteBeleg, festschreibenBeleg, updateBeleg } from "./repository";
import { EINNAHME_LIEFERANT_ERROR, FESTGESCHRIEBEN_ERROR } from "./invariants";
import type { Beleg } from "./types";

vi.mock("@/lib/pb", async (importOriginal) => ({
  ...await importOriginal<typeof pb>(),
  getRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  createRecord: vi.fn(),
  allocateBelegnummer: vi.fn(),
  listRecords: vi.fn(),
}));

vi.mock("@/lib/finanz-transaktion", async (importOriginal) => ({
  ...await importOriginal<typeof finanz>(),
  finanzAkteur: vi.fn(), belegFestschreiben: vi.fn(),
}));

function fixture(over: Partial<Beleg> = {}): Beleg {
  return {
    id: "beleg1", firma: "firma1", richtung: "einnahme",
    belegdatum: "2026-08-01", buchungsdatum: "2026-08-02",
    lieferant: null, kunde: "kunde1",
    betrag_netto: "100.00", betrag_ust: "19.00", betrag_brutto: "119.00",
    steuersatz: "19", kategorie: "Testkategorie", notiz: "Synthetischer Beleg",
    konto: "8400", status: "entwurf", datei: [],
    belegnummer: "", journal_eintrag: null, festgeschrieben_am: "",
    ...over,
  };
}

beforeEach(() => { vi.resetAllMocks(); vi.mocked(finanz.finanzAkteur).mockResolvedValue("akteur1"); });

function expectNoWrites() {
  for (const write of [pb.updateRecord, pb.deleteRecord, pb.createRecord, pb.allocateBelegnummer]) {
    expect(write).not.toHaveBeenCalled();
  }
}

describe("TP-021: heutige Belegpfade erhalten festgeschriebene Kontakte", () => {
  it.each([
    { kunde: "kunde1", lieferant: null },
    { kunde: null, lieferant: "lieferant1" },
    { kunde: null, lieferant: null },
  ])("blockiert Kontaktänderung, Löschen und unvollständigen Altabschluss: %j", async (partner) => {
    const beleg = fixture({ ...partner, status: "festgeschrieben", journal_eintrag: "journal1" });
    vi.mocked(pb.getRecord).mockResolvedValue(beleg);
    await expect(updateBeleg("firma1", beleg.id, fixture({ kunde: "kunde2" })))
      .rejects.toThrow(FESTGESCHRIEBEN_ERROR);
    await expect(deleteBeleg("firma1", beleg.id)).rejects.toThrow(FESTGESCHRIEBEN_ERROR);
    await expect(festschreibenBeleg("firma1", beleg.id)).rejects.toMatchObject({ code: "INCONSISTENT_STATE" });
    expectNoWrites();
  });

  it("leert einen alten Einnahme-Lieferanten bei Festschreibung nicht still", async () => {
    const beleg = fixture({ kunde: null, lieferant: "lieferant1" });
    vi.mocked(pb.getRecord).mockResolvedValue(beleg);
    await expect(festschreibenBeleg("firma1", beleg.id)).rejects.toThrow(EINNAHME_LIEFERANT_ERROR);
    expectNoWrites();
  });

  it("blockiert Festschreibung eines Entwurfs mit vorhandenem Journal", async () => {
    vi.mocked(pb.getRecord).mockResolvedValue(fixture({ journal_eintrag: "journal1" }));
    await expect(festschreibenBeleg("firma1", "beleg1")).rejects.toThrow("bereits mit einem Journal");
    expectNoWrites();
  });

  it.each([
    { richtung: "einnahme" as const, kunde: "kunde1", lieferant: null },
    { richtung: "ausgabe" as const, kunde: null, lieferant: "lieferant1" },
    { richtung: "einnahme" as const, kunde: null, lieferant: null },
  ])("persistiert denselben Kontakt in Beleg und Journal: %j", async (partner) => {
    const beleg = fixture(partner);
    vi.mocked(pb.getRecord).mockResolvedValue(beleg);
    const kontakt = partner.richtung === "einnahme" ? partner.kunde : partner.lieferant;
    const finished = { ...beleg, status: "festgeschrieben" as const, belegnummer: "B-001", journal_eintrag: "journal1", festgeschrieben_am: "2026-08-02T10:00:00.000Z" };
    const response = { result: "committed", belegId: beleg.id, belegnummer: "B-001", journalId: "journal1", journalnummer: 1, festgeschriebenAm: finished.festgeschrieben_am, beleg: finished, journal: { id: "journal1", kontakt } };
    vi.mocked(finanz.belegFestschreiben).mockResolvedValue(response as finanz.BelegQuittung);
    const result = await festschreibenBeleg("firma1", beleg.id);
    expect(result.journal.kontakt).toBe(kontakt);
    expect(result.beleg).toEqual(finished);
    expect(finanz.belegFestschreiben).toHaveBeenCalledExactlyOnceWith({ firma: "firma1", akteur: "akteur1", id: beleg.id, expected: finanz.belegProjektion(beleg) });
    expectNoWrites();
  });
});
