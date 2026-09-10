import { describe, expect, it } from "vitest";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  OHNE_KATEGORIE_LABEL,
  WEITERE_KATEGORIE_KEY,
  buildAusgabenNachKategorien,
  buildFaelligkeiten,
  buildLetzteBuchungen,
  buildMonatlicheReihe,
  hrefFuerJournalQuelle,
  monatKategorienLabel,
  quartalKategorienLabel,
  sammelnKategorieQuelleIds,
} from "./uebersicht";

function je(
  partial: Partial<JournalEintrag> &
    Pick<JournalEintrag, "richtung" | "betrag_brutto">,
): JournalEintrag {
  return {
    id: partial.id ?? "x",
    firma: "f1",
    laufende_nr: partial.laufende_nr ?? 1,
    buchungsdatum: partial.buchungsdatum ?? "2026-08-10",
    belegdatum: partial.belegdatum ?? "2026-08-10",
    buchungstext: partial.buchungstext ?? "Test",
    richtung: partial.richtung,
    betrag_netto: partial.betrag_netto ?? partial.betrag_brutto,
    betrag_ust: partial.betrag_ust ?? "0.00",
    betrag_brutto: partial.betrag_brutto,
    steuersatz: partial.steuersatz ?? "",
    konto: partial.konto ?? "",
    kontakt: null,
    quelle_typ: partial.quelle_typ ?? "manuell",
    quelle_id: partial.quelle_id ?? "",
    storno_von: partial.storno_von ?? null,
    festgeschrieben_am: "2026-08-10T10:00:00.000Z",
  };
}

describe("buildMonatlicheReihe", () => {
  it("bildet 12 Monate und zählt Zufluss, nicht die Forderungsbuchung", () => {
    const reihe = buildMonatlicheReihe(
      [
        je({
          id: "r",
          richtung: "einnahme",
          betrag_brutto: "900.00",
          quelle_typ: "rechnung",
          buchungsdatum: "2026-03-02",
        }),
        je({
          id: "z",
          richtung: "einnahme",
          betrag_brutto: "120.00",
          quelle_typ: "zahlung",
          buchungsdatum: "2026-03-15",
        }),
        je({
          id: "b",
          richtung: "ausgabe",
          betrag_brutto: "40.00",
          quelle_typ: "beleg",
          buchungsdatum: "2026-03-20",
        }),
      ],
      { von: "2025-09-01", bis: "2026-08-31" },
    );
    expect(reihe).toHaveLength(12);
    expect(reihe[0].key).toBe("2025-09");
    expect(reihe[11].key).toBe("2026-08");
    const maerz = reihe.find((m) => m.key === "2026-03");
    expect(maerz?.einnahmen_brutto).toBe("120.00");
    expect(maerz?.ausgaben_brutto).toBe("40.00");
    expect(maerz?.ueberschuss_brutto).toBe("80.00");
    const jan = reihe.find((m) => m.key === "2026-01");
    expect(jan?.einnahmen_brutto).toBe("0.00");
  });

  it("mindert den Ursprungsmonat nicht — Storno zählt im Buchungsmonat", () => {
    const reihe = buildMonatlicheReihe(
      [
        je({
          id: "z1",
          richtung: "einnahme",
          betrag_brutto: "80.00",
          quelle_typ: "zahlung",
          buchungsdatum: "2026-01-10",
        }),
        je({
          id: "s1",
          richtung: "ausgabe",
          betrag_brutto: "80.00",
          quelle_typ: "storno",
          storno_von: "z1",
          buchungsdatum: "2026-02-03",
        }),
      ],
      { von: "2026-01-01", bis: "2026-02-28" },
    );
    expect(reihe.find((m) => m.key === "2026-01")?.einnahmen_brutto).toBe(
      "80.00",
    );
    expect(reihe.find((m) => m.key === "2026-02")?.einnahmen_brutto).toBe(
      "-80.00",
    );
    expect(reihe.find((m) => m.key === "2026-02")?.ueberschuss_brutto).toBe(
      "-80.00",
    );
  });
});

describe("buildFaelligkeiten", () => {
  const basis = {
    rechnungId: "a",
    rechnungsnummer: "R-1",
    kundeName: "Müller",
    offen: "10.00",
    status: "offen",
    faellig_am: "2026-08-17",
  };

  it("trennt überfällig und die nächsten 14 Tage", () => {
    const b = buildFaelligkeiten(
      [
        { ...basis, rechnungId: "1", rechnungsnummer: "R-alt", faellig_am: "2026-08-01", status: "ueberfaellig" },
        { ...basis, rechnungId: "2", rechnungsnummer: "R-heute", faellig_am: "2026-08-17" },
        { ...basis, rechnungId: "3", rechnungsnummer: "R-bald", faellig_am: "2026-08-31" },
        { ...basis, rechnungId: "4", rechnungsnummer: "R-spaet", faellig_am: "2026-09-01" },
      ],
      "2026-08-17",
      14,
    );
    expect(b.horizon_bis).toBe("2026-08-31");
    expect(b.ueberfaellig.map((e) => e.rechnungsnummer)).toEqual(["R-alt"]);
    expect(b.ueberfaellig[0].tage_verzug).toBe(16);
    expect(b.bald.map((e) => e.rechnungsnummer)).toEqual(["R-heute", "R-bald"]);
  });

  it("ordnet Überfällige ohne Datum in die Überfällig-Liste", () => {
    const b = buildFaelligkeiten(
      [
        {
          ...basis,
          rechnungId: "x",
          rechnungsnummer: "R-x",
          faellig_am: "",
          status: "ueberfaellig",
        },
      ],
      "2026-08-17",
    );
    expect(b.ueberfaellig).toHaveLength(1);
    expect(b.ueberfaellig[0].tage_verzug).toBe(0);
    expect(b.bald).toHaveLength(0);
  });
});

describe("buildAusgabenNachKategorien", () => {
  const snaps = {
    beleg: new Map([
      ["b-buero", "Büro"],
      ["b-reise", "Reise"],
      ["b-leer", ""],
      ["b-a", "A"],
      ["b-b", "B"],
      ["b-c", "C"],
      ["b-d", "D"],
      ["b-e", "E"],
      ["b-f", "F"],
    ]),
    kasse: new Map([["k-bar", "Barausgabe"]]),
  };

  it("nimmt den Schnappschuss am Beleg und an der Kasse, nicht das Journal", () => {
    const blick = buildAusgabenNachKategorien(
      [
        je({
          id: "1",
          richtung: "ausgabe",
          betrag_brutto: "40.00",
          quelle_typ: "beleg",
          quelle_id: "b-buero",
        }),
        je({
          id: "2",
          richtung: "ausgabe",
          betrag_brutto: "10.00",
          quelle_typ: "kasse",
          quelle_id: "k-bar",
        }),
      ],
      { von: "2026-08-01", bis: "2026-08-31" },
      snaps,
    );
    expect(blick.zeilen.map((z) => z.label)).toEqual(["Büro", "Barausgabe"]);
    expect(blick.zeilen[0].summe_brutto).toBe("40.00");
    expect(blick.summe_brutto).toBe("50.00");
    expect(blick.anzahl).toBe(2);
  });

  it("nennt leeren Schnappschuss ehrlich ohne Kategorie", () => {
    const blick = buildAusgabenNachKategorien(
      [
        je({
          richtung: "ausgabe",
          betrag_brutto: "12.00",
          quelle_typ: "beleg",
          quelle_id: "b-leer",
        }),
        je({
          id: "y",
          richtung: "ausgabe",
          betrag_brutto: "8.00",
          quelle_typ: "beleg",
          quelle_id: "fehlt",
        }),
      ],
      { von: "2026-08-01", bis: "2026-08-31" },
      snaps,
    );
    expect(blick.zeilen).toHaveLength(1);
    expect(blick.zeilen[0].label).toBe(OHNE_KATEGORIE_LABEL);
    expect(blick.zeilen[0].summe_brutto).toBe("20.00");
  });

  it("zählt nur Ausgaben; Einnahmen und manuelle Zeilen bleiben außen", () => {
    const blick = buildAusgabenNachKategorien(
      [
        je({
          id: "ein",
          richtung: "einnahme",
          betrag_brutto: "90.00",
          quelle_typ: "beleg",
          quelle_id: "b-buero",
        }),
        je({
          id: "man",
          richtung: "ausgabe",
          betrag_brutto: "15.00",
          quelle_typ: "manuell",
        }),
        je({
          id: "zahl",
          richtung: "einnahme",
          betrag_brutto: "100.00",
          quelle_typ: "zahlung",
        }),
        je({
          id: "aus",
          richtung: "ausgabe",
          betrag_brutto: "7.00",
          quelle_typ: "beleg",
          quelle_id: "b-reise",
        }),
      ],
      { von: "2026-08-01", bis: "2026-08-31" },
      snaps,
    );
    expect(blick.zeilen.map((z) => z.label)).toEqual(["Reise"]);
    expect(blick.summe_brutto).toBe("7.00");
  });

  it("mindert die Ursprungskategorie bei Storno", () => {
    const original = je({
      id: "orig",
      richtung: "ausgabe",
      betrag_brutto: "50.00",
      quelle_typ: "beleg",
      quelle_id: "b-buero",
      buchungsdatum: "2026-07-10",
    });
    const blick = buildAusgabenNachKategorien(
      [
        je({
          id: "b1",
          richtung: "ausgabe",
          betrag_brutto: "50.00",
          quelle_typ: "beleg",
          quelle_id: "b-buero",
        }),
        je({
          id: "s1",
          richtung: "einnahme",
          betrag_brutto: "20.00",
          quelle_typ: "storno",
          storno_von: "orig",
        }),
      ],
      { von: "2026-08-01", bis: "2026-08-31" },
      snaps,
      [original],
    );
    expect(blick.zeilen[0].label).toBe("Büro");
    expect(blick.zeilen[0].summe_brutto).toBe("30.00");
  });

  it("packt den Rest nach den Top 5 in Weitere", () => {
    const items = ["a", "b", "c", "d", "e", "f"].map((k, i) =>
      je({
        id: k,
        richtung: "ausgabe",
        betrag_brutto: String(60 - i * 10) + ".00",
        quelle_typ: "beleg",
        quelle_id: `b-${k}`,
      }),
    );
    const blick = buildAusgabenNachKategorien(
      items,
      { von: "2026-08-01", bis: "2026-08-31" },
      snaps,
    );
    expect(blick.zeilen.map((z) => z.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "Weitere",
    ]);
    expect(blick.zeilen[5].key).toBe(WEITERE_KATEGORIE_KEY);
    expect(blick.zeilen[5].summe_brutto).toBe("10.00");
    expect(blick.summe_brutto).toBe("210.00");
  });

  it("sammelt nur Beleg- und Kassen-IDs der Ausgaben", () => {
    const ids = sammelnKategorieQuelleIds([
      je({
        richtung: "ausgabe",
        betrag_brutto: "1.00",
        quelle_typ: "beleg",
        quelle_id: "b-buero",
      }),
      je({
        id: "k",
        richtung: "ausgabe",
        betrag_brutto: "1.00",
        quelle_typ: "kasse",
        quelle_id: "k-bar",
      }),
      je({
        id: "ein",
        richtung: "einnahme",
        betrag_brutto: "1.00",
        quelle_typ: "beleg",
        quelle_id: "b-reise",
      }),
    ]);
    expect(ids.beleg).toEqual(["b-buero"]);
    expect(ids.kasse).toEqual(["k-bar"]);
  });
});

describe("kategorie labels", () => {
  it("benennt Monat und Quartal auf de-DE", () => {
    expect(monatKategorienLabel({ von: "2026-08-01", bis: "2026-08-31" })).toBe(
      "August 2026",
    );
    expect(
      quartalKategorienLabel({ von: "2026-07-01", bis: "2026-09-30" }),
    ).toBe("3. Quartal 2026");
  });
});

describe("buildLetzteBuchungen", () => {
  it("nimmt die ersten Zeilen und verlinkt den bestehenden Datensatz", () => {
    const items = [
      je({
        id: "j1",
        richtung: "ausgabe",
        betrag_brutto: "12.00",
        quelle_typ: "beleg",
        quelle_id: "b1",
        buchungstext: "Papier",
      }),
      je({
        id: "j2",
        richtung: "einnahme",
        betrag_brutto: "80.00",
        quelle_typ: "zahlung",
        quelle_id: "z1",
        buchungstext: "Zahlung R-1",
      }),
      je({
        id: "j3",
        richtung: "einnahme",
        betrag_brutto: "80.00",
        quelle_typ: "rechnung",
        quelle_id: "r1",
      }),
      je({
        id: "j4",
        richtung: "ausgabe",
        betrag_brutto: "5.00",
        quelle_typ: "kasse",
        quelle_id: "k1",
      }),
    ];
    const letzte = buildLetzteBuchungen(items, 3);
    expect(letzte).toHaveLength(3);
    expect(letzte[0].href).toBe("/app/belege/b1");
    expect(letzte[1].href).toBe("/app/journal/j2");
    expect(letzte[2].href).toBe("/app/rechnungen/r1");
    expect(hrefFuerJournalQuelle(items[3])).toBe("/app/kassenbuch/k1");
  });
});
