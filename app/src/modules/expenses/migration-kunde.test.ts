import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { belegPartnerId } from "./invariants";
import type { Beleg } from "./types";

// TP-021: Charakterisierung der unveränderten historischen Migration.
// Die dokumentierte Kontaktlöschung ist ein Befund, kein gewünschtes Verhalten.
// Kein PocketBase, keine Verbindung zu einem realen Datenbestand.
const source = readFileSync(
  new URL("../../../../pocketbase/pb_migrations/1730002600_belege_kunde.js", import.meta.url),
  "utf8",
);

function fixture(over: Partial<Beleg> = {}): Beleg {
  return {
    id: "beleg1", firma: "firma1", richtung: "einnahme",
    belegdatum: "2026-08-01", buchungsdatum: "2026-08-02",
    lieferant: "kontakt1", kunde: null,
    betrag_netto: "100.00", betrag_ust: "19.00", betrag_brutto: "119.00",
    steuersatz: "19", kategorie: "Testkategorie", notiz: "Synthetischer Beleg",
    konto: "8400", status: "entwurf", datei: ["test.pdf"],
    belegnummer: "", journal_eintrag: null, festgeschrieben_am: "",
    ...over,
  };
}

function harness(beleg: Beleg, role: boolean | "missing", hasKunde = true) {
  const fields = hasKunde ? [{ name: "kunde" }] : [];
  const collection = { id: "belege", fields };
  const saved: unknown[] = [];
  const record = {
    get: (key: keyof Beleg): unknown => beleg[key],
    set: (key: string, value: unknown) => Object.assign(beleg, { [key]: value }),
  };
  const app = {
    findCollectionByNameOrId: (name: string) => {
      expect(["belege", "kontakte"]).toContain(name);
      return name === "belege" ? collection : { id: "kontakte" };
    },
    findAllRecords: (name: string) => {
      expect(name).toBe("belege");
      return [record];
    },
    findRecordById: (name: string, id: string) => {
      expect(name).toBe("kontakte");
      expect(id).toBe("kontakt1");
      if (role === "missing") throw new Error("Kontaktzugriff fehlgeschlagen");
      return { get: (key: string) => {
        expect(key).toBe("ist_kunde");
        return role;
      } };
    },
    save: (value: unknown) => { saved.push(value); },
  };
  let up: (target: typeof app) => void = () => { throw new Error("Migration nicht geladen"); };
  runInNewContext(source, {
    migrate: (fn: typeof up) => { up = fn; },
    Field: class { constructor(data: object) { Object.assign(this, data); } },
  });
  return { run: () => up(app), saved, fields, record };
}

describe("TP-021: Wirkung von 1730002600 auf isolierte Testdaten", () => {
  for (const status of ["entwurf", "festgeschrieben"] as const) {
    for (const linked of [false, true]) {
      for (const role of [true, false, "missing"] as const) {
        it(`${status}, Journal=${linked}, ist_kunde=${role}`, () => {
          const beleg = fixture({
            status,
            journal_eintrag: linked ? "journal1" : null,
            belegnummer: status === "festgeschrieben" ? "B-001" : "",
            festgeschrieben_am: status === "festgeschrieben" ? "2026-08-02T10:00:00Z" : "",
          });
          // Vor TP-019 übernahm buildJournalInputFromBeleg immer lieferant.
          const journal = linked ? { id: "journal1", kontakt: beleg.lieferant, quelle_id: beleg.id } : null;
          const before = structuredClone({ beleg, journal });
          const test = harness(beleg, role);
          test.run();
          expect(beleg).toEqual({
            ...before.beleg,
            lieferant: "",
            kunde: role === true ? "kontakt1" : null,
          });
          expect(journal).toEqual(before.journal);
          if (journal) {
            expect(belegPartnerId(beleg) === journal.kontakt).toBe(role === true);
          }
          expect(test.saved).toEqual([test.record]);
          const after = structuredClone(beleg);
          test.run();
          expect(beleg).toEqual(after);
          expect(test.saved).toHaveLength(1); // Wiederholung bringt verlorenen Kontakt nicht zurück.
        });
      }
    }
  }

  it.each([
    { richtung: "ausgabe" as const },
    { kunde: "kunde2" }, // Auch ein zusätzlich gesetzter Lieferant bleibt stehen.
    { lieferant: null },
    { lieferant: "" },
  ])("überspringt nicht selektierte Belege: %j", (over) => {
    const beleg = fixture({ status: "festgeschrieben", journal_eintrag: "journal1", ...over });
    const before = structuredClone(beleg);
    const test = harness(beleg, true);
    test.run();
    expect(beleg).toEqual(before);
    expect(test.saved).toHaveLength(0);
  });

  it("legt das optionale Kundenfeld an und verarbeitet den Altbestand", () => {
    const beleg = fixture();
    const test = harness(beleg, true, false);
    test.run();
    expect(test.fields).toEqual([expect.objectContaining({
      name: "kunde", type: "relation", collectionId: "kontakte",
      required: false, maxSelect: 1, cascadeDelete: false,
    })]);
    expect(beleg.kunde).toBe("kontakt1");
    expect(test.saved).toHaveLength(2);
    test.run();
    expect(test.fields).toHaveLength(1);
    expect(test.saved).toHaveLength(2);
  });

  it("normalisiert Relations-Arrays und Leerzeichen", () => {
    const beleg = fixture();
    const test = harness(beleg, true);
    const originalGet = test.record.get;
    test.record.get = (key) => key === "lieferant" ? [" kontakt1 "] :
      key === "kunde" ? [] : originalGet(key);
    test.run();
    expect(beleg.lieferant).toBe("");
    expect(beleg.kunde).toBe("kontakt1");
  });
});
