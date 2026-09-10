import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Beleg } from "@/modules/expenses/types";
import type { JournalEintrag } from "@/modules/journal/types";
import type { RcSnapshot } from "@/modules/expenses/reverse-charge";

const mocks = vi.hoisted(() => ({
  getJournalEintrag: vi.fn(),
  getBelegDateiResponse: vi.fn(),
  listBelege: vi.fn(),
  listJournal: vi.fn(),
  listRcJournal: vi.fn(),
}));

vi.mock("@/modules/journal/repository", () => ({
  getJournalEintrag: mocks.getJournalEintrag,
  listJournal: mocks.listJournal,
  listRcJournal: mocks.listRcJournal,
}));

vi.mock("@/modules/expenses/repository", () => ({
  getBelegDateiResponse: mocks.getBelegDateiResponse,
  listBelege: mocks.listBelege,
  listBelegeByIds: vi.fn(),
}));

import {
  exportBelegArchivZip,
  listFestgeschriebeneBelegeInZeitraum,
  listJournalInZeitraum,
  listUstJournalInZeitraum,
  resolveStornoOriginale,
} from "./repository";

function journalEintrag(n: number): JournalEintrag {
  return {
    id: `journal-${n}`,
    firma: "firma-1",
    laufende_nr: n,
    buchungsdatum: "2026-01-01",
    belegdatum: "2026-01-01",
    buchungstext: `Buchung ${n}`,
    richtung: "ausgabe",
    betrag_netto: "1.00",
    betrag_ust: "0.00",
    betrag_brutto: "1.00",
    steuersatz: "0",
    konto: "4900",
    kontakt: null,
    quelle_typ: "manuell",
    quelle_id: "",
    storno_von: null,
    festgeschrieben_am: "2026-01-01T00:00:00.000Z",
  };
}

function beleg(n: number): Beleg {
  return {
    id: `beleg-${n}`,
    firma: "firma-1",
    belegdatum: "2026-01-01",
    buchungsdatum: "2026-01-01",
    richtung: "ausgabe",
    lieferant: null,
    kunde: null,
    betrag_netto: "1.00",
    betrag_ust: "0.00",
    betrag_brutto: "1.00",
    steuersatz: "0",
    kategorie: "Betriebsausgabe",
    notiz: `Beleg ${n}`,
    konto: "4900",
    status: "festgeschrieben",
    datei: [],
    belegnummer: `B-${n}`,
    journal_eintrag: `journal-${n}`,
    festgeschrieben_am: "2026-01-01T00:00:00.000Z",
  };
}

function rc(): RcSnapshot {
  return {
    version: 1,
    tatbestand: "drittland_dienstleistung",
    waehrung: "EUR",
    satz: "19",
    abzug: "ausgeschlossen",
    steuermodus: "regelbesteuerung_ist",
    modus_bestaetigt: true,
    leistung_von: "2026-01-01",
    leistung_bis: "2026-01-31",
    leistungsabschnitt_bestaetigt: true,
    zahlungsstatus: "bezahlt",
    zahlungsdatum: "2026-02-10",
    zahlungsbetrag: "19.33",
    eine_zahlung: true,
    vorgang: "rc-archiv",
    bereits_erklaert: false,
    nachweis: "Synthetischer Archivtest",
    grundlage: "19.33",
    schuld: "3.67",
    vorsteuer: "0.00",
    steuerdatum: "2026-01-31",
    zeitregel: "drittland_folgemonat",
  };
}

describe("Export-Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([10_000, 10_001])(
    "liest alle %i Journalzeilen an und oberhalb der bisherigen Grenze",
    async (totalItems) => {
      mocks.listJournal.mockImplementation(
        async (_firmaId, _filter, page: number, perPage: number) => {
          const start = (page - 1) * perPage;
          const end = Math.min(start + perPage, totalItems);
          return {
            items: Array.from(
              { length: Math.max(0, end - start) },
              (_, index) => journalEintrag(start + index + 1),
            ),
            page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          };
        },
      );

      const result = await listJournalInZeitraum("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      });

      expect(result).toHaveLength(totalItems);
      expect(result.at(-1)?.id).toBe(`journal-${totalItems}`);
    },
  );

  it("vereinigt vollständig paginierte Buchungs- und RC-Steuerdatumsabfragen ohne Doppelzählung", async () => {
    const normal = [journalEintrag(1), journalEintrag(2)];
    const rcItems = Array.from({ length: 401 }, (_, index) => ({
      ...journalEintrag(index + 2),
      rc_steuerdatum: "2026-01-15",
    }));
    mocks.listJournal.mockResolvedValue({
      items: normal,
      page: 1,
      perPage: 200,
      totalItems: 2,
      totalPages: 1,
    });
    mocks.listRcJournal.mockImplementation(
      async (_firmaId, _zeitraum, page: number, perPage: number) => {
        const start = (page - 1) * perPage;
        return {
          items: rcItems.slice(start, start + perPage),
          page,
          perPage,
          totalItems: rcItems.length,
          totalPages: Math.ceil(rcItems.length / perPage),
        };
      },
    );

    const result = await listUstJournalInZeitraum("firma-1", {
      von: "2026-01-01",
      bis: "2026-01-31",
    });

    expect(result).toHaveLength(402);
    expect(result.filter((item) => item.id === "journal-2")).toHaveLength(1);
    expect(mocks.listRcJournal).toHaveBeenCalledTimes(3);
    expect(mocks.listRcJournal).toHaveBeenCalledWith(
      "firma-1",
      { von: "2026-01-01", bis: "2026-01-31" },
      1,
      200,
    );
  });

  it("lädt ein periodenfremdes Storno-Original firmengebunden nur als Kontext", async () => {
    const storno = {
      ...journalEintrag(2),
      storno_von: "journal-original",
      quelle_typ: "storno" as const,
    };
    const original = { ...journalEintrag(1), id: "journal-original" };
    mocks.getJournalEintrag.mockResolvedValue(original);

    const result = await resolveStornoOriginale("firma-1", [storno]);

    expect(mocks.getJournalEintrag).toHaveBeenCalledWith("firma-1", "journal-original");
    expect(result).toEqual([original]);
  });

  it("bricht ab, wenn sich die Journalmenge während des Exports ändert", async () => {
    mocks.listJournal
      .mockResolvedValueOnce({
        items: Array.from({ length: 200 }, (_, index) =>
          journalEintrag(index + 1),
        ),
        page: 1,
        perPage: 200,
        totalItems: 201,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [journalEintrag(201), journalEintrag(202)],
        page: 2,
        perPage: 200,
        totalItems: 202,
        totalPages: 2,
      });

    await expect(
      listJournalInZeitraum("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      }),
    ).rejects.toThrow(
      "Exportdaten haben sich während des Exports geändert. Bitte Export erneut starten.",
    );
  });

  it("bricht ab, wenn PocketBase vor der gemeldeten Gesamtmenge keine Daten mehr liefert", async () => {
    mocks.listJournal
      .mockResolvedValueOnce({
        items: Array.from({ length: 200 }, (_, index) =>
          journalEintrag(index + 1),
        ),
        page: 1,
        perPage: 200,
        totalItems: 201,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [],
        page: 2,
        perPage: 200,
        totalItems: 201,
        totalPages: 2,
      });

    await expect(
      listJournalInZeitraum("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      }),
    ).rejects.toThrow(
      "Exportdaten konnten nicht vollständig gelesen werden. Bitte Export erneut starten.",
    );
  });

  it("bricht ab, wenn eine verschobene Seite eine Journalzeile doppelt liefert", async () => {
    mocks.listJournal
      .mockResolvedValueOnce({
        items: Array.from({ length: 200 }, (_, index) =>
          journalEintrag(index + 1),
        ),
        page: 1,
        perPage: 200,
        totalItems: 201,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [journalEintrag(200)],
        page: 2,
        perPage: 200,
        totalItems: 201,
        totalPages: 2,
      });

    await expect(
      listJournalInZeitraum("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      }),
    ).rejects.toThrow(
      "Exportdaten konnten nicht vollständig gelesen werden. Bitte Export erneut starten.",
    );
  });

  it.each([5_000, 5_001])(
    "liest alle %i Belege an und oberhalb der bisherigen Grenze",
    async (totalItems) => {
      mocks.listBelege.mockImplementation(
        async (_firmaId, _filter, page: number, perPage: number) => {
          const start = (page - 1) * perPage;
          const end = Math.min(start + perPage, totalItems);
          return {
            items: Array.from(
              { length: Math.max(0, end - start) },
              (_, index) => beleg(start + index + 1),
            ),
            page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          };
        },
      );

      const result = await listFestgeschriebeneBelegeInZeitraum("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      });

      expect(result).toHaveLength(totalItems);
      expect(result.at(-1)?.id).toBe(`beleg-${totalItems}`);
    },
  );

  it("liefert kein Belegarchiv aus, wenn eine referenzierte Datei fehlt", async () => {
    const item = {
      ...beleg(1),
      belegnummer: "B-0001",
      datei: ["original.pdf"],
    };
    mocks.listBelege.mockResolvedValue({
      items: [item],
      page: 1,
      perPage: 100,
      totalItems: 1,
      totalPages: 1,
    });
    mocks.getBelegDateiResponse.mockRejectedValue(
      new Error("Datei nicht ladbar (404)."),
    );

    await expect(
      exportBelegArchivZip("firma-1", {
        von: "2026-01-01",
        bis: "2026-12-31",
      }),
    ).rejects.toThrow(
      'Belegarchiv unvollständig: Datei "original.pdf" von Beleg B-0001 konnte nicht geladen werden.',
    );
  });

  it("bricht vor dem ZIP-Aufbau ab, wenn die Dateinutzlast die Speichergrenze überschreitet", async () => {
    const item = { ...beleg(1), datei: ["original.pdf"] };
    mocks.listBelege.mockResolvedValue({
      items: [item],
      page: 1,
      perPage: 100,
      totalItems: 1,
      totalPages: 1,
    });
    mocks.getBelegDateiResponse.mockResolvedValue({
      response: new Response(new Uint8Array([1, 2, 3, 4])),
      filename: "original.pdf",
      beleg: item,
    });

    await expect(
      exportBelegArchivZip(
        "firma-1",
        { von: "2026-01-01", bis: "2026-12-31" },
        { maxDateiBytes: 3 },
      ),
    ).rejects.toThrow(
      "Belegarchiv ist für die aktuelle Erzeugung im Arbeitsspeicher zu groß. Bitte Zeitraum verkleinern.",
    );
  });

  it("erzeugt das Archiv an der exakten Speichergrenze", async () => {
    const item = { ...beleg(1), datei: ["original.pdf"] };
    mocks.listBelege.mockResolvedValue({
      items: [item],
      page: 1,
      perPage: 100,
      totalItems: 1,
      totalPages: 1,
    });
    mocks.getBelegDateiResponse.mockResolvedValue({
      response: new Response(new Uint8Array([1, 2, 3, 4])),
      filename: "original.pdf",
      beleg: item,
    });

    const result = await exportBelegArchivZip(
      "firma-1",
      { von: "2026-01-01", bis: "2026-12-31" },
      { maxDateiBytes: 4 },
    );

    expect(result.anzahl).toBe(1);
    expect(result.bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });

  it("erzeugt ein vollständiges Archiv für einen Beleg ohne Datei", async () => {
    mocks.listBelege.mockResolvedValue({
      items: [beleg(1)],
      page: 1,
      perPage: 100,
      totalItems: 1,
      totalPages: 1,
    });

    const result = await exportBelegArchivZip("firma-1", {
      von: "2026-01-01",
      bis: "2026-12-31",
    });

    expect(result.anzahl).toBe(1);
    expect(result.bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    expect(mocks.getBelegDateiResponse).not.toHaveBeenCalled();
  });

  it("nimmt die vollständigen RC-Metadaten ins Belegarchiv auf", async () => {
    mocks.listBelege.mockResolvedValue({
      items: [{ ...beleg(1), rc: rc(), rc_steuerdatum: "2026-01-31", rc_vorgang: "rc-archiv" }],
      page: 1,
      perPage: 100,
      totalItems: 1,
      totalPages: 1,
    });

    const result = await exportBelegArchivZip("firma-1", {
      von: "2026-01-01",
      bis: "2026-01-31",
    });
    const raw = new TextDecoder().decode(result.bytes);
    expect(raw).toContain("rc_steuerdatum;rc_vorgang;rc_tatbestand");
    expect(raw).toContain("drittland_dienstleistung;19;19,33;3,67;0,00");
    expect(raw).toContain("Synthetischer Archivtest");
  });
});
