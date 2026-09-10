import { describe, expect, it } from "vitest";
import {
  KATEGORIE_RICHTUNG_MISMATCH_ERROR,
  assertKategoriePasstZurRichtung,
} from "@/modules/categories";
import {
  AUSGABE_KUNDE_ERROR,
  assertCanFestschreiben,
  assertEntwurfEditable,
  assertPartnerPasstZurRichtung,
  belegBezeichnungLabel,
  belegPartnerId,
  buildBuchungstextFromBeleg,
  buildJournalInputFromBeleg,
  DATEI_IMMUTABLE_ERROR,
  EINNAHME_LIEFERANT_ERROR,
  FESTGESCHRIEBEN_ERROR,
  isEntwurf,
  isFestgeschrieben,
  assertBelegDateiAnzahl,
  BELEG_DATEI_MAX_ANZAHL,
  normalizeBelegDateiNamen,
  partnerEmptyHintFuerRichtung,
  partnerLabelFuerRichtung,
  partnerSelectFuerRichtung,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";
import type { Beleg } from "./types";

function sampleBeleg(over: Partial<Beleg> = {}): Beleg {
  return {
    id: "b1",
    firma: "f1",
    belegdatum: "2026-08-11",
    buchungsdatum: "2026-08-11",
    richtung: "ausgabe",
    lieferant: null,
    kunde: null,
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuersatz: "19",
    kategorie: "Büro",
    notiz: "Stifte",
    konto: "4930",
    status: "entwurf",
    datei: [],
    belegnummer: "",
    journal_eintrag: null,
    festgeschrieben_am: "",
    ...over,
  };
}

describe("validateBelegInput", () => {
  it("normalisiert Beträge und Default-Buchungsdatum", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "100,00",
      steuersatz: "19",
      kategorie: "Büro",
    });
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("19.00");
    expect(v.betrag_brutto).toBe("119.00");
    expect(v.buchungsdatum).toBe("2026-08-11");
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "11.08.2026",
        richtung: "ausgabe",
        betrag_netto: "10",
      }),
    ).toThrow(/Belegdatum/);
  });

  it("lehnt Nullbetrag ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "2026-08-11",
        richtung: "ausgabe",
        betrag_netto: "0",
      }),
    ).toThrow(/größer als 0/i);
  });

  it("lehnt zu lange Bezeichnung ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "2026-08-11",
        richtung: "ausgabe",
        betrag_netto: "10",
        notiz: "x".repeat(2001),
      }),
    ).toThrow(/Bezeichnung ist zu lang/);
  });

  it("übernimmt eine gesetzte Bezeichnung", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "10",
      notiz: "  Rasensamen und Dünger, Auftrag Müller  ",
    });
    expect(v.notiz).toBe("Rasensamen und Dünger, Auftrag Müller");
  });

  it("erlaubt Beleg ohne Kategorie", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "einnahme",
      betrag_netto: "10",
    });
    expect(v.kategorie).toBe("");
    expect(() =>
      assertKategoriePasstZurRichtung(v.kategorie, v.richtung, "ausgabe"),
    ).not.toThrow();
  });

  it("erlaubt Ausgabe ohne Lieferant:in", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "10",
    });
    expect(v.lieferant).toBe(null);
    expect(v.kunde).toBe(null);
  });

  it("erlaubt Einnahme ohne Kund:in", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "einnahme",
      betrag_netto: "10",
    });
    expect(v.lieferant).toBe(null);
    expect(v.kunde).toBe(null);
  });

  it("nimmt Lieferant:in nur bei Ausgabe", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "10",
      lieferant: "l1",
    });
    expect(v.lieferant).toBe("l1");
    expect(v.kunde).toBe(null);
  });

  it("nimmt Kund:in nur bei Einnahme", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "einnahme",
      betrag_netto: "10",
      kunde: "k1",
    });
    expect(v.kunde).toBe("k1");
    expect(v.lieferant).toBe(null);
  });

  it("lehnt Einnahme mit Lieferant:in ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "2026-08-11",
        richtung: "einnahme",
        betrag_netto: "10",
        lieferant: "l1",
      }),
    ).toThrow(EINNAHME_LIEFERANT_ERROR);
  });

  it("lehnt Ausgabe mit Kund:in ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "2026-08-11",
        richtung: "ausgabe",
        betrag_netto: "10",
        kunde: "k1",
      }),
    ).toThrow(AUSGABE_KUNDE_ERROR);
  });

  it("lehnt Einnahmekategorie bei Ausgabe ab", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "10",
      kategorie: "Gartenpflege",
    });
    expect(() =>
      assertKategoriePasstZurRichtung(v.kategorie, v.richtung, "einnahme"),
    ).toThrow(KATEGORIE_RICHTUNG_MISMATCH_ERROR);
  });

  it("lehnt Ausgabekategorie bei Einnahme ab", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "einnahme",
      betrag_netto: "10",
      kategorie: "Material & Verbrauchsmittel",
    });
    expect(() =>
      assertKategoriePasstZurRichtung(v.kategorie, v.richtung, "ausgabe"),
    ).toThrow(KATEGORIE_RICHTUNG_MISMATCH_ERROR);
  });
});

describe("belegBezeichnungLabel", () => {
  it("nimmt die gespeicherte Bezeichnung", () => {
    expect(belegBezeichnungLabel("  Rasensamen  ")).toBe("Rasensamen");
  });

  it("fällt ohne Text auf Ohne Bezeichnung zurück", () => {
    expect(belegBezeichnungLabel("")).toBe("Ohne Bezeichnung");
    expect(belegBezeichnungLabel("   ")).toBe("Ohne Bezeichnung");
    expect(belegBezeichnungLabel(undefined)).toBe("Ohne Bezeichnung");
  });
});

describe("Entwurf vs. Festschreibung", () => {
  it("erkennt Status", () => {
    expect(isEntwurf(sampleBeleg())).toBe(true);
    expect(isFestgeschrieben(sampleBeleg({ status: "festgeschrieben" }))).toBe(
      true,
    );
  });

  it("blockiert Edit nach Festschreibung", () => {
    expect(() =>
      assertEntwurfEditable(sampleBeleg({ status: "festgeschrieben" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
  });

  it("erlaubt Festschreiben nur für Entwurf ohne Journal", () => {
    expect(() => assertCanFestschreiben(sampleBeleg())).not.toThrow();
    expect(() =>
      assertCanFestschreiben(sampleBeleg({ status: "festgeschrieben" })),
    ).toThrow(/Nur Entwürfe/);
    expect(() =>
      assertCanFestschreiben(sampleBeleg({ journal_eintrag: "j1" })),
    ).toThrow(/verknüpft/);
  });
});

describe("buildJournalInputFromBeleg", () => {
  it("setzt quelle_typ=beleg und Beträge", () => {
    const b = sampleBeleg({ lieferant: "k1" });
    const j = buildJournalInputFromBeleg(b, {
      belegId: "b1",
      belegnummer: "B-0001",
    });
    expect(j.quelle_typ).toBe("beleg");
    expect(j.quelle_id).toBe("b1");
    expect(j.betrag_brutto).toBe("119.00");
    expect(j.kontakt).toBe("k1");
    expect(j.buchungstext).toMatch(/B-0001/);
    expect(j.buchungstext).toMatch(/Büro/);
  });

  it("nimmt bei Einnahme die Kund:in als Journal-Kontakt", () => {
    const b = sampleBeleg({
      richtung: "einnahme",
      kunde: "c1",
      lieferant: null,
    });
    const j = buildJournalInputFromBeleg(b, {
      belegId: "b1",
      belegnummer: "B-0002",
    });
    expect(j.kontakt).toBe("c1");
    expect(j.richtung).toBe("einnahme");
  });
});

const LIEFERANTEN = [
  { id: "l1", name: "Baustoffhandel Müller" },
  { id: "l2", name: "Bürobedarf Schmidt" },
];
const KUNDEN = [
  { id: "k1", name: "Stadtwerke GmbH" },
  { id: "k2", name: "Familie Berger" },
];

describe("partnerSelectFuerRichtung", () => {
  it("zeigt bei Ausgabe das Feld Lieferant:in", () => {
    const s = partnerSelectFuerRichtung(LIEFERANTEN, KUNDEN, "ausgabe");
    expect(s.label).toBe("Lieferant:in");
    expect(s.fieldName).toBe("lieferant");
    expect(partnerLabelFuerRichtung("ausgabe")).toBe("Lieferant:in");
  });

  it("zeigt bei Ausgabe nur Lieferant:innen", () => {
    const s = partnerSelectFuerRichtung(LIEFERANTEN, KUNDEN, "ausgabe");
    expect(s.items.map((i) => i.name)).toEqual([
      "Baustoffhandel Müller",
      "Bürobedarf Schmidt",
    ]);
    expect(s.items.map((i) => i.id)).not.toContain("k1");
  });

  it("zeigt bei Einnahme das Feld Kund:in", () => {
    const s = partnerSelectFuerRichtung(LIEFERANTEN, KUNDEN, "einnahme");
    expect(s.label).toBe("Kund:in");
    expect(s.fieldName).toBe("kunde");
    expect(partnerLabelFuerRichtung("einnahme")).toBe("Kund:in");
  });

  it("zeigt bei Einnahme nur Kund:innen", () => {
    const s = partnerSelectFuerRichtung(LIEFERANTEN, KUNDEN, "einnahme");
    expect(s.items.map((i) => i.name)).toEqual([
      "Stadtwerke GmbH",
      "Familie Berger",
    ]);
    expect(s.items.map((i) => i.id)).not.toContain("l1");
  });

  it("setzt Lieferant:in beim Wechsel auf Einnahme zurück", () => {
    const vor = partnerSelectFuerRichtung(
      LIEFERANTEN,
      KUNDEN,
      "ausgabe",
      "l1",
    );
    expect(vor.selected).toBe("l1");
    const nach = partnerSelectFuerRichtung(
      LIEFERANTEN,
      KUNDEN,
      "einnahme",
      vor.selected,
    );
    expect(nach.selected).toBe("");
    expect(nach.label).toBe("Kund:in");
  });

  it("setzt Kund:in beim Wechsel auf Ausgabe zurück", () => {
    const vor = partnerSelectFuerRichtung(
      LIEFERANTEN,
      KUNDEN,
      "einnahme",
      "k1",
    );
    expect(vor.selected).toBe("k1");
    const nach = partnerSelectFuerRichtung(
      LIEFERANTEN,
      KUNDEN,
      "ausgabe",
      vor.selected,
    );
    expect(nach.selected).toBe("");
    expect(nach.label).toBe("Lieferant:in");
  });

  it("zeigt den Leere-Liste-Hinweis je Richtung", () => {
    expect(partnerEmptyHintFuerRichtung("ausgabe")).toMatch(/Lieferant/);
    expect(partnerEmptyHintFuerRichtung("einnahme")).toMatch(/Kund/);
    const leer = partnerSelectFuerRichtung([], [], "einnahme");
    expect(leer.items).toEqual([]);
    expect(leer.emptyHint).toBe("Noch keine Kund:innen vorhanden.");
  });
});

describe("assertPartnerPasstZurRichtung", () => {
  it("erlaubt leere Zuordnung", () => {
    expect(() =>
      assertPartnerPasstZurRichtung("ausgabe", null, null),
    ).not.toThrow();
    expect(() =>
      assertPartnerPasstZurRichtung("einnahme", null, null),
    ).not.toThrow();
  });

  it("lehnt Einnahme + Lieferant:in ab", () => {
    expect(() =>
      assertPartnerPasstZurRichtung("einnahme", "l1", null),
    ).toThrow(EINNAHME_LIEFERANT_ERROR);
  });

  it("lehnt Ausgabe + Kund:in ab", () => {
    expect(() =>
      assertPartnerPasstZurRichtung("ausgabe", null, "k1"),
    ).toThrow(AUSGABE_KUNDE_ERROR);
  });
});

describe("belegPartnerId", () => {
  it("nimmt Lieferant:in bei Ausgabe und Kund:in bei Einnahme", () => {
    expect(
      belegPartnerId(sampleBeleg({ richtung: "ausgabe", lieferant: "l1" })),
    ).toBe("l1");
    expect(
      belegPartnerId(
        sampleBeleg({ richtung: "einnahme", kunde: "k1", lieferant: null }),
      ),
    ).toBe("k1");
  });
});

describe("buildBuchungstextFromBeleg", () => {
  it("fällt auf Richtungslabel zurück", () => {
    expect(
      buildBuchungstextFromBeleg({
        kategorie: "",
        notiz: "",
        richtung: "ausgabe",
      }),
    ).toBe("Ausgabenbeleg");
  });
});

describe("validateBelegDatei", () => {
  it("akzeptiert PDF", () => {
    expect(() =>
      validateBelegDatei({ type: "application/pdf", size: 100 }),
    ).not.toThrow();
  });

  it("lehnt zu große Datei ab", () => {
    expect(() =>
      validateBelegDatei({
        type: "application/pdf",
        size: 20 * 1024 * 1024,
      }),
    ).toThrow(/zu groß/i);
  });

  it("lehnt unzulässigen MIME ab", () => {
    expect(() =>
      validateBelegDatei({ type: "application/zip", size: 100 }),
    ).toThrow(/Dateityp/);
  });
});

describe("DATEI_IMMUTABLE_ERROR", () => {
  it("ist gesetzt (ADR-0012)", () => {
    expect(DATEI_IMMUTABLE_ERROR).toMatch(/unveränderbar/i);
  });
});

describe("normalizeBelegDateiNamen", () => {
  it("macht aus String und Array eine bereinigte Liste", () => {
    expect(normalizeBelegDateiNamen("a.jpg")).toEqual(["a.jpg"]);
    expect(normalizeBelegDateiNamen(["a.jpg", " ", "b.pdf"])).toEqual([
      "a.jpg",
      "b.pdf",
    ]);
    expect(normalizeBelegDateiNamen("")).toEqual([]);
    expect(normalizeBelegDateiNamen(undefined)).toEqual([]);
  });
});

describe("assertBelegDateiAnzahl", () => {
  it("erlaubt Auffüllen bis zur Obergrenze", () => {
    expect(() => assertBelegDateiAnzahl(2, 3)).not.toThrow();
    expect(() =>
      assertBelegDateiAnzahl(BELEG_DATEI_MAX_ANZAHL, 0),
    ).not.toThrow();
  });

  it("lehnt mehr als die Obergrenze ab", () => {
    expect(() =>
      assertBelegDateiAnzahl(BELEG_DATEI_MAX_ANZAHL, 1),
    ).toThrow(/Höchstens/);
  });
});
